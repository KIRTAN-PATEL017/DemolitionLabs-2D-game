/**
 * engine.ts
 * ---------
 * GameEngine — the top-level orchestrator for a single room's game state.
 *
 * Tick execution order (each 50 ms):
 *   1. Flush input queue:
 *      a. PLACE_BOMB inputs → validate & place bomb on grid.
 *      b. MOVE inputs       → resolvePlayerMove → update player.pos.
 *      c. NOOP inputs       → no-op.
 *   2. Power-up collection — for each player, tryCollectPowerup.
 *   3. Bomb fuse countdown — decrement fuseTicksLeft; collect bombs at 0.
 *   4. Explosion processing — BFS chain detonation queue.
 *   5. Win condition check — determine phase & winner.
 *   6. Emit GameStateDelta.
 *
 * The engine is deliberately synchronous and side-effect-free with respect
 * to I/O.  Networking, timers, and persistence are handled by the server
 * layer in Phase 2.
 */

import {
  BOMB_CHAIN_DELAY_TICKS,
  BOMB_FUSE_TICKS,
  DEFAULT_BOMB_LIMIT,
  DEFAULT_FIREPOWER,
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  ENTITY_BOMB,
  POWERUP_BOMB_UP,
  POWERUP_FIRE_UP,
  POWERUP_NONE,
  POWERUP_SPEED_UP,
  SPAWN_POSITIONS,
  getSpeedCooldownTicks,
} from "./constants.js";
import { generateMap, getCell, packCell, setCell } from "./grid.js";
import { resolvePlayerMove, tryCollectPowerup } from "./collision.js";
import { applyExplosion } from "./explosion.js";
import type {
  BombState,
  CellChange,
  GameInput,
  GameState,
  GameStateDelta,
  MatchPhase,
  PlayerState,
  PowerupState,
  RoomConfig,
  Vec2,
} from "./types.js";

export class GameEngine {
  private readonly state: GameState;

  // Input queue: one input per player per tick (last write wins within a tick)
  private readonly inputQueue: Map<string, GameInput> = new Map();

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  constructor(config: RoomConfig) {
    const mapWidth = config.mapWidth ?? DEFAULT_MAP_WIDTH;
    const mapHeight = config.mapHeight ?? DEFAULT_MAP_HEIGHT;

    const [grid, rngState] = generateMap(mapWidth, mapHeight, config.seed);

    this.state = {
      tick: 0,
      grid,
      mapWidth,
      mapHeight,
      players: new Map(),
      bombs: [],
      powerups: [],
      phase: "LOBBY",
      winnerId: null,
      rngState,
    };
  }

  // ---------------------------------------------------------------------------
  // Player management
  // ---------------------------------------------------------------------------

  /**
   * Register a player at a fixed spawn position.
   *
   * @param id          Unique player identifier.
   * @param spawnIndex  0–3; maps to SPAWN_POSITIONS corners.
   * @throws If the game is not in LOBBY phase, or id is already registered.
   */
  addPlayer(id: string, spawnIndex: number): void {
    if (this.state.phase !== "LOBBY") {
      throw new Error(`Cannot add player after game has started (phase: ${this.state.phase})`);
    }
    if (this.state.players.has(id)) {
      throw new Error(`Player '${id}' is already registered`);
    }
    const spawnPos = SPAWN_POSITIONS[spawnIndex];
    if (!spawnPos) {
      throw new Error(`Invalid spawn index: ${spawnIndex}. Must be 0–3`);
    }

    const player: PlayerState = {
      id,
      pos: { x: spawnPos[0], y: spawnPos[1] },
      alive: true,
      spectator: false,
      bombLimit: DEFAULT_BOMB_LIMIT,
      activeBombs: 0,
      firepower: DEFAULT_FIREPOWER,
      speed: 1,
      lastMoveTick: -100, // Allow immediate movement on spawn
    };
    this.state.players.set(id, player);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  /**
   * Enqueue an input for the next tick.
   * Only one input per player is processed per tick; calling this multiple
   * times before tick() will use the last value (last-write-wins).
   */
  processInput(playerId: string, input: GameInput): void {
    this.inputQueue.set(playerId, input);
  }

  /**
   * Start the match (transition LOBBY → RUNNING).
   * @throws If fewer than 2 players are registered.
   */
  startMatch(): void {
    if (this.state.players.size < 2) {
      throw new Error(`Match requires at least 2 players (have ${this.state.players.size})`);
    }
    if (this.state.phase !== "LOBBY") {
      throw new Error(`Cannot start match from phase: ${this.state.phase}`);
    }
    this.state.phase = "RUNNING";
  }

  // ---------------------------------------------------------------------------
  // Tick
  // ---------------------------------------------------------------------------

  /**
   * Advance the game state by one tick (50 ms window).
   * Returns a minimal delta describing what changed, suitable for network broadcast.
   *
   * @throws If the game is not in RUNNING phase.
   */
  tick(): GameStateDelta {
    if (this.state.phase !== "RUNNING") {
      throw new Error(`tick() called outside RUNNING phase (current: ${this.state.phase})`);
    }

    this.state.tick++;

    const newBombs: BombState[] = [];
    const explodedBombPositions: Vec2[] = [];
    const allCellChanges: CellChange[] = [];
    const allSpawnedPowerups: PowerupState[] = [];
    const allCollectedPowerups: Vec2[] = [];
    const allKilledPlayerIds: string[] = [];

    // -------------------------------------------------------------------------
    // Step 1: Process input queue
    // -------------------------------------------------------------------------
    for (const [playerId, input] of this.inputQueue) {
      const player = this.state.players.get(playerId);
      if (!player || !player.alive) continue;

      if (input.type === "MOVE") {
        const cooldown = getSpeedCooldownTicks(player.speed);
        if (this.state.tick - player.lastMoveTick >= cooldown) {
          const newPos = resolvePlayerMove(this.state, playerId, input.dir);
          if (newPos.x !== player.pos.x || newPos.y !== player.pos.y) {
            player.pos = newPos;
            player.lastMoveTick = this.state.tick;
          }
        }
      } else if (input.type === "PLACE_BOMB") {
        this._tryPlaceBomb(player, newBombs, allCellChanges);
      }
      // NOOP → nothing
    }
    this.inputQueue.clear();

    // -------------------------------------------------------------------------
    // Step 2: Power-up collection
    // -------------------------------------------------------------------------
    for (const [playerId, player] of this.state.players) {
      if (!player.alive) continue;
      const name = tryCollectPowerup(this.state, playerId);
      if (name !== null) {
        const pos = { ...player.pos };
        // Remove from state.powerups
        const idx = this.state.powerups.findIndex(
          (p) => p.pos.x === pos.x && p.pos.y === pos.y,
        );
        if (idx !== -1) this.state.powerups.splice(idx, 1);
        // Clear the grid cell
        this.state.grid[pos.y * this.state.mapWidth + pos.x] = 0;
        allCellChanges.push({ x: pos.x, y: pos.y, value: 0 });
        allCollectedPowerups.push(pos);
      }
    }

    // -------------------------------------------------------------------------
    // Step 3: Bomb fuse countdown + detonation scheduling
    // -------------------------------------------------------------------------
    const detonatingBombs: BombState[] = [];
    const stillLiveBombs: BombState[] = [];

    for (const bomb of this.state.bombs) {
      bomb.fuseTicksLeft--;
      if (bomb.fuseTicksLeft <= 0) {
        detonatingBombs.push(bomb);
      } else {
        stillLiveBombs.push(bomb);
      }
    }
    this.state.bombs = stillLiveBombs;

    // -------------------------------------------------------------------------
    // Step 4: BFS explosion chain processing
    // -------------------------------------------------------------------------
    // Use a queue seeded with naturally-detonating bombs.
    // Chain-triggered bombs are appended to the queue (with optional delay).
    const explosionQueue: BombState[] = [...detonatingBombs];
    const processedPositions = new Set<string>();

    while (explosionQueue.length > 0) {
      const bomb = explosionQueue.shift()!;
      const posKey = `${bomb.pos.x},${bomb.pos.y}`;
      if (processedPositions.has(posKey)) continue;
      processedPositions.add(posKey);

      explodedBombPositions.push(bomb.pos);

      // Refund the owner's active bomb count
      const owner = this.state.players.get(bomb.ownerId);
      if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

      const result = applyExplosion(this.state, bomb);

      allCellChanges.push(...result.cellChanges);
      allSpawnedPowerups.push(...result.spawnedPowerups);
      for (const id of result.killedPlayerIds) {
        if (!allKilledPlayerIds.includes(id)) allKilledPlayerIds.push(id);
      }

      // Enqueue chain-triggered bombs (BFS order)
      for (const chainPos of result.chainTriggeredBombPositions) {
        const chainPosKey = `${chainPos.x},${chainPos.y}`;
        if (processedPositions.has(chainPosKey)) continue;

        // Find the bomb at this position in the still-live list
        const chainBombIdx = this.state.bombs.findIndex(
          (b) => b.pos.x === chainPos.x && b.pos.y === chainPos.y,
        );
        if (chainBombIdx !== -1) {
          const [chainBomb] = this.state.bombs.splice(chainBombIdx, 1);
          if (chainBomb) {
            // Apply chain delay (0 = instant, as per BOMB_CHAIN_DELAY_TICKS default)
            chainBomb.fuseTicksLeft = BOMB_CHAIN_DELAY_TICKS;
            explosionQueue.push(chainBomb);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Step 5: Win condition
    // -------------------------------------------------------------------------
    const alivePlayers = [...this.state.players.values()].filter((p) => p.alive);
    if (alivePlayers.length <= 1) {
      this.state.phase = "FINISHED";
      this.state.winnerId = alivePlayers.length === 1 ? (alivePlayers[0]?.id ?? null) : null;
    }

    // -------------------------------------------------------------------------
    // Step 6: Build delta
    // -------------------------------------------------------------------------
    const delta: GameStateDelta = {
      tick: this.state.tick,
      playerUpdates: [...this.state.players.values()].map((p) => ({ ...p })),
      newBombs: newBombs.map((b) => ({ ...b })),
      explodedBombs: explodedBombPositions,
      cellChanges: allCellChanges,
      spawnedPowerups: allSpawnedPowerups,
      collectedPowerups: allCollectedPowerups,
      killedPlayerIds: allKilledPlayerIds,
      phase: this.state.phase,
      winnerId: this.state.winnerId,
    };

    return delta;
  }

  // ---------------------------------------------------------------------------
  // State accessor
  // ---------------------------------------------------------------------------

  /** Returns a shallow read-only view of the current game state. */
  getState(): Readonly<GameState> {
    return this.state;
  }

  isFinished(): boolean {
    return this.state.phase === "FINISHED";
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _tryPlaceBomb(
    player: PlayerState,
    newBombs: BombState[],
    cellChanges: CellChange[],
  ): void {
    // Enforce bomb limit
    if (player.activeBombs >= player.bombLimit) return;

    const { x, y } = player.pos;
    const existingCell = getCell(this.state.grid, x, y, this.state.mapWidth);

    // Can't place a bomb on a cell that already has one (or a wall/box)
    if (existingCell !== 0) return;

    const bomb: BombState = {
      ownerId: player.id,
      pos: { x, y },
      fuseTicksLeft: BOMB_FUSE_TICKS,
      firepower: player.firepower,
    };

    // Place bomb entity on grid
    setCell(
      this.state.grid,
      x,
      y,
      this.state.mapWidth,
      packCell(ENTITY_BOMB, 0, POWERUP_NONE),
    );
    cellChanges.push({ x, y, value: getCell(this.state.grid, x, y, this.state.mapWidth) });

    this.state.bombs.push(bomb);
    newBombs.push(bomb);
    player.activeBombs++;
  }
}

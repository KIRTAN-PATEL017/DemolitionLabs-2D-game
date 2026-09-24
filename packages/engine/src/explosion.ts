/**
 * explosion.ts
 * ------------
 * Step 1.3 — Explosion raycast and blast application.
 *
 * Algorithm:
 *   1. computeBlastCells() raycasts from the bomb origin in all 4 cardinal
 *      directions up to `firepower` cells.  A ray stops when it hits:
 *        - An indestructible WALL  → stop, do NOT include wall cell.
 *        - A DESTRUCTIBLE BOX      → stop, DO include box cell (marks it for removal).
 *      Empty cells and cells containing a power-up or another bomb are
 *      passed through and included (bombs will chain-detonate).
 *
 *   2. applyExplosion() takes the blast cell list and mutates the grid:
 *        - Destroys boxes (clears cell, surfaces drop payload if present).
 *        - Marks players in blast cells as dead / spectator (FR-2.6).
 *        - Marks any live bombs in blast cells for immediate chain detonation.
 *
 * Design note: applyExplosion() is NOT recursive.  Chain detonations are
 * returned as positions and processed iteratively by the engine tick loop.
 * This prevents stack overflows and makes the order deterministic (BFS order).
 */

import type {
  BlastCell,
  BombState,
  CellChange,
  ExplosionResult,
  GameState,
  PowerupState,
  PowerupTypeId,
  Vec2,
} from "./types.js";
import {
  ENTITY_BOMB,
  ENTITY_BOX,
  ENTITY_EMPTY,
  ENTITY_MASK,
  ENTITY_POWERUP,
  ENTITY_WALL,
  POWERUP_NONE,
} from "./constants.js";
import {
  clearCell,
  getCell,
  packCell,
  placePowerupCell,
  setCell,
  unpackDrop,
  unpackType,
} from "./grid.js";
import type { PowerupName } from "./types.js";

// ---------------------------------------------------------------------------
// Cardinal direction vectors
// ---------------------------------------------------------------------------

const CARDINALS: ReadonlyArray<[number, number]> = [
  [0, -1], // NORTH
  [0, 1],  // SOUTH
  [1, 0],  // EAST
  [-1, 0], // WEST
];

// ---------------------------------------------------------------------------
// computeBlastCells
// ---------------------------------------------------------------------------

/**
 * Raycast from `origin` in 4 cardinal directions up to `firepower` cells.
 *
 * @returns Array of cells affected by the blast (excluding the origin cell
 *          itself, which is always cleared separately by the engine).
 */
export function computeBlastCells(
  grid: Uint16Array,
  origin: Vec2,
  firepower: number,
  mapWidth: number,
  mapHeight: number,
): BlastCell[] {
  const blastCells: BlastCell[] = [];

  for (const [dx, dy] of CARDINALS) {
    for (let step = 1; step <= firepower; step++) {
      const x = origin.x + dx * step;
      const y = origin.y + dy * step;

      // Bounds check — treat out-of-bounds as wall (ray stops)
      if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) break;

      const cell = getCell(grid, x, y, mapWidth);
      const type = cell & ENTITY_MASK;

      if (type === ENTITY_WALL) {
        // Indestructible — ray stops, wall not included.
        break;
      } else if (type === ENTITY_BOX) {
        // Box is destroyed — include cell and stop ray in this direction.
        blastCells.push({ pos: { x, y }, destroysBox: true });
        break;
      } else {
        // Empty, power-up, or bomb — included, ray continues.
        blastCells.push({ pos: { x, y }, destroysBox: false });
      }
    }
  }

  return blastCells;
}

// ---------------------------------------------------------------------------
// applyExplosion
// ---------------------------------------------------------------------------

/**
 * Apply the effects of a single bomb's explosion to the game state.
 *
 * Mutates:
 *   - state.grid   (clears destroyed boxes, surfaces power-ups)
 *   - player.alive / player.spectator   (marks killed players)
 *   - state.powerups (appends newly revealed power-ups)
 *
 * Does NOT:
 *   - Remove the exploding bomb from state.bombs (caller's responsibility).
 *   - Trigger chain detonations directly (returns positions for the caller
 *     to schedule them to preserve BFS ordering).
 *
 * @param state  Full mutable game state.
 * @param bomb   The bomb that is detonating.
 * @returns      ExplosionResult describing every state change made.
 */
export function applyExplosion(
  state: GameState,
  bomb: BombState,
): ExplosionResult {
  const killedPlayerIds: string[] = [];
  const destroyedBoxPositions: Vec2[] = [];
  const spawnedPowerups: PowerupState[] = [];
  const chainTriggeredBombPositions: Vec2[] = [];
  const cellChanges: CellChange[] = [];

  // Compute which cells are affected
  const blastCells = computeBlastCells(
    state.grid,
    bomb.pos,
    bomb.firepower,
    state.mapWidth,
    state.mapHeight,
  );

  // Also apply blast to the origin cell (where the bomb sat)
  const allAffectedPositions: Array<{ pos: Vec2; destroysBox: boolean }> = [
    { pos: bomb.pos, destroysBox: false },
    ...blastCells,
  ];

  for (const { pos, destroysBox } of allAffectedPositions) {
    const { x, y } = pos;
    const cell = getCell(state.grid, x, y, state.mapWidth);
    const type = unpackType(cell);

    if (destroysBox) {
      // Surface hidden drop payload (if any)
      const dropPayload = unpackDrop(cell);
      destroyedBoxPositions.push(pos);

      if (dropPayload !== POWERUP_NONE) {
        // Place the power-up token on the grid (visible, collectible)
        placePowerupCell(state.grid, pos, state.mapWidth, dropPayload);
        cellChanges.push({ x, y, value: getCell(state.grid, x, y, state.mapWidth) });

        const name = powerupIdToName(dropPayload);
        if (name !== null) {
          const pu: PowerupState = { pos, typeId: dropPayload as PowerupTypeId, name };
          state.powerups.push(pu);
          spawnedPowerups.push(pu);
        }
      } else {
        // No drop — clear the cell to empty
        clearCell(state.grid, pos, state.mapWidth);
        cellChanges.push({ x, y, value: 0 });
      }
    } else if (type === ENTITY_BOMB) {
      // Chain detonation — do NOT clear here; engine will re-call applyExplosion
      chainTriggeredBombPositions.push(pos);
      // Note: the bomb cell will be cleared when that bomb's explosion is processed
    } else if (type === ENTITY_POWERUP) {
      // Blast destroys a surface power-up that hasn't been collected yet
      clearCell(state.grid, pos, state.mapWidth);
      cellChanges.push({ x, y, value: 0 });
      // Remove from state.powerups list
      const idx = state.powerups.findIndex((p) => p.pos.x === x && p.pos.y === y);
      if (idx !== -1) state.powerups.splice(idx, 1);
    } else if (type !== ENTITY_WALL) {
      // Empty or other non-wall cell — clear it (e.g., origin after bomb detonation)
      if (type !== ENTITY_EMPTY) {
        setCell(state.grid, x, y, state.mapWidth, packCell(ENTITY_EMPTY, 0, POWERUP_NONE));
        cellChanges.push({ x, y, value: 0 });
      }
    }

    // Check if any live player is in this blast cell
    for (const [, player] of state.players) {
      if (
        player.alive &&
        player.pos.x === x &&
        player.pos.y === y
      ) {
        player.alive = false;
        player.spectator = true; // FR-2.6: dead player enters spectator mode
        killedPlayerIds.push(player.id);
      }
    }
  }

  // Clear the bomb's own cell (the origin)
  clearCell(state.grid, bomb.pos, state.mapWidth);
  if (!cellChanges.some((c) => c.x === bomb.pos.x && c.y === bomb.pos.y)) {
    cellChanges.push({ x: bomb.pos.x, y: bomb.pos.y, value: 0 });
  }

  return {
    killedPlayerIds,
    destroyedBoxPositions,
    spawnedPowerups,
    chainTriggeredBombPositions,
    cellChanges,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function powerupIdToName(id: number): PowerupName | null {
  if (id === 1) return "BOMB_UP";
  if (id === 2) return "FIRE_UP";
  if (id === 3) return "SPEED_UP";
  return null;
}

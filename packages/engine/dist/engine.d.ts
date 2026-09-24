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
import type { GameInput, GameState, GameStateDelta, RoomConfig } from "./types.js";
export declare class GameEngine {
    private readonly state;
    private readonly inputQueue;
    constructor(config: RoomConfig);
    /**
     * Register a player at a fixed spawn position.
     *
     * @param id          Unique player identifier.
     * @param spawnIndex  0–3; maps to SPAWN_POSITIONS corners.
     * @throws If the game is not in LOBBY phase, or id is already registered.
     */
    addPlayer(id: string, spawnIndex: number): void;
    /**
     * Enqueue an input for the next tick.
     * Only one input per player is processed per tick; calling this multiple
     * times before tick() will use the last value (last-write-wins).
     */
    processInput(playerId: string, input: GameInput): void;
    /**
     * Start the match (transition LOBBY → RUNNING).
     * @throws If fewer than 2 players are registered.
     */
    startMatch(): void;
    /**
     * Advance the game state by one tick (50 ms window).
     * Returns a minimal delta describing what changed, suitable for network broadcast.
     *
     * @throws If the game is not in RUNNING phase.
     */
    tick(): GameStateDelta;
    /** Returns a shallow read-only view of the current game state. */
    getState(): Readonly<GameState>;
    isFinished(): boolean;
    private _tryPlaceBomb;
}
//# sourceMappingURL=engine.d.ts.map
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
import type { BlastCell, BombState, ExplosionResult, GameState, Vec2 } from "./types.js";
/**
 * Raycast from `origin` in 4 cardinal directions up to `firepower` cells.
 *
 * @returns Array of cells affected by the blast (excluding the origin cell
 *          itself, which is always cleared separately by the engine).
 */
export declare function computeBlastCells(grid: Uint16Array, origin: Vec2, firepower: number, mapWidth: number, mapHeight: number): BlastCell[];
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
export declare function applyExplosion(state: GameState, bomb: BombState): ExplosionResult;
//# sourceMappingURL=explosion.d.ts.map
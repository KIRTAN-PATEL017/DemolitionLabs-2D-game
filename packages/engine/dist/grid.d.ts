/**
 * grid.ts
 * -------
 * Step 1.1 — Bitmask grid layout, CRUD helpers, and seeded map generation.
 *
 * The entire map is stored as a contiguous Uint16Array (one entry per cell).
 * Each 16-bit integer is a packed bitfield:
 *
 *   Bits [0..3]  → EntityType  (0 = Empty, 1 = Wall, 2 = Box, 3 = Bomb, 4 = PowerUp)
 *   Bits [4..7]  → HP          (0–15)
 *   Bits [8..15] → Drop payload (PowerupType hidden inside box; 0 = none)
 *
 * All functions are pure (no side effects outside the provided Uint16Array)
 * and allocation-free on the hot path so V8's GC is never triggered mid-tick.
 */
import type { Vec2 } from "./types.js";
/**
 * Pack three components into a single 16-bit cell value.
 *
 * @param type        EntityType constant (0–15).
 * @param hp          Durability / HP value (0–15).
 * @param dropPayload PowerupType hidden inside a box (0 = none).
 */
export declare function packCell(type: number, hp: number, dropPayload: number): number;
/**
 * Extract the EntityType from a packed cell value.
 * Equivalent to `cell & ENTITY_MASK` — written as a named function for clarity.
 */
export declare function unpackType(cell: number): number;
/** Extract the HP field from a packed cell value. */
export declare function unpackHp(cell: number): number;
/** Extract the drop-payload byte from a packed cell value. */
export declare function unpackDrop(cell: number): number;
/**
 * Read a cell value from the grid.
 * Returns 0 (ENTITY_EMPTY) for out-of-bounds coordinates so callers
 * can skip explicit bounds checks in raycast loops.
 */
export declare function getCell(grid: Uint16Array, x: number, y: number, mapWidth: number): number;
/**
 * Write a cell value to the grid.
 * Silently ignores out-of-bounds writes.
 */
export declare function setCell(grid: Uint16Array, x: number, y: number, mapWidth: number, value: number): void;
/**
 * Returns true when a player may enter the cell at (x, y).
 *
 * Walkable entity types (FR-2.1, FR-2.2):
 *   - EMPTY   (0) → walkable
 *   - POWERUP (4) → walkable (collected on entry)
 *
 * Impassable entity types:
 *   - WALL (1), BOX (2), BOMB (3) → blocked
 *
 * Identical to the reference implementation in architecture_tech_stack.md §3.2.
 */
export declare function isCellWalkable(grid: Uint16Array, x: number, y: number, mapWidth: number): boolean;
/**
 * Mulberry32 — a fast, high-quality 32-bit PRNG suitable for deterministic
 * game simulations.  Returns [0, 1) and mutates `state` in place via the
 * returned next state value.
 *
 * Usage: `[value, state] = mulberry32(state);`
 */
export declare function mulberry32(state: number): [number, number];
/**
 * Generate a fresh game map as a Uint16Array.
 *
 * Layout rules:
 *  1. All border cells → indestructible WALL.
 *  2. Even-column AND even-row interior cells → indestructible WALL pillar
 *     (creates the classic cross-hatch pattern).
 *  3. A random subset of remaining interior cells → DESTRUCTIBLE BOX
 *     (density controlled by `boxDensity`).
 *  4. Cells within SPAWN_CLEAR_RADIUS of each spawn corner → forced EMPTY
 *     (ensures players cannot be trapped at spawn).
 *  5. Hidden drop payloads are assigned to each box using the seeded PRNG.
 *
 * @param width       Map width in cells (default 13).
 * @param height      Map height in cells (default 11).
 * @param seed        PRNG seed for deterministic generation.
 * @param boxDensity  Fraction of eligible interior cells filled with boxes (0–1).
 * @returns           [grid, finalRngState] — the finalRngState is passed back
 *                    to the engine so the same PRNG stream continues.
 */
export declare function generateMap(width: number | undefined, height: number | undefined, seed: number, boxDensity?: number): [Uint16Array, number];
/** Set a cell to EMPTY (value 0). Convenience wrapper over setCell. */
export declare function clearCell(grid: Uint16Array, pos: Vec2, mapWidth: number): void;
/**
 * Overwrite a cell with a POWERUP entity.
 * Used after a box is destroyed to surface its hidden drop payload.
 */
export declare function placePowerupCell(grid: Uint16Array, pos: Vec2, mapWidth: number, typeId: number): void;
//# sourceMappingURL=grid.d.ts.map
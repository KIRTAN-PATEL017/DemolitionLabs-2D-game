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

import {
  DEFAULT_BOX_DENSITY,
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  DROP_MASK,
  DROP_SHIFT,
  ENTITY_BOX,
  ENTITY_EMPTY,
  ENTITY_MASK,
  ENTITY_POWERUP,
  ENTITY_WALL,
  HP_MASK,
  HP_SHIFT,
  POWERUP_NONE,
  SPAWN_CLEAR_RADIUS,
  SPAWN_POSITIONS,
} from "./constants.js";
import type { Vec2 } from "./types.js";

// ---------------------------------------------------------------------------
// Cell pack / unpack
// ---------------------------------------------------------------------------

/**
 * Pack three components into a single 16-bit cell value.
 *
 * @param type        EntityType constant (0–15).
 * @param hp          Durability / HP value (0–15).
 * @param dropPayload PowerupType hidden inside a box (0 = none).
 */
export function packCell(type: number, hp: number, dropPayload: number): number {
  return (type & 0x0f) | ((hp & 0x0f) << HP_SHIFT) | ((dropPayload & 0xff) << DROP_SHIFT);
}

/**
 * Extract the EntityType from a packed cell value.
 * Equivalent to `cell & ENTITY_MASK` — written as a named function for clarity.
 */
export function unpackType(cell: number): number {
  return cell & ENTITY_MASK;
}

/** Extract the HP field from a packed cell value. */
export function unpackHp(cell: number): number {
  return (cell & HP_MASK) >>> HP_SHIFT;
}

/** Extract the drop-payload byte from a packed cell value. */
export function unpackDrop(cell: number): number {
  return (cell & DROP_MASK) >>> DROP_SHIFT;
}

// ---------------------------------------------------------------------------
// Grid accessors
// ---------------------------------------------------------------------------

/**
 * Read a cell value from the grid.
 * Returns 0 (ENTITY_EMPTY) for out-of-bounds coordinates so callers
 * can skip explicit bounds checks in raycast loops.
 */
export function getCell(
  grid: Uint16Array,
  x: number,
  y: number,
  mapWidth: number,
): number {
  const index = y * mapWidth + x;
  return grid[index] ?? 0;
}

/**
 * Write a cell value to the grid.
 * Silently ignores out-of-bounds writes.
 */
export function setCell(
  grid: Uint16Array,
  x: number,
  y: number,
  mapWidth: number,
  value: number,
): void {
  const index = y * mapWidth + x;
  if (index >= 0 && index < grid.length) {
    grid[index] = value;
  }
}

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
export function isCellWalkable(
  grid: Uint16Array,
  x: number,
  y: number,
  mapWidth: number,
): boolean {
  const cell = getCell(grid, x, y, mapWidth);
  const type = cell & ENTITY_MASK;
  return type === ENTITY_EMPTY || type === ENTITY_POWERUP;
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator (Mulberry32)
// ---------------------------------------------------------------------------

/**
 * Mulberry32 — a fast, high-quality 32-bit PRNG suitable for deterministic
 * game simulations.  Returns [0, 1) and mutates `state` in place via the
 * returned next state value.
 *
 * Usage: `[value, state] = mulberry32(state);`
 */
export function mulberry32(state: number): [number, number] {
  let s = state + 0x6d2b79f5;
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  const value = ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  return [value, s >>> 0];
}

// ---------------------------------------------------------------------------
// Map generation (Step 1.1 — seeded, symmetric, safe spawn corridors)
// ---------------------------------------------------------------------------

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
export function generateMap(
  width: number = DEFAULT_MAP_WIDTH,
  height: number = DEFAULT_MAP_HEIGHT,
  seed: number,
  boxDensity: number = DEFAULT_BOX_DENSITY,
): [Uint16Array, number] {
  const grid = new Uint16Array(width * height); // all zeros = EMPTY
  let rngState = seed >>> 0;

  // --- Pass 1: Place border and pillar walls ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      const isPillar = x % 2 === 0 && y % 2 === 0;
      if (isBorder || isPillar) {
        setCell(grid, x, y, width, packCell(ENTITY_WALL, 0, POWERUP_NONE));
      }
    }
  }

  // --- Build spawn-safe zone set ---
  const safeSet = new Set<number>();
  for (const [sx, sy] of SPAWN_POSITIONS) {
    for (let dy = -SPAWN_CLEAR_RADIUS; dy <= SPAWN_CLEAR_RADIUS; dy++) {
      for (let dx = -SPAWN_CLEAR_RADIUS; dx <= SPAWN_CLEAR_RADIUS; dx++) {
        const cx = sx + dx;
        const cy = sy + dy;
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
          safeSet.add(cy * width + cx);
        }
      }
    }
  }

  // --- Pass 2: Scatter boxes on eligible interior cells ---
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Skip wall pillars and already-set cells
      if (unpackType(grid[idx] ?? 0) === ENTITY_WALL) continue;
      // Protect spawn corridors
      if (safeSet.has(idx)) continue;

      let roll: number;
      [roll, rngState] = mulberry32(rngState);

      if (roll < boxDensity) {
        // Assign a hidden drop payload using the same PRNG stream.
        // The drop table in powerup.ts determines what it means at explosion time.
        let dropRoll: number;
        [dropRoll, rngState] = mulberry32(rngState);
        // Encode a raw drop index 1–3 (resolved by powerup.ts); 0 = no drop.
        // Rough distribution: ~35% have a payload, split 40/40/20 across types.
        let dropPayload = POWERUP_NONE;
        if (dropRoll < 0.35) {
          let typeRoll: number;
          [typeRoll, rngState] = mulberry32(rngState);
          dropPayload = typeRoll < 0.4 ? 1 : typeRoll < 0.8 ? 2 : 3;
        }
        setCell(grid, x, y, width, packCell(ENTITY_BOX, 1, dropPayload));
      }
    }
  }

  return [grid, rngState];
}

// ---------------------------------------------------------------------------
// Utility: clear a single cell to EMPTY
// ---------------------------------------------------------------------------

/** Set a cell to EMPTY (value 0). Convenience wrapper over setCell. */
export function clearCell(
  grid: Uint16Array,
  pos: Vec2,
  mapWidth: number,
): void {
  setCell(grid, pos.x, pos.y, mapWidth, 0);
}

// ---------------------------------------------------------------------------
// Utility: place a power-up token on the grid
// ---------------------------------------------------------------------------

/**
 * Overwrite a cell with a POWERUP entity.
 * Used after a box is destroyed to surface its hidden drop payload.
 */
export function placePowerupCell(
  grid: Uint16Array,
  pos: Vec2,
  mapWidth: number,
  typeId: number,
): void {
  // Store the powerup type in the drop field so the visual layer can read it.
  setCell(grid, pos.x, pos.y, mapWidth, packCell(ENTITY_POWERUP, 0, typeId));
}

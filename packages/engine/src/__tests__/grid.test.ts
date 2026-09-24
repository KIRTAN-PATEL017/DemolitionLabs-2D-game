/**
 * grid.test.ts
 * Tests for: packCell, unpackType/Hp/Drop, getCell/setCell,
 *            isCellWalkable, generateMap
 */

import { describe, it, expect } from "vitest";
import {
  packCell,
  unpackType,
  unpackHp,
  unpackDrop,
  getCell,
  setCell,
  isCellWalkable,
  generateMap,
  mulberry32,
} from "../grid.js";
import {
  ENTITY_EMPTY,
  ENTITY_WALL,
  ENTITY_BOX,
  ENTITY_BOMB,
  ENTITY_POWERUP,
  POWERUP_NONE,
  POWERUP_BOMB_UP,
  DEFAULT_MAP_WIDTH,
  DEFAULT_MAP_HEIGHT,
  SPAWN_POSITIONS,
  SPAWN_CLEAR_RADIUS,
} from "../constants.js";

// ---------------------------------------------------------------------------
// packCell / unpack round-trips
// ---------------------------------------------------------------------------

describe("packCell / unpack", () => {
  it("round-trips EMPTY with zero HP and no drop", () => {
    const cell = packCell(ENTITY_EMPTY, 0, POWERUP_NONE);
    expect(unpackType(cell)).toBe(ENTITY_EMPTY);
    expect(unpackHp(cell)).toBe(0);
    expect(unpackDrop(cell)).toBe(POWERUP_NONE);
  });

  it("round-trips BOX with HP=1 and a drop payload", () => {
    const cell = packCell(ENTITY_BOX, 1, POWERUP_BOMB_UP);
    expect(unpackType(cell)).toBe(ENTITY_BOX);
    expect(unpackHp(cell)).toBe(1);
    expect(unpackDrop(cell)).toBe(POWERUP_BOMB_UP);
  });

  it("round-trips WALL with max HP (15)", () => {
    const cell = packCell(ENTITY_WALL, 15, 0);
    expect(unpackType(cell)).toBe(ENTITY_WALL);
    expect(unpackHp(cell)).toBe(15);
    expect(unpackDrop(cell)).toBe(0);
  });

  it("round-trips POWERUP with arbitrary drop ID", () => {
    const cell = packCell(ENTITY_POWERUP, 0, 3); // SPEED_UP = 3
    expect(unpackType(cell)).toBe(ENTITY_POWERUP);
    expect(unpackHp(cell)).toBe(0);
    expect(unpackDrop(cell)).toBe(3);
  });

  it("round-trips BOMB with 0 HP and no drop", () => {
    const cell = packCell(ENTITY_BOMB, 0, POWERUP_NONE);
    expect(unpackType(cell)).toBe(ENTITY_BOMB);
    expect(unpackHp(cell)).toBe(0);
    expect(unpackDrop(cell)).toBe(POWERUP_NONE);
  });

  it("masks excess bits in type field", () => {
    // Pass 0xFF as type; only lower 4 bits should survive
    const cell = packCell(0xff, 0, 0);
    expect(unpackType(cell)).toBe(0x0f);
  });
});

// ---------------------------------------------------------------------------
// getCell / setCell
// ---------------------------------------------------------------------------

describe("getCell / setCell", () => {
  const W = 5;
  const H = 5;

  it("returns 0 for an uninitialised grid", () => {
    const grid = new Uint16Array(W * H);
    expect(getCell(grid, 2, 2, W)).toBe(0);
  });

  it("writes and reads back a packed cell", () => {
    const grid = new Uint16Array(W * H);
    const value = packCell(ENTITY_BOX, 1, POWERUP_BOMB_UP);
    setCell(grid, 3, 2, W, value);
    expect(getCell(grid, 3, 2, W)).toBe(value);
  });

  it("does not affect adjacent cells", () => {
    const grid = new Uint16Array(W * H);
    setCell(grid, 1, 1, W, packCell(ENTITY_WALL, 0, 0));
    expect(getCell(grid, 0, 1, W)).toBe(0);
    expect(getCell(grid, 2, 1, W)).toBe(0);
    expect(getCell(grid, 1, 0, W)).toBe(0);
    expect(getCell(grid, 1, 2, W)).toBe(0);
  });

  it("returns 0 for out-of-bounds coordinates", () => {
    const grid = new Uint16Array(W * H);
    expect(getCell(grid, -1, 0, W)).toBe(0);
    expect(getCell(grid, 0, -1, W)).toBe(0);
    expect(getCell(grid, W, 0, W)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isCellWalkable
// ---------------------------------------------------------------------------

describe("isCellWalkable", () => {
  const W = 3;

  function makeGrid(type: number): Uint16Array {
    const grid = new Uint16Array(W * W);
    setCell(grid, 1, 1, W, packCell(type, 0, 0));
    return grid;
  }

  it("EMPTY cell is walkable", () => {
    const grid = makeGrid(ENTITY_EMPTY);
    expect(isCellWalkable(grid, 1, 1, W)).toBe(true);
  });

  it("POWERUP cell is walkable", () => {
    const grid = makeGrid(ENTITY_POWERUP);
    expect(isCellWalkable(grid, 1, 1, W)).toBe(true);
  });

  it("WALL cell is NOT walkable", () => {
    const grid = makeGrid(ENTITY_WALL);
    expect(isCellWalkable(grid, 1, 1, W)).toBe(false);
  });

  it("BOX cell is NOT walkable", () => {
    const grid = makeGrid(ENTITY_BOX);
    expect(isCellWalkable(grid, 1, 1, W)).toBe(false);
  });

  it("BOMB cell is NOT walkable", () => {
    const grid = makeGrid(ENTITY_BOMB);
    expect(isCellWalkable(grid, 1, 1, W)).toBe(false);
  });

  it("out-of-bounds cell is walkable (treated as empty, ray safety)", () => {
    const grid = new Uint16Array(W * W);
    expect(isCellWalkable(grid, -1, 0, W)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateMap
// ---------------------------------------------------------------------------

describe("generateMap", () => {
  const SEED = 42;

  it("returns a Uint16Array of the correct size", () => {
    const [grid] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, SEED);
    expect(grid).toBeInstanceOf(Uint16Array);
    expect(grid.length).toBe(DEFAULT_MAP_WIDTH * DEFAULT_MAP_HEIGHT);
  });

  it("all border cells are indestructible walls", () => {
    const [grid] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, SEED);
    const W = DEFAULT_MAP_WIDTH;
    const H = DEFAULT_MAP_HEIGHT;

    for (let x = 0; x < W; x++) {
      expect(unpackType(getCell(grid, x, 0, W))).toBe(ENTITY_WALL);       // top
      expect(unpackType(getCell(grid, x, H - 1, W))).toBe(ENTITY_WALL);   // bottom
    }
    for (let y = 0; y < H; y++) {
      expect(unpackType(getCell(grid, 0, y, W))).toBe(ENTITY_WALL);       // left
      expect(unpackType(getCell(grid, W - 1, y, W))).toBe(ENTITY_WALL);   // right
    }
  });

  it("even-column AND even-row interior cells are wall pillars", () => {
    const [grid] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, SEED);
    const W = DEFAULT_MAP_WIDTH;
    const H = DEFAULT_MAP_HEIGHT;

    for (let y = 2; y < H - 1; y += 2) {
      for (let x = 2; x < W - 1; x += 2) {
        expect(unpackType(getCell(grid, x, y, W))).toBe(ENTITY_WALL);
      }
    }
  });

  it("spawn corners and SPAWN_CLEAR_RADIUS neighbours are box-free", () => {
    const [grid] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, SEED);
    const W = DEFAULT_MAP_WIDTH;
    const H = DEFAULT_MAP_HEIGHT;

    for (const [sx, sy] of SPAWN_POSITIONS) {
      for (let dy = -SPAWN_CLEAR_RADIUS; dy <= SPAWN_CLEAR_RADIUS; dy++) {
        for (let dx = -SPAWN_CLEAR_RADIUS; dx <= SPAWN_CLEAR_RADIUS; dx++) {
          const cx = sx + dx;
          const cy = sy + dy;
          if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
          const type = unpackType(getCell(grid, cx, cy, W));
          expect(type).not.toBe(ENTITY_BOX);
        }
      }
    }
  });

  it("is deterministic — same seed produces identical grids", () => {
    const [gridA] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, SEED);
    const [gridB] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, SEED);
    expect(gridA).toEqual(gridB);
  });

  it("different seeds produce different maps", () => {
    const [gridA] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, 1);
    const [gridB] = generateMap(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, 2);
    // They could theoretically be equal (astronomically unlikely) but in practice never are
    expect(Array.from(gridA)).not.toEqual(Array.from(gridB));
  });
});

// ---------------------------------------------------------------------------
// mulberry32 PRNG
// ---------------------------------------------------------------------------

describe("mulberry32", () => {
  it("returns a value in [0, 1)", () => {
    const [value] = mulberry32(12345);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("produces different states on sequential calls", () => {
    const [, state1] = mulberry32(0);
    const [, state2] = mulberry32(state1);
    expect(state1).not.toBe(state2);
  });

  it("is deterministic for the same seed", () => {
    const [v1, s1] = mulberry32(999);
    const [v2, s2] = mulberry32(999);
    expect(v1).toBe(v2);
    expect(s1).toBe(s2);
  });
});

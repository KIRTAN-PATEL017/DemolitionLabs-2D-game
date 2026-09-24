/**
 * explosion.test.ts
 * Tests for: computeBlastCells, applyExplosion
 */

import { describe, it, expect, beforeEach } from "vitest";
import { computeBlastCells, applyExplosion } from "../explosion.js";
import { packCell, setCell, getCell, unpackType } from "../grid.js";
import {
  ENTITY_BOMB,
  ENTITY_BOX,
  ENTITY_EMPTY,
  ENTITY_POWERUP,
  ENTITY_WALL,
  POWERUP_BOMB_UP,
  POWERUP_NONE,
  DEFAULT_BOMB_LIMIT,
  DEFAULT_FIREPOWER,
  BOMB_FUSE_TICKS,
} from "../constants.js";
import type { BombState, GameState, PlayerState } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal NxN empty GameState. */
function makeState(size = 9): GameState {
  const W = size;
  const H = size;
  const grid = new Uint16Array(W * H);

  return {
    tick: 0,
    grid,
    mapWidth: W,
    mapHeight: H,
    players: new Map(),
    bombs: [],
    powerups: [],
    phase: "RUNNING",
    winnerId: null,
    rngState: 0,
  };
}

function addPlayer(state: GameState, id: string, x: number, y: number): PlayerState {
  const player: PlayerState = {
    id,
    pos: { x, y },
    alive: true,
    spectator: false,
    bombLimit: DEFAULT_BOMB_LIMIT,
    activeBombs: 1,
    firepower: DEFAULT_FIREPOWER,
    speed: 1,
  };
  state.players.set(id, player);
  return player;
}

function makeBomb(
  ownerId: string,
  x: number,
  y: number,
  firepower = DEFAULT_FIREPOWER,
): BombState {
  return { ownerId, pos: { x, y }, fuseTicksLeft: BOMB_FUSE_TICKS, firepower };
}

// ---------------------------------------------------------------------------
// computeBlastCells
// ---------------------------------------------------------------------------

describe("computeBlastCells", () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState(9);
  });

  it("returns cells in all 4 directions up to firepower on open grid", () => {
    const cells = computeBlastCells(state.grid, { x: 4, y: 4 }, 2, state.mapWidth, state.mapHeight);
    // Expect 8 cells: 2 in each of N, S, E, W
    expect(cells.length).toBe(8);
    // All should be non-box
    expect(cells.every((c) => !c.destroysBox)).toBe(true);
  });

  it("ray stops at an indestructible WALL (wall NOT included)", () => {
    // Place wall at (4, 3) — NORTH of origin (4,4)
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_WALL, 0, 0));
    const cells = computeBlastCells(state.grid, { x: 4, y: 4 }, 3, state.mapWidth, state.mapHeight);

    const wallCell = cells.find((c) => c.pos.x === 4 && c.pos.y === 3);
    expect(wallCell).toBeUndefined(); // wall not included

    // Cell beyond wall should also not be included
    const beyondWall = cells.find((c) => c.pos.x === 4 && c.pos.y === 2);
    expect(beyondWall).toBeUndefined();
  });

  it("ray stops at a BOX (box IS included, marked destroysBox=true)", () => {
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_BOX, 1, POWERUP_NONE));
    const cells = computeBlastCells(state.grid, { x: 4, y: 4 }, 3, state.mapWidth, state.mapHeight);

    const boxCell = cells.find((c) => c.pos.x === 4 && c.pos.y === 3);
    expect(boxCell).toBeDefined();
    expect(boxCell!.destroysBox).toBe(true);

    // Cell beyond box not included
    const beyond = cells.find((c) => c.pos.x === 4 && c.pos.y === 2);
    expect(beyond).toBeUndefined();
  });

  it("passes through a BOMB cell (bomb included, not marked destroysBox)", () => {
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_BOMB, 0, 0));
    const cells = computeBlastCells(state.grid, { x: 4, y: 4 }, 3, state.mapWidth, state.mapHeight);

    const bombCell = cells.find((c) => c.pos.x === 4 && c.pos.y === 3);
    expect(bombCell).toBeDefined();
    expect(bombCell!.destroysBox).toBe(false);

    // Ray continues past bomb
    const beyondBomb = cells.find((c) => c.pos.x === 4 && c.pos.y === 2);
    expect(beyondBomb).toBeDefined();
  });

  it("stops at map boundary (no out-of-bounds cells)", () => {
    const cells = computeBlastCells(state.grid, { x: 1, y: 1 }, 5, state.mapWidth, state.mapHeight);
    expect(cells.every((c) => c.pos.x >= 0 && c.pos.x < state.mapWidth)).toBe(true);
    expect(cells.every((c) => c.pos.y >= 0 && c.pos.y < state.mapHeight)).toBe(true);
  });

  it("firepower=0 produces no blast cells", () => {
    const cells = computeBlastCells(state.grid, { x: 4, y: 4 }, 0, state.mapWidth, state.mapHeight);
    expect(cells.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyExplosion
// ---------------------------------------------------------------------------

describe("applyExplosion", () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState(9);
  });

  it("clears the bomb's origin cell", () => {
    const bomb = makeBomb("p1", 4, 4);
    // Place a bomb token at origin
    setCell(state.grid, 4, 4, state.mapWidth, packCell(ENTITY_BOMB, 0, POWERUP_NONE));

    applyExplosion(state, bomb);

    expect(unpackType(getCell(state.grid, 4, 4, state.mapWidth))).toBe(ENTITY_EMPTY);
  });

  it("destroys a box in blast radius and clears the cell", () => {
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_BOX, 1, POWERUP_NONE));
    const bomb = makeBomb("p1", 4, 4);

    const result = applyExplosion(state, bomb);

    expect(result.destroyedBoxPositions).toContainEqual({ x: 4, y: 3 });
    expect(unpackType(getCell(state.grid, 4, 3, state.mapWidth))).toBe(ENTITY_EMPTY);
  });

  it("surfaces a hidden power-up from a destroyed box", () => {
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_BOX, 1, POWERUP_BOMB_UP));
    const bomb = makeBomb("p1", 4, 4);

    const result = applyExplosion(state, bomb);

    expect(result.spawnedPowerups.length).toBe(1);
    expect(result.spawnedPowerups[0]?.name).toBe("BOMB_UP");
    // Grid cell should now be a POWERUP
    expect(unpackType(getCell(state.grid, 4, 3, state.mapWidth))).toBe(ENTITY_POWERUP);
  });

  it("kills a player standing in the blast radius", () => {
    const player = addPlayer(state, "p1", 4, 3); // one cell NORTH of bomb
    const bomb = makeBomb("owner", 4, 4);

    const result = applyExplosion(state, bomb);

    expect(result.killedPlayerIds).toContain("p1");
    expect(player.alive).toBe(false);
    expect(player.spectator).toBe(true); // FR-2.6
  });

  it("kills a player standing on the bomb's origin cell", () => {
    const player = addPlayer(state, "p1", 4, 4); // on the bomb
    const bomb = makeBomb("owner", 4, 4);
    setCell(state.grid, 4, 4, state.mapWidth, packCell(ENTITY_BOMB, 0, POWERUP_NONE));

    const result = applyExplosion(state, bomb);

    expect(result.killedPlayerIds).toContain("p1");
    expect(player.alive).toBe(false);
  });

  it("marks chain-triggered bomb positions for BFS detonation", () => {
    // Place a live bomb at (4, 3) — in the blast path of (4, 4)
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_BOMB, 0, POWERUP_NONE));
    const chainBomb = makeBomb("p2", 4, 3, 1);
    state.bombs.push(chainBomb);

    const bomb = makeBomb("p1", 4, 4, 2);
    const result = applyExplosion(state, bomb);

    expect(result.chainTriggeredBombPositions).toContainEqual({ x: 4, y: 3 });
  });

  it("does NOT kill players shielded by a wall", () => {
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_WALL, 0, 0));
    const player = addPlayer(state, "p1", 4, 2); // behind wall — safe
    const bomb = makeBomb("owner", 4, 4, 3);

    const result = applyExplosion(state, bomb);

    expect(result.killedPlayerIds).not.toContain("p1");
    expect(player.alive).toBe(true);
  });

  it("kills multiple players in the same blast", () => {
    addPlayer(state, "p1", 4, 3); // NORTH
    addPlayer(state, "p2", 4, 5); // SOUTH
    const bomb = makeBomb("owner", 4, 4, 2);

    const result = applyExplosion(state, bomb);

    expect(result.killedPlayerIds).toContain("p1");
    expect(result.killedPlayerIds).toContain("p2");
  });

  it("destroys a power-up sitting on the grid within blast radius", () => {
    setCell(state.grid, 5, 4, state.mapWidth, packCell(ENTITY_POWERUP, 0, POWERUP_BOMB_UP));
    state.powerups.push({ pos: { x: 5, y: 4 }, typeId: POWERUP_BOMB_UP, name: "BOMB_UP" });
    const bomb = makeBomb("owner", 4, 4, 2);

    applyExplosion(state, bomb);

    // Power-up cell should be cleared
    expect(unpackType(getCell(state.grid, 5, 4, state.mapWidth))).toBe(ENTITY_EMPTY);
    // Removed from state.powerups
    expect(state.powerups.find((p) => p.pos.x === 5 && p.pos.y === 4)).toBeUndefined();
  });
});

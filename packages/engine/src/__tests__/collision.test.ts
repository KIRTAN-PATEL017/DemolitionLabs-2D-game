/**
 * collision.test.ts
 * Tests for: resolvePlayerMove, tryCollectPowerup, applyPowerupById
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolvePlayerMove, tryCollectPowerup, applyPowerupById } from "../collision.js";
import { packCell, setCell } from "../grid.js";
import {
  ENTITY_BOMB,
  ENTITY_BOX,
  ENTITY_EMPTY,
  ENTITY_POWERUP,
  ENTITY_WALL,
  POWERUP_BOMB_UP,
  POWERUP_FIRE_UP,
  POWERUP_NONE,
  POWERUP_SPEED_UP,
  DEFAULT_BOMB_LIMIT,
  DEFAULT_FIREPOWER,
} from "../constants.js";
import type { GameState, PlayerState } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal 7×7 empty GameState for testing. */
function makeState(overrides?: Partial<GameState>): GameState {
  const W = 7;
  const H = 7;
  const grid = new Uint16Array(W * H); // all zeros = EMPTY

  const player: PlayerState = {
    id: "p1",
    pos: { x: 3, y: 3 }, // centre of 7×7
    alive: true,
    spectator: false,
    bombLimit: DEFAULT_BOMB_LIMIT,
    activeBombs: 0,
    firepower: DEFAULT_FIREPOWER,
    speed: 1,
  };

  return {
    tick: 0,
    grid,
    mapWidth: W,
    mapHeight: H,
    players: new Map([["p1", player]]),
    bombs: [],
    powerups: [],
    phase: "RUNNING",
    winnerId: null,
    rngState: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolvePlayerMove
// ---------------------------------------------------------------------------

describe("resolvePlayerMove", () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it("moves NORTH into an empty cell", () => {
    const pos = resolvePlayerMove(state, "p1", "NORTH");
    expect(pos).toEqual({ x: 3, y: 2 });
  });

  it("moves SOUTH into an empty cell", () => {
    const pos = resolvePlayerMove(state, "p1", "SOUTH");
    expect(pos).toEqual({ x: 3, y: 4 });
  });

  it("moves EAST into an empty cell", () => {
    const pos = resolvePlayerMove(state, "p1", "EAST");
    expect(pos).toEqual({ x: 4, y: 3 });
  });

  it("moves WEST into an empty cell", () => {
    const pos = resolvePlayerMove(state, "p1", "WEST");
    expect(pos).toEqual({ x: 2, y: 3 });
  });

  it("is BLOCKED by an indestructible WALL", () => {
    setCell(state.grid, 3, 2, state.mapWidth, packCell(ENTITY_WALL, 0, 0));
    const pos = resolvePlayerMove(state, "p1", "NORTH");
    expect(pos).toEqual({ x: 3, y: 3 }); // unchanged
  });

  it("is BLOCKED by a destructible BOX", () => {
    setCell(state.grid, 3, 4, state.mapWidth, packCell(ENTITY_BOX, 1, POWERUP_NONE));
    const pos = resolvePlayerMove(state, "p1", "SOUTH");
    expect(pos).toEqual({ x: 3, y: 3 });
  });

  it("is BLOCKED by a live BOMB", () => {
    setCell(state.grid, 4, 3, state.mapWidth, packCell(ENTITY_BOMB, 0, POWERUP_NONE));
    const pos = resolvePlayerMove(state, "p1", "EAST");
    expect(pos).toEqual({ x: 3, y: 3 });
  });

  it("is NOT blocked by a POWERUP cell (walkable)", () => {
    setCell(state.grid, 2, 3, state.mapWidth, packCell(ENTITY_POWERUP, 0, POWERUP_BOMB_UP));
    const pos = resolvePlayerMove(state, "p1", "WEST");
    expect(pos).toEqual({ x: 2, y: 3 }); // allowed
  });

  it("a dead player cannot move", () => {
    const player = state.players.get("p1")!;
    player.alive = false;
    const pos = resolvePlayerMove(state, "p1", "NORTH");
    expect(pos).toEqual({ x: 3, y: 3 }); // unchanged
  });

  it("returns current position for an unknown direction", () => {
    const pos = resolvePlayerMove(state, "p1", "DIAGONAL");
    expect(pos).toEqual({ x: 3, y: 3 });
  });

  it("does not block movement through another player's cell", () => {
    // Add second player at (3, 2) — player p1 should be able to move there
    const p2: PlayerState = {
      id: "p2",
      pos: { x: 3, y: 2 },
      alive: true,
      spectator: false,
      bombLimit: 1,
      activeBombs: 0,
      firepower: 1,
      speed: 1,
    };
    state.players.set("p2", p2);
    // The grid cell at (3,2) is EMPTY — only physics blocks matter (FR-2.1)
    const pos = resolvePlayerMove(state, "p1", "NORTH");
    expect(pos).toEqual({ x: 3, y: 2 }); // allowed (pass-through)
  });
});

// ---------------------------------------------------------------------------
// tryCollectPowerup
// ---------------------------------------------------------------------------

describe("tryCollectPowerup", () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it("returns null when standing on an empty cell", () => {
    const result = tryCollectPowerup(state, "p1");
    expect(result).toBeNull();
  });

  it("returns null when standing on a wall cell", () => {
    setCell(state.grid, 3, 3, state.mapWidth, packCell(ENTITY_WALL, 0, 0));
    const result = tryCollectPowerup(state, "p1");
    expect(result).toBeNull();
  });

  it("collects BOMB_UP and increments bombLimit", () => {
    setCell(state.grid, 3, 3, state.mapWidth, packCell(ENTITY_POWERUP, 0, POWERUP_BOMB_UP));
    const player = state.players.get("p1")!;
    const before = player.bombLimit;

    const result = tryCollectPowerup(state, "p1");

    expect(result).toBe("BOMB_UP");
    expect(player.bombLimit).toBe(before + 1);
  });

  it("collects FIRE_UP and increments firepower", () => {
    setCell(state.grid, 3, 3, state.mapWidth, packCell(ENTITY_POWERUP, 0, POWERUP_FIRE_UP));
    const player = state.players.get("p1")!;
    const before = player.firepower;

    const result = tryCollectPowerup(state, "p1");

    expect(result).toBe("FIRE_UP");
    expect(player.firepower).toBe(before + 1);
  });

  it("collects SPEED_UP and increments speed", () => {
    setCell(state.grid, 3, 3, state.mapWidth, packCell(ENTITY_POWERUP, 0, POWERUP_SPEED_UP));
    const player = state.players.get("p1")!;
    const before = player.speed;

    const result = tryCollectPowerup(state, "p1");

    expect(result).toBe("SPEED_UP");
    expect(player.speed).toBe(before + 1);
  });

  it("returns null for a dead player", () => {
    setCell(state.grid, 3, 3, state.mapWidth, packCell(ENTITY_POWERUP, 0, POWERUP_BOMB_UP));
    state.players.get("p1")!.alive = false;
    const result = tryCollectPowerup(state, "p1");
    expect(result).toBeNull();
  });

  it("returns null for an unknown player id", () => {
    const result = tryCollectPowerup(state, "nobody");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyPowerupById
// ---------------------------------------------------------------------------

describe("applyPowerupById", () => {
  function makePlayer(): PlayerState {
    return {
      id: "p1",
      pos: { x: 0, y: 0 },
      alive: true,
      spectator: false,
      bombLimit: 1,
      activeBombs: 0,
      firepower: 1,
      speed: 1,
    };
  }

  it("BOMB_UP increments bombLimit", () => {
    const p = makePlayer();
    applyPowerupById(p, POWERUP_BOMB_UP);
    expect(p.bombLimit).toBe(2);
  });

  it("FIRE_UP increments firepower", () => {
    const p = makePlayer();
    applyPowerupById(p, POWERUP_FIRE_UP);
    expect(p.firepower).toBe(2);
  });

  it("SPEED_UP increments speed", () => {
    const p = makePlayer();
    applyPowerupById(p, POWERUP_SPEED_UP);
    expect(p.speed).toBe(2);
  });

  it("returns null for an unknown typeId", () => {
    const p = makePlayer();
    const result = applyPowerupById(p, 99);
    expect(result).toBeNull();
  });

  it("can stack multiple FIRE_UP applications", () => {
    const p = makePlayer();
    applyPowerupById(p, POWERUP_FIRE_UP);
    applyPowerupById(p, POWERUP_FIRE_UP);
    applyPowerupById(p, POWERUP_FIRE_UP);
    expect(p.firepower).toBe(4);
  });
});

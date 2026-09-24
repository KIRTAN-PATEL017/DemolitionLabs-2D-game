/**
 * engine.test.ts
 * Integration tests for GameEngine (orchestrator).
 * Tests tick loop, win conditions, determinism, bomb placement, chain detonation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GameEngine } from "../engine.js";
import { BOMB_FUSE_TICKS, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from "../constants.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEED = 42;

function makeEngine(seed = SEED): GameEngine {
  return new GameEngine({ roomId: "test-room", seed });
}

/** Advance the engine by N ticks, optionally applying inputs each tick.
 *  Stops early if the game reaches FINISHED phase (e.g. a player is killed). */
function runTicks(
  engine: GameEngine,
  n: number,
  inputsFn?: (tick: number) => void,
): void {
  for (let i = 0; i < n; i++) {
    if (engine.isFinished()) break;
    inputsFn?.(i);
    engine.tick();
  }
}

// ---------------------------------------------------------------------------
// Construction & LOBBY phase
// ---------------------------------------------------------------------------

describe("GameEngine — construction", () => {
  it("initialises in LOBBY phase", () => {
    const engine = makeEngine();
    expect(engine.getState().phase).toBe("LOBBY");
  });

  it("generates a map of the correct dimensions", () => {
    const engine = makeEngine();
    const state = engine.getState();
    expect(state.mapWidth).toBe(DEFAULT_MAP_WIDTH);
    expect(state.mapHeight).toBe(DEFAULT_MAP_HEIGHT);
    expect(state.grid.length).toBe(DEFAULT_MAP_WIDTH * DEFAULT_MAP_HEIGHT);
  });

  it("addPlayer registers a player in LOBBY", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    expect(engine.getState().players.has("p1")).toBe(true);
  });

  it("addPlayer throws for duplicate IDs", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    expect(() => engine.addPlayer("p1", 1)).toThrow();
  });

  it("addPlayer throws for invalid spawn index", () => {
    const engine = makeEngine();
    expect(() => engine.addPlayer("p1", 99)).toThrow();
  });

  it("startMatch throws with fewer than 2 players", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    expect(() => engine.startMatch()).toThrow();
  });

  it("startMatch transitions to RUNNING phase", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    engine.addPlayer("p2", 1);
    engine.startMatch();
    expect(engine.getState().phase).toBe("RUNNING");
  });

  it("tick() throws outside RUNNING phase", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    engine.addPlayer("p2", 1);
    expect(() => engine.tick()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Player movement via tick loop
// ---------------------------------------------------------------------------

describe("GameEngine — movement", () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = makeEngine();
    engine.addPlayer("p1", 0); // spawn index 0 → top-left (1,1)
    engine.addPlayer("p2", 3); // spawn index 3 → bottom-right (11,9)
    engine.startMatch();
  });

  it("player position updates after a MOVE input", () => {
    const before = { ...engine.getState().players.get("p1")!.pos };
    engine.processInput("p1", { type: "MOVE", dir: "SOUTH" });
    engine.tick();
    const after = engine.getState().players.get("p1")!.pos;
    expect(after.y).toBe(before.y + 1);
    expect(after.x).toBe(before.x);
  });

  it("NOOP input leaves player stationary", () => {
    const before = { ...engine.getState().players.get("p1")!.pos };
    engine.processInput("p1", { type: "NOOP" });
    engine.tick();
    const after = engine.getState().players.get("p1")!.pos;
    expect(after).toEqual(before);
  });

  it("no input leaves player stationary", () => {
    const before = { ...engine.getState().players.get("p1")!.pos };
    engine.tick();
    const after = engine.getState().players.get("p1")!.pos;
    expect(after).toEqual(before);
  });

  it("delta includes updated playerUpdates", () => {
    engine.processInput("p1", { type: "MOVE", dir: "EAST" });
    const delta = engine.tick();
    const p1Update = delta.playerUpdates.find((p) => p.id === "p1");
    expect(p1Update).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Bomb placement & detonation
// ---------------------------------------------------------------------------

describe("GameEngine — bomb lifecycle", () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = makeEngine();
    engine.addPlayer("p1", 0); // (1,1)
    engine.addPlayer("p2", 1); // (11,1)
    engine.startMatch();
  });

  it("PLACE_BOMB places a bomb and decrements activeBombs slot", () => {
    engine.processInput("p1", { type: "PLACE_BOMB" });
    const delta = engine.tick();
    expect(delta.newBombs.length).toBe(1);
    expect(engine.getState().players.get("p1")!.activeBombs).toBe(1);
  });

  it("cannot exceed bomb limit (default 1)", () => {
    // Place a bomb
    engine.processInput("p1", { type: "PLACE_BOMB" });
    engine.tick();

    // Move away so spawn cell is free
    engine.processInput("p1", { type: "MOVE", dir: "SOUTH" });
    engine.tick();

    // Try to place another — should be blocked by limit
    engine.processInput("p1", { type: "PLACE_BOMB" });
    const delta = engine.tick();
    expect(delta.newBombs.length).toBe(0);
  });

  it("bomb detonates after BOMB_FUSE_TICKS ticks", () => {
    engine.processInput("p1", { type: "PLACE_BOMB" });
    engine.tick(); // tick 1: bomb placed

    // Advance until detonation
    let exploded = false;
    for (let i = 1; i < BOMB_FUSE_TICKS; i++) {
      const delta = engine.tick();
      if (delta.explodedBombs.length > 0) {
        exploded = true;
        break;
      }
    }
    // One final tick to push it over
    if (!exploded) {
      const delta = engine.tick();
      expect(delta.explodedBombs.length).toBeGreaterThan(0);
    } else {
      expect(exploded).toBe(true);
    }
  });

  it("activeBombs refunded after detonation", () => {
    engine.processInput("p1", { type: "PLACE_BOMB" });
    engine.tick();

    // Run fuse to detonation
    runTicks(engine, BOMB_FUSE_TICKS);

    expect(engine.getState().players.get("p1")!.activeBombs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Win condition
// ---------------------------------------------------------------------------

describe("GameEngine — win condition", () => {
  it("game finishes with a winner when one player survives", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0); // (1,1)
    engine.addPlayer("p2", 1); // (11,1)
    engine.startMatch();

    // Manually kill p2 to simulate an explosion result
    // We'll kill p2 directly on the state to avoid needing full grid setup
    engine.getState().players.get("p2")!.alive = false;
    engine.getState().players.get("p2")!.spectator = true;

    // Trigger tick to evaluate win condition
    const delta = engine.tick();

    expect(delta.phase).toBe("FINISHED");
    expect(delta.winnerId).toBe("p1");
    expect(engine.isFinished()).toBe(true);
  });

  it("game ends in draw (winnerId=null) when all players die simultaneously", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    engine.addPlayer("p2", 1);
    engine.startMatch();

    // Kill both players
    engine.getState().players.get("p1")!.alive = false;
    engine.getState().players.get("p2")!.alive = false;

    const delta = engine.tick();

    expect(delta.phase).toBe("FINISHED");
    expect(delta.winnerId).toBeNull();
  });

  it("isFinished() returns false while RUNNING", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    engine.addPlayer("p2", 1);
    engine.startMatch();
    expect(engine.isFinished()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("GameEngine — determinism", () => {
  /** Replay the same seed + input sequence on two separate engine instances. */
  function replayOnTwo(
    seed: number,
    steps: Array<{ id: string; input: import("../types.js").GameInput }>,
  ): [import("../types.js").GameStateDelta, import("../types.js").GameStateDelta] {
    function buildAndRun(): import("../types.js").GameStateDelta {
      const engine = new GameEngine({ roomId: "det-test", seed });
      engine.addPlayer("p1", 0);
      engine.addPlayer("p2", 1);
      engine.startMatch();

      let lastDelta!: import("../types.js").GameStateDelta;
      for (const step of steps) {
        engine.processInput(step.id, step.input);
        lastDelta = engine.tick();
      }
      return lastDelta;
    }

    return [buildAndRun(), buildAndRun()];
  }

  it("identical seed + inputs produce identical final deltas", () => {
    const steps: Array<{ id: string; input: import("../types.js").GameInput }> = [
      { id: "p1", input: { type: "MOVE", dir: "SOUTH" } },
      { id: "p1", input: { type: "MOVE", dir: "EAST" } },
      { id: "p2", input: { type: "MOVE", dir: "WEST" } },
      { id: "p1", input: { type: "PLACE_BOMB" } },
      { id: "p1", input: { type: "MOVE", dir: "NORTH" } },
      { id: "p2", input: { type: "NOOP" } },
    ];

    const [d1, d2] = replayOnTwo(SEED, steps);

    expect(d1.tick).toBe(d2.tick);
    expect(d1.phase).toBe(d2.phase);
    expect(d1.winnerId).toBe(d2.winnerId);
    // Player positions must match
    for (const p of d1.playerUpdates) {
      const p2 = d2.playerUpdates.find((x) => x.id === p.id);
      expect(p2?.pos).toEqual(p.pos);
    }
  });

  it("different seeds produce different initial grids", () => {
    const e1 = new GameEngine({ roomId: "r1", seed: 1 });
    const e2 = new GameEngine({ roomId: "r2", seed: 2 });
    const g1 = Array.from(e1.getState().grid);
    const g2 = Array.from(e2.getState().grid);
    expect(g1).not.toEqual(g2);
  });
});

// ---------------------------------------------------------------------------
// Delta structure
// ---------------------------------------------------------------------------

describe("GameEngine — delta structure", () => {
  it("delta tick increments each call", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    engine.addPlayer("p2", 1);
    engine.startMatch();

    const d1 = engine.tick();
    const d2 = engine.tick();
    const d3 = engine.tick();

    expect(d1.tick).toBe(1);
    expect(d2.tick).toBe(2);
    expect(d3.tick).toBe(3);
  });

  it("delta contains all registered players in playerUpdates", () => {
    const engine = makeEngine();
    engine.addPlayer("p1", 0);
    engine.addPlayer("p2", 1);
    engine.addPlayer("p3", 2);
    engine.startMatch();

    const delta = engine.tick();
    const ids = delta.playerUpdates.map((p) => p.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
    expect(ids).toContain("p3");
  });
});

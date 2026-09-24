/**
 * message-codec.test.ts
 * Tests for: encode, decode — all message types, edge cases
 */

import { describe, it, expect } from "vitest";
import { encode, decode } from "../message-codec.js";
import type { ServerMessage, ClientMessage } from "../message-codec.js";

// ---------------------------------------------------------------------------
// encode (ServerMessage → JSON string)
// ---------------------------------------------------------------------------

describe("encode", () => {
  it("encodes ROOM_JOINED", () => {
    const msg: ServerMessage = {
      type: "ROOM_JOINED",
      roomId: "room-1",
      playerId: "p1",
      spawnIndex: 0,
      seed: 42,
      mapWidth: 13,
      mapHeight: 11,
    };
    const result = encode(msg);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.type).toBe("ROOM_JOINED");
    expect(parsed.roomId).toBe("room-1");
    expect(parsed.seed).toBe(42);
  });

  it("encodes MATCH_START", () => {
    const msg: ServerMessage = { type: "MATCH_START", tick: 0 };
    const result = encode(msg);
    expect(result).not.toBeNull();
    expect(JSON.parse(result!).type).toBe("MATCH_START");
  });

  it("encodes TICK with a delta", () => {
    const msg: ServerMessage = {
      type: "TICK",
      delta: {
        tick: 5,
        playerUpdates: [],
        newBombs: [],
        explodedBombs: [],
        cellChanges: [],
        spawnedPowerups: [],
        collectedPowerups: [],
        killedPlayerIds: [],
        phase: "RUNNING",
        winnerId: null,
      },
    };
    const result = encode(msg);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.type).toBe("TICK");
    expect(parsed.delta.tick).toBe(5);
  });

  it("encodes MATCH_END with winner", () => {
    const msg: ServerMessage = { type: "MATCH_END", winnerId: "p1", finalTick: 120 };
    const result = encode(msg);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.winnerId).toBe("p1");
    expect(parsed.finalTick).toBe(120);
  });

  it("encodes MATCH_END with null winner (draw)", () => {
    const msg: ServerMessage = { type: "MATCH_END", winnerId: null, finalTick: 60 };
    const result = encode(msg);
    expect(result).not.toBeNull();
    expect(JSON.parse(result!).winnerId).toBeNull();
  });

  it("encodes PONG", () => {
    const msg: ServerMessage = { type: "PONG", ts: 1234, serverTs: 5678 };
    const result = encode(msg);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.ts).toBe(1234);
    expect(parsed.serverTs).toBe(5678);
  });

  it("encodes ERROR", () => {
    const msg: ServerMessage = { type: "ERROR", code: "ROOM_FULL", message: "Room is full" };
    const result = encode(msg);
    expect(result).not.toBeNull();
    expect(JSON.parse(result!).code).toBe("ROOM_FULL");
  });
});

// ---------------------------------------------------------------------------
// decode (raw string → ClientMessage | null)
// ---------------------------------------------------------------------------

describe("decode", () => {
  // --- Valid messages ---

  it("decodes INPUT MOVE_NORTH", () => {
    const raw = JSON.stringify({ type: "INPUT", payload: { type: "MOVE", dir: "NORTH" } });
    const result = decode(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("INPUT");
    if (result?.type === "INPUT") {
      expect(result.payload.type).toBe("MOVE");
      if (result.payload.type === "MOVE") {
        expect(result.payload.dir).toBe("NORTH");
      }
    }
  });

  it("decodes INPUT PLACE_BOMB", () => {
    const raw = JSON.stringify({ type: "INPUT", payload: { type: "PLACE_BOMB" } });
    const result = decode(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("INPUT");
  });

  it("decodes INPUT NOOP", () => {
    const raw = JSON.stringify({ type: "INPUT", payload: { type: "NOOP" } });
    const result = decode(raw);
    expect(result).not.toBeNull();
  });

  it("decodes PING", () => {
    const raw = JSON.stringify({ type: "PING", ts: 9999 });
    const result = decode(raw);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("PING");
    if (result?.type === "PING") {
      expect(result.ts).toBe(9999);
    }
  });

  // --- Invalid / malformed ---

  it("returns null for empty string", () => {
    expect(decode("")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(decode("{not json")).toBeNull();
  });

  it("returns null for JSON array (not object)", () => {
    expect(decode("[1,2,3]")).toBeNull();
  });

  it("returns null for unknown message type", () => {
    const raw = JSON.stringify({ type: "HACK", payload: {} });
    expect(decode(raw)).toBeNull();
  });

  it("returns null for INPUT with unknown direction", () => {
    const raw = JSON.stringify({ type: "INPUT", payload: { type: "MOVE", dir: "DIAGONAL" } });
    expect(decode(raw)).toBeNull();
  });

  it("returns null for INPUT with missing payload", () => {
    const raw = JSON.stringify({ type: "INPUT" });
    expect(decode(raw)).toBeNull();
  });

  it("returns null for PING with missing ts field", () => {
    const raw = JSON.stringify({ type: "PING" });
    expect(decode(raw)).toBeNull();
  });

  it("returns null for PING with non-number ts", () => {
    const raw = JSON.stringify({ type: "PING", ts: "not-a-number" });
    expect(decode(raw)).toBeNull();
  });

  // --- Round-trip symmetry ---

  it("encode→JSON.parse→decode round-trips PING through the wire", () => {
    // PING is client→server so we manually construct what a client would send
    const clientPing: ClientMessage = { type: "PING", ts: 42 };
    const wire = JSON.stringify(clientPing);
    const decoded = decode(wire);
    expect(decoded).toEqual(clientPing);
  });
});

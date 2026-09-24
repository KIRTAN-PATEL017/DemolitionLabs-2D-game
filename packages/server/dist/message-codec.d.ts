/**
 * message-codec.ts
 * ----------------
 * Step 2.3 — Wire protocol serialisation / deserialisation (JSON).
 *
 * All messages over the WebSocket connection are JSON strings.
 * This module is the single source of truth for the message schema.
 *
 * Inbound  (client → server): ClientMessage
 * Outbound (server → client): ServerMessage
 */
import type { GameInput, GameStateDelta } from "@demolition-labs/engine";
export type ClientMessage = {
    readonly type: "INPUT";
    readonly payload: GameInput;
} | {
    readonly type: "PING";
    readonly ts: number;
};
export type ServerMessage = {
    readonly type: "ROOM_JOINED";
    readonly roomId: string;
    readonly playerId: string;
    readonly spawnIndex: number;
    /** PRNG seed — client uses this to pre-generate the identical map locally. */
    readonly seed: number;
    readonly mapWidth: number;
    readonly mapHeight: number;
} | {
    readonly type: "MATCH_START";
    readonly tick: number;
} | {
    readonly type: "TICK";
    readonly delta: GameStateDelta;
} | {
    readonly type: "MATCH_END";
    readonly winnerId: string | null;
    readonly finalTick: number;
} | {
    readonly type: "PONG";
    /** Echo of the client's timestamp — used to compute RTT. */
    readonly ts: number;
    readonly serverTs: number;
} | {
    readonly type: "ERROR";
    readonly code: string;
    readonly message: string;
};
export declare const ERR_ROOM_FULL = "ROOM_FULL";
export declare const ERR_MATCH_STARTED = "MATCH_STARTED";
export declare const ERR_INVALID_MESSAGE = "INVALID_MESSAGE";
/**
 * Serialise a ServerMessage to a JSON string for transmission.
 * Returns null if serialisation fails (should never happen in practice).
 */
export declare function encode(msg: ServerMessage): string | null;
/**
 * Parse and validate an inbound raw WebSocket message.
 *
 * Returns a typed `ClientMessage` on success, or `null` if:
 *   - The raw string is not valid JSON
 *   - The parsed object does not match a known ClientMessage type
 *   - Required fields are missing or have wrong types
 *
 * Never throws — all errors are absorbed and returned as null.
 */
export declare function decode(raw: string): ClientMessage | null;
//# sourceMappingURL=message-codec.d.ts.map
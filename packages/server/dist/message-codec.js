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
// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------
export const ERR_ROOM_FULL = "ROOM_FULL";
export const ERR_MATCH_STARTED = "MATCH_STARTED";
export const ERR_INVALID_MESSAGE = "INVALID_MESSAGE";
// ---------------------------------------------------------------------------
// Encode (server → wire)
// ---------------------------------------------------------------------------
/**
 * Serialise a ServerMessage to a JSON string for transmission.
 * Returns null if serialisation fails (should never happen in practice).
 */
export function encode(msg) {
    try {
        return JSON.stringify(msg);
    }
    catch {
        return null;
    }
}
// ---------------------------------------------------------------------------
// Decode (wire → client)
// ---------------------------------------------------------------------------
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
export function decode(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return null;
    }
    if (typeof parsed !== "object" || parsed === null)
        return null;
    const msg = parsed;
    switch (msg["type"]) {
        case "INPUT": {
            const payload = msg["payload"];
            if (!isValidGameInput(payload))
                return null;
            return { type: "INPUT", payload };
        }
        case "PING": {
            if (typeof msg["ts"] !== "number")
                return null;
            return { type: "PING", ts: msg["ts"] };
        }
        default:
            return null;
    }
}
// ---------------------------------------------------------------------------
// Internal validators
// ---------------------------------------------------------------------------
function isValidGameInput(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const v = value;
    switch (v["type"]) {
        case "MOVE":
            return (v["dir"] === "NORTH" ||
                v["dir"] === "SOUTH" ||
                v["dir"] === "EAST" ||
                v["dir"] === "WEST");
        case "PLACE_BOMB":
            return true;
        case "NOOP":
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=message-codec.js.map
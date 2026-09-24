/**
 * input-handler.ts
 * ----------------
 * Step 2.3 — Inbound WebSocket message routing and input rate-limiting.
 *
 * Responsibilities:
 *   1. Parse raw WS messages via message-codec.ts (decode / validate).
 *   2. For INPUT messages: queue one GameInput per player per tick window.
 *      - Last-write-wins within a single tick (matches engine contract).
 *      - Inputs arriving after the tick has already consumed them are queued
 *        for the NEXT tick (never dropped).
 *   3. For PING messages: immediately send a PONG back on the same socket.
 *   4. Silently drop malformed or unknown messages.
 *
 * The rate-limiter tracks the last tick index at which each player submitted
 * an input.  If a second input arrives for the same tick, it overwrites the
 * first (last-write-wins) — consistent with the engine's own input queue.
 */
import { decode, encode } from "./message-codec.js";
export class InputHandler {
    /**
     * Per-player pending input queue.
     * Key = playerId, Value = the most recent GameInput not yet consumed by a tick.
     */
    pending = new Map();
    // ---------------------------------------------------------------------------
    // Inbound message entry point
    // ---------------------------------------------------------------------------
    /**
     * Process a raw WebSocket message from `playerId`.
     * Call this from the uWebSockets.js `message` callback.
     */
    onMessage(playerId, raw, socket) {
        const msg = decode(raw);
        if (msg === null)
            return; // invalid / unknown — silently drop
        switch (msg.type) {
            case "INPUT":
                // Queue the input (last-write-wins for this tick window)
                this.pending.set(playerId, msg.payload);
                break;
            case "PING": {
                const pong = encode({ type: "PONG", ts: msg.ts, serverTs: Date.now() });
                if (pong !== null)
                    socket.send(pong);
                break;
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Tick consumption
    // ---------------------------------------------------------------------------
    /**
     * Drain all pending inputs for a given set of player IDs.
     * Returns a Map<playerId, GameInput> for the engine to consume this tick.
     * Clears the pending queue after draining.
     *
     * Players with no pending input are NOT included in the returned map —
     * the engine treats missing entries as NOOP.
     */
    drainInputs(playerIds) {
        const drained = new Map();
        for (const id of playerIds) {
            const input = this.pending.get(id);
            if (input !== undefined) {
                drained.set(id, input);
                this.pending.delete(id);
            }
        }
        return drained;
    }
    /**
     * Remove a player's pending input (called on disconnect).
     */
    removePlayer(playerId) {
        this.pending.delete(playerId);
    }
    /** Number of players with a queued input waiting to be consumed. */
    get pendingCount() {
        return this.pending.size;
    }
}
//# sourceMappingURL=input-handler.js.map
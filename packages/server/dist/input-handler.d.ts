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
import type { GameInput } from "@demolition-labs/engine";
export interface SocketLike {
    send(msg: string): void;
}
export declare class InputHandler {
    /**
     * Per-player pending input queue.
     * Key = playerId, Value = the most recent GameInput not yet consumed by a tick.
     */
    private readonly pending;
    /**
     * Process a raw WebSocket message from `playerId`.
     * Call this from the uWebSockets.js `message` callback.
     */
    onMessage(playerId: string, raw: string, socket: SocketLike): void;
    /**
     * Drain all pending inputs for a given set of player IDs.
     * Returns a Map<playerId, GameInput> for the engine to consume this tick.
     * Clears the pending queue after draining.
     *
     * Players with no pending input are NOT included in the returned map —
     * the engine treats missing entries as NOOP.
     */
    drainInputs(playerIds: Iterable<string>): Map<string, GameInput>;
    /**
     * Remove a player's pending input (called on disconnect).
     */
    removePlayer(playerId: string): void;
    /** Number of players with a queued input waiting to be consumed. */
    get pendingCount(): number;
}
//# sourceMappingURL=input-handler.d.ts.map
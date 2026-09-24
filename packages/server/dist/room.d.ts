/**
 * room.ts
 * -------
 * Step 2.2 & 2.4 — Room state container.
 *
 * A Room is the central unit of gameplay. It:
 *   - Holds a map of connected player sockets.
 *   - Wraps a GameEngine instance (created at match start).
 *   - Owns a TickLoop that drives the engine at 20 Hz.
 *   - Broadcasts GameStateDelta JSON to all sockets (alive + spectators) per tick.
 *   - Manages the LOBBY → RUNNING → FINISHED lifecycle.
 *
 * uWebSockets.js note:
 *   `WebSocket` objects from uws are valid only while the connection is open.
 *   We store them in a Map and remove them in the `close` handler.
 *   All `send()` calls are guarded — a closed socket is a no-op in uws.
 */
import { type MatchPhase } from "@demolition-labs/engine";
import type { SocketLike } from "./input-handler.js";
export declare class Room {
    readonly id: string;
    readonly seed: number;
    private engine;
    private readonly loop;
    private readonly inputHandler;
    /** player ID → socket */
    private readonly sockets;
    /** Ordered list of player IDs (used for spawn index assignment). */
    private readonly playerOrder;
    private _phase;
    private cleanupTimer;
    /** Called by RoomRegistry when the room is ready to be destroyed. */
    onEmpty?: () => void;
    constructor(roomId: string, seed?: number);
    /**
     * Attempt to add a player to the room.
     *
     * @returns `true` on success, `false` if the room is full or already started.
     *          On failure, an ERROR message is sent to the socket before returning.
     */
    join(playerId: string, socket: SocketLike): boolean;
    /**
     * Remove a player from the room (disconnect or voluntary leave).
     * If the match is running, the player remains as a spectator in the engine
     * but their socket is removed so they no longer receive updates.
     */
    leave(playerId: string): void;
    /**
     * Attempt to start the match.
     * Requires at least MIN_PLAYERS connected players.
     *
     * @returns `true` if the match started, `false` if conditions not met.
     */
    tryStart(): boolean;
    get isStartable(): boolean;
    get phase(): MatchPhase;
    get playerCount(): number;
    get isEmpty(): boolean;
    private _tick;
    /** Send a JSON string to every connected socket. Null messages are skipped. */
    private _broadcast;
    /** Tear down the loop and timers cleanly. */
    private _shutdown;
    /** Route a raw inbound WS message from a player into the input pipeline. */
    handleMessage(playerId: string, raw: string, socket: SocketLike): void;
}
//# sourceMappingURL=room.d.ts.map
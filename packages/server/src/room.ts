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

import {
  GameEngine,
  type GameStateDelta,
  type RoomConfig,
  type MatchPhase,
} from "@demolition-labs/engine";
import { TickLoop } from "./tick-loop.js";
import { InputHandler } from "./input-handler.js";
import { encode, ERR_MATCH_STARTED, ERR_ROOM_FULL } from "./message-codec.js";
import type { SocketLike } from "./input-handler.js";
import { EventLogger } from "./EventLogger.js";
import { publishMatchLog } from "./kafka.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

/** Milliseconds after FINISHED before the room is torn down. */
const ROOM_CLEANUP_DELAY_MS = 5_000;

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

export class Room {
  readonly id: string;
  readonly seed: number;

  private engine: GameEngine | null = null;
  private logger?: EventLogger;
  private readonly loop: TickLoop;
  private readonly inputHandler: InputHandler;

  /** player ID → socket */
  private readonly sockets: Map<string, SocketLike> = new Map();

  /** Ordered list of player IDs (used for spawn index assignment). */
  private readonly playerOrder: string[] = [];

  private _phase: MatchPhase = "LOBBY";
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  /** Called by RoomRegistry when the room is ready to be destroyed. */
  onEmpty?: () => void;

  constructor(roomId: string, seed?: number) {
    this.id = roomId;
    this.seed = seed ?? Math.floor(Math.random() * 0xffff_ffff);
    this.inputHandler = new InputHandler();
    this.loop = new TickLoop(() => this._tick(), 20);
  }

  // ---------------------------------------------------------------------------
  // Player lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Attempt to add a player to the room.
   *
   * @returns `true` on success, `false` if the room is full or already started.
   *          On failure, an ERROR message is sent to the socket before returning.
   */
  join(playerId: string, socket: SocketLike): boolean {
    if (this._phase !== "LOBBY") {
      socket.send(
        encode({ type: "ERROR", code: ERR_MATCH_STARTED, message: "Match already in progress" }) ?? "",
      );
      return false;
    }
    if (this.sockets.size >= MAX_PLAYERS) {
      socket.send(
        encode({ type: "ERROR", code: ERR_ROOM_FULL, message: "Room is full" }) ?? "",
      );
      return false;
    }

    this.sockets.set(playerId, socket);
    this.playerOrder.push(playerId);

    const spawnIndex = this.playerOrder.length - 1;

    // Confirm join
    socket.send(
      encode({
        type: "ROOM_JOINED",
        roomId: this.id,
        playerId,
        spawnIndex,
        seed: this.seed,
        mapWidth: 13,
        mapHeight: 11,
      }) ?? "",
    );

    return true;
  }

  /**
   * Remove a player from the room (disconnect or voluntary leave).
   * If the match is running, the player remains as a spectator in the engine
   * but their socket is removed so they no longer receive updates.
   */
  leave(playerId: string): void {
    this.sockets.delete(playerId);
    this.inputHandler.removePlayer(playerId);

    if (this.sockets.size === 0) {
      this._shutdown();
      this.onEmpty?.();
    }
  }

  // ---------------------------------------------------------------------------
  // Match lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Attempt to start the match.
   * Requires at least MIN_PLAYERS connected players.
   *
   * @returns `true` if the match started, `false` if conditions not met.
   */
  tryStart(): boolean {
    if (this._phase !== "LOBBY") return false;
    if (this.sockets.size < MIN_PLAYERS) return false;

    const config: RoomConfig = {
      roomId: this.id,
      seed: this.seed,
      mapWidth: 13,
      mapHeight: 11,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
    };

    this.engine = new GameEngine(config);
    this.logger = new EventLogger(this.id, this.seed, Array.from(this.playerOrder));

    for (const [idx, playerId] of this.playerOrder.entries()) {
      this.engine.addPlayer(playerId, idx);
    }

    this.engine.startMatch();
    this._phase = "RUNNING";

    this._broadcast(encode({ type: "MATCH_START", tick: 0 }));
    this.loop.start();

    return true;
  }

  get isStartable(): boolean {
    return this._phase === "LOBBY" && this.sockets.size >= MIN_PLAYERS;
  }

  // ---------------------------------------------------------------------------
  // State accessors
  // ---------------------------------------------------------------------------

  get phase(): MatchPhase {
    return this._phase;
  }

  get playerCount(): number {
    return this.sockets.size;
  }

  get isEmpty(): boolean {
    return this.sockets.size === 0;
  }

  // ---------------------------------------------------------------------------
  // Private — tick (called by TickLoop every 50 ms)
  // ---------------------------------------------------------------------------

  private _tick(): void {
    if (!this.engine || this._phase !== "RUNNING") return;

    // 1. Drain queued inputs and feed into engine
    const inputs = this.inputHandler.drainInputs(this.playerOrder);
    if (this.logger) this.logger.logTick(this.engine.state.tick, inputs);

    for (const [playerId, input] of inputs) {
      this.engine.processInput(playerId, input);
    }

    // 2. Advance engine state
    const delta: GameStateDelta = this.engine.tick();

    // 3. Broadcast delta to all connected sockets (alive + spectators — FR-2.6)
    const tickMsg = encode({ type: "TICK", delta });
    this._broadcast(tickMsg);

    // 4. Handle match end
    if (this.engine.isFinished()) {
      this._phase = "FINISHED";
      this.loop.stop();

      const endMsg = encode({
        type: "MATCH_END",
        winnerId: delta.winnerId,
        finalTick: delta.tick,
      });
      this._broadcast(endMsg);

      // Publish the match log to Kafka
      if (this.logger) {
        publishMatchLog(this.logger.getLog());
      }

      // Schedule cleanup
      this.cleanupTimer = setTimeout(() => {
        this._shutdown();
        this.onEmpty?.();
      }, ROOM_CLEANUP_DELAY_MS);
    }
  }

  // ---------------------------------------------------------------------------
  // Private — helpers
  // ---------------------------------------------------------------------------

  /** Send a JSON string to every connected socket. Null messages are skipped. */
  private _broadcast(msg: string | null): void {
    if (msg === null) return;
    for (const socket of this.sockets.values()) {
      try {
        socket.send(msg);
      } catch {
        // Socket may have closed between the check and the send — ignore
      }
    }
  }

  /** Tear down the loop and timers cleanly. */
  private _shutdown(): void {
    this.loop.stop();
    if (this.cleanupTimer !== null) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // Disconnect all sockets so clients return to lobby
    for (const socket of this.sockets.values()) {
      if (socket.close) socket.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Public — expose input handler for server.ts to route messages into
  // ---------------------------------------------------------------------------

  /** Route a raw inbound WS message from a player into the input pipeline. */
  handleMessage(playerId: string, raw: string, socket: SocketLike): void {
    this.inputHandler.onMessage(playerId, raw, socket);
  }
}

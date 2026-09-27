/**
 * GameClient.ts
 * -------------
 * Step 3.2 — WebSocket transport layer for the browser client.
 *
 * Uses native browser WebSocket. Parses server messages and dispatches
 * them to typed listeners.  Handles PING/PONG latency measurement and
 * visibilitychange disconnection (Step 3.4).
 */

import type { GameStateDelta } from "@demolition-labs/engine";
import { PING_INTERVAL_MS } from "../constants.js";

// ---------------------------------------------------------------------------
// Message shapes (mirrors message-codec.ts on the server)
// ---------------------------------------------------------------------------

export interface RoomJoinedMsg {
  type: "ROOM_JOINED";
  roomId: string;
  playerId: string;
  spawnIndex: number;
  seed: number;
  mapWidth: number;
  mapHeight: number;
}

export interface MatchStartMsg  { type: "MATCH_START"; tick: number; }
export interface TickMsg        { type: "TICK"; delta: GameStateDelta; }
export interface MatchEndMsg    { type: "MATCH_END"; winnerId: string | null; finalTick: number; }
export interface ErrorMsg       { type: "ERROR"; code: string; message: string; }

type ServerMessage = RoomJoinedMsg | MatchStartMsg | TickMsg | MatchEndMsg | ErrorMsg
  | { type: "PONG"; ts: number; serverTs: number };

// ---------------------------------------------------------------------------
// Listener registry
// ---------------------------------------------------------------------------

type Listener<T> = (msg: T) => void;

interface Listeners {
  room_joined:  Listener<RoomJoinedMsg>[];
  match_start:  Listener<MatchStartMsg>[];
  tick:         Listener<TickMsg>[];
  match_end:    Listener<MatchEndMsg>[];
  error:        Listener<ErrorMsg>[];
  disconnected: Listener<void>[];
}

// ---------------------------------------------------------------------------
// GameClient
// ---------------------------------------------------------------------------

export class GameClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private _latencyMs = 0;
  private _roomId = "";

  private readonly listeners: Listeners = {
    room_joined:  [],
    match_start:  [],
    tick:         [],
    match_end:    [],
    error:        [],
    disconnected: [],
  };

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  connect(roomId: string): void {
    if (this.ws) this.disconnect();
    this._roomId = roomId;

    // In dev, Vite proxies /room/:id → ws://localhost:3001/room/:id
    // In prod, use VITE_WS_URL from env if available
    const serverUrl = import.meta.env["VITE_WS_URL"];
    let url: string;
    
    if (serverUrl) {
      url = `${serverUrl}/room/${encodeURIComponent(roomId)}`;
    } else {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      url = `${protocol}//${location.host}/room/${encodeURIComponent(roomId)}`;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen    = () => this._startPing();
    this.ws.onmessage = (ev: MessageEvent<string>) => this._onRawMessage(ev.data);
    this.ws.onclose   = () => this._onClose();
    this.ws.onerror   = () => this._onClose();

    // Step 3.4 — visibilitychange: disconnect when tab is hidden
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  disconnect(): void {
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    this._stopPing();
    if (this.ws) {
      this.ws.onclose = null; // suppress close event on intentional disconnect
      this.ws.close();
      this.ws = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Send
  // ---------------------------------------------------------------------------

  send(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  sendInput(type: "MOVE" | "PLACE_BOMB" | "NOOP", dir?: string): void {
    const payload =
      type === "MOVE"
        ? { type: "INPUT", payload: { type: "MOVE", dir } }
        : { type: "INPUT", payload: { type } };
    this.send(payload);
  }

  // ---------------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------------

  on(event: "room_joined",  fn: Listener<RoomJoinedMsg>): void;
  on(event: "match_start",  fn: Listener<MatchStartMsg>): void;
  on(event: "tick",         fn: Listener<TickMsg>): void;
  on(event: "match_end",    fn: Listener<MatchEndMsg>): void;
  on(event: "error",        fn: Listener<ErrorMsg>): void;
  on(event: "disconnected", fn: Listener<void>): void;
  on(event: keyof Listeners, fn: Listener<any>): void {
    (this.listeners[event] as Listener<any>[]).push(fn);
  }

  get latencyMs(): number { return this._latencyMs; }
  get roomId(): string    { return this._roomId; }
  get connected(): boolean { return this.ws?.readyState === WebSocket.OPEN; }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _onRawMessage(raw: string): void {
    let msg: ServerMessage;
    try { msg = JSON.parse(raw) as ServerMessage; }
    catch { return; }

    switch (msg.type) {
      case "ROOM_JOINED":  this._emit("room_joined",  msg); break;
      case "MATCH_START":  this._emit("match_start",  msg); break;
      case "TICK":         this._emit("tick",          msg); break;
      case "MATCH_END":    this._emit("match_end",     msg); break;
      case "ERROR":        this._emit("error",         msg); break;
      case "PONG":
        this._latencyMs = Date.now() - msg.ts;
        break;
    }
  }

  private _emit<K extends keyof Listeners>(
    event: K,
    msg: Parameters<Listeners[K][number]>[0],
  ): void {
    for (const fn of this.listeners[event] as Listener<typeof msg>[]) {
      fn(msg);
    }
  }

  private _onClose(): void {
    this._stopPing();
    this.ws = null;
    this._emit("disconnected", undefined as void);
  }

  private _startPing(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: "PING", ts: Date.now() });
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // Arrow function so `this` is bound when used as event listener
  private readonly _onVisibilityChange = (): void => {
    if (document.hidden) {
      this.send({ type: "INPUT", payload: { type: "NOOP" } });
      this.disconnect();
    }
  };
}

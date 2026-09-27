/**
 * server.ts
 * ---------
 * uWebSockets.js app entry point.
 *
 * Endpoints:
 *   GET  /health           → JSON health check (rooms, connections)
 *   WS   /room/:roomId     → join or create a room
 *
 * WebSocket lifecycle per connection:
 *   open    → join room; auto-start if MIN_PLAYERS met
 *   message → route to room.handleMessage()
 *   close   → room.leave(); registry cleans up empty rooms
 *
 * Environment variables:
 *   PORT   (default 3001)
 *   HOST   (default '0.0.0.0')
 */

import "dotenv/config";
import promClient from "prom-client";

// Initialize Prometheus metrics collection
promClient.collectDefaultMetrics();

// --- Custom Business Metrics ---
export const wsMessagesCounter = new promClient.Counter({
  name: "demolition_ws_messages_total",
  help: "Total number of WebSocket messages received from clients",
});

export const activeConnectionsGauge = new promClient.Gauge({
  name: "demolition_active_connections",
  help: "Current number of active WebSocket connections",
});

// uWebSockets.js ships a prebuilt native binary — imported as CommonJS
import uWS from "uWebSockets.js";
import { RoomRegistry } from "./room-registry.js";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";

const registry = new RoomRegistry();

// Per-socket user data stored by uws
interface SocketData {
  playerId: string;
  roomId: string;
}

const app = uWS.App();

// ---------------------------------------------------------------------------
// HTTP — /health
// ---------------------------------------------------------------------------

app.get("/health", (res) => {
  const body = JSON.stringify({
    status: "ok",
    rooms: registry.activeCount,
    connections: registry.totalConnections,
    uptime: process.uptime(),
  });
  res
    .writeHeader("Content-Type", "application/json")
    .writeHeader("Access-Control-Allow-Origin", "*")
    .end(body);
});

// ---------------------------------------------------------------------------
// HTTP — /metrics
// ---------------------------------------------------------------------------

app.get("/metrics", async (res, req) => {
  res.onAborted(() => {
    (res as any).aborted = true;
  });
  try {
    const metrics = await promClient.register.metrics();
    if (!(res as any).aborted) {
      res.writeHeader("Content-Type", promClient.register.contentType).end(metrics);
    }
  } catch (err) {
    if (!(res as any).aborted) {
      res.writeStatus("500 Internal Server Error").end("Error generating metrics");
    }
  }
});

// ---------------------------------------------------------------------------
// WebSocket — /room/:roomId
// ---------------------------------------------------------------------------

app.ws<SocketData>("/room/:roomId", {
  // uWebSockets.js compression options
  compression: uWS.SHARED_COMPRESSOR,
  maxPayloadLength: 1024, // 1 KB max inbound message
  idleTimeout: 60,        // disconnect idle sockets after 60 s

  upgrade(res, req, context) {
    const roomId = req.getParameter(0) || "default-room";
    // Generate a simple unique player ID (Phase 5 replaces with auth token)
    const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    res.upgrade<SocketData>(
      { playerId, roomId },
      req.getHeader("sec-websocket-key"),
      req.getHeader("sec-websocket-protocol"),
      req.getHeader("sec-websocket-extensions"),
      context,
    );
  },

  open(ws) {
    activeConnectionsGauge.inc();
    const { playerId, roomId } = ws.getUserData();
    console.log(`[Server] ${playerId} joining room '${roomId}'`);

    const room = registry.getOrCreate(roomId);
    const joined = room.join(playerId, {
      send: (msg: string) => {
        try { ws.send(msg, false); } catch { /* socket closed */ }
      },
    });

    if (!joined) {
      ws.close();
      return;
    }

    // Auto-start when MIN_PLAYERS are connected
    if (room.isStartable) {
      room.tryStart();
    }
  },

  message(ws, messageBuffer) {
    wsMessagesCounter.inc();
    const { playerId, roomId } = ws.getUserData();
    const room = registry.getOrCreate(roomId);
    const raw = Buffer.from(messageBuffer).toString("utf-8");
    room.handleMessage(playerId, raw, {
      send: (msg: string) => {
        try { ws.send(msg, false); } catch { /* socket closed */ }
      },
    });
  },

  close(ws) {
    activeConnectionsGauge.dec();
    const { playerId, roomId } = ws.getUserData();
    console.log(`[Server] ${playerId} left room '${roomId}'`);
    const room = registry.getOrCreate(roomId);
    room.leave(playerId);
  },
});

// ---------------------------------------------------------------------------
import { initKafka } from "./kafka.js";

// ---------------------------------------------------------------------------
// Listen
// ---------------------------------------------------------------------------

initKafka().then(() => {
  app.listen(HOST, PORT, (token) => {
    if (token) {
      console.log(`[Server] DemolitionLabs game server listening on ws://${HOST}:${PORT}`);
      console.log(`[Server] Health check: http://${HOST}:${PORT}/health`);
    } else {
      console.error(`[Server] Failed to bind to port ${PORT}`);
      process.exit(1);
    }
  });
}).catch(err => {
  console.error("[Server] Failed to initialize Kafka", err);
});

export { app };

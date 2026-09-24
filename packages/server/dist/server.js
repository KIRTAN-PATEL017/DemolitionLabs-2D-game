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
// uWebSockets.js ships a prebuilt native binary — imported as CommonJS
import uWS from "uWebSockets.js";
import { RoomRegistry } from "./room-registry.js";
const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const registry = new RoomRegistry();
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
// WebSocket — /room/:roomId
// ---------------------------------------------------------------------------
app.ws("/room/:roomId", {
    // uWebSockets.js compression options
    compression: uWS.SHARED_COMPRESSOR,
    maxPayloadLength: 1024, // 1 KB max inbound message
    idleTimeout: 60, // disconnect idle sockets after 60 s
    upgrade(res, req, context) {
        const roomId = req.getParameter(0) || "default-room";
        // Generate a simple unique player ID (Phase 5 replaces with auth token)
        const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        res.upgrade({ playerId, roomId }, req.getHeader("sec-websocket-key"), req.getHeader("sec-websocket-protocol"), req.getHeader("sec-websocket-extensions"), context);
    },
    open(ws) {
        const { playerId, roomId } = ws.getUserData();
        console.log(`[Server] ${playerId} joining room '${roomId}'`);
        const room = registry.getOrCreate(roomId);
        const joined = room.join(playerId, {
            send: (msg) => {
                try {
                    ws.send(msg, false);
                }
                catch { /* socket closed */ }
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
        const { playerId, roomId } = ws.getUserData();
        const room = registry.getOrCreate(roomId);
        const raw = Buffer.from(messageBuffer).toString("utf-8");
        room.handleMessage(playerId, raw, {
            send: (msg) => {
                try {
                    ws.send(msg, false);
                }
                catch { /* socket closed */ }
            },
        });
    },
    close(ws) {
        const { playerId, roomId } = ws.getUserData();
        console.log(`[Server] ${playerId} left room '${roomId}'`);
        const room = registry.getOrCreate(roomId);
        room.leave(playerId);
    },
});
// ---------------------------------------------------------------------------
// Listen
// ---------------------------------------------------------------------------
app.listen(HOST, PORT, (token) => {
    if (token) {
        console.log(`[Server] DemolitionLabs game server listening on ws://${HOST}:${PORT}`);
        console.log(`[Server] Health check: http://${HOST}:${PORT}/health`);
    }
    else {
        console.error(`[Server] Failed to bind to port ${PORT}`);
        process.exit(1);
    }
});
export { app };
//# sourceMappingURL=server.js.map
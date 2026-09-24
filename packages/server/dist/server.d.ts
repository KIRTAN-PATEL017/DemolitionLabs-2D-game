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
import uWS from "uWebSockets.js";
declare const app: uWS.TemplatedApp;
export { app };
//# sourceMappingURL=server.d.ts.map
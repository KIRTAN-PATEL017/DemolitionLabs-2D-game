/**
 * index.ts
 * --------
 * Public API barrel for @demolition-labs/server.
 * Exports the classes and types needed by integration tests and future
 * packages (e.g., a load-testing harness in Phase 5).
 */

export { Room } from "./room.js";
export { RoomRegistry } from "./room-registry.js";
export { TickLoop } from "./tick-loop.js";
export { InputHandler } from "./input-handler.js";
export { encode, decode } from "./message-codec.js";
export type { ClientMessage, ServerMessage } from "./message-codec.js";
export type { SocketLike } from "./input-handler.js";

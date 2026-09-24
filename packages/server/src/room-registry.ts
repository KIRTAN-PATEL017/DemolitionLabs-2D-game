/**
 * room-registry.ts
 * ----------------
 * Global registry of all active Room instances.
 *
 * Responsibilities:
 *   - Create a new Room on first request for a given roomId.
 *   - Return the existing Room for subsequent requests.
 *   - Destroy and remove rooms when they become empty.
 *   - Expose metrics for the /health endpoint.
 */

import { Room } from "./room.js";

export class RoomRegistry {
  private readonly rooms: Map<string, Room> = new Map();

  /**
   * Return the existing room for `roomId`, or create a new one.
   * The room registers its own `onEmpty` callback to self-destruct.
   */
  getOrCreate(roomId: string): Room {
    const existing = this.rooms.get(roomId);
    if (existing !== undefined) return existing;

    const room = new Room(roomId);
    room.onEmpty = () => {
      this.rooms.delete(roomId);
      console.log(`[RoomRegistry] Room '${roomId}' destroyed. Active rooms: ${this.rooms.size}`);
    };

    this.rooms.set(roomId, room);
    console.log(`[RoomRegistry] Room '${roomId}' created. Active rooms: ${this.rooms.size}`);
    return room;
  }

  /** Forcibly destroy a room (admin / error recovery). */
  destroy(roomId: string): void {
    this.rooms.delete(roomId);
  }

  /** Number of currently active rooms. */
  get activeCount(): number {
    return this.rooms.size;
  }

  /** Total number of connected sockets across all rooms. */
  get totalConnections(): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.playerCount;
    }
    return total;
  }
}

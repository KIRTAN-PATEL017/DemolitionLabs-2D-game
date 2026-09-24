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
export declare class RoomRegistry {
    private readonly rooms;
    /**
     * Return the existing room for `roomId`, or create a new one.
     * The room registers its own `onEmpty` callback to self-destruct.
     */
    getOrCreate(roomId: string): Room;
    /** Forcibly destroy a room (admin / error recovery). */
    destroy(roomId: string): void;
    /** Number of currently active rooms. */
    get activeCount(): number;
    /** Total number of connected sockets across all rooms. */
    get totalConnections(): number;
}
//# sourceMappingURL=room-registry.d.ts.map
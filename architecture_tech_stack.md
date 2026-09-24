# Architecture Design and Tech Stack Specification

## System: DemolitionLabs

---

## 1. Architecture Overview & Tech Stack (Node.js Centric)

| System Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Client Frontend** | **TypeScript + Phaser.js** (or PixiJS) | Lightweight 2D Canvas/WebGL rendering engine with built-in tilemap rendering and fast sprite batching optimized for Web browsers. |
| **Game Server Runtime** | **Node.js (TypeScript)** | Single-threaded event loop paired with native C++ networking extensions scales to thousands of isolated game loops. |
| **Transport Layer** | **`uWebSockets.js`** | High-performance C++ WebSocket binding for Node.js offering minimal latency and ultra-low overhead over standard WebSockets. |
| **Lobby & API Services** | **Node.js (Express / Fastify)** | Stateless REST / gRPC API for user auth, profile management, and matchmaking orchestration. |
| **In-Memory Cache / Queues** | **Redis Cluster** | High-speed matchmaking queues, session tracking, and cross-node room allocation state. |
| **Event Streaming** | **NATS / Apache Kafka** | High-throughput, non-blocking asynchronous event ingestion for game logs from room workers. |
| **Database & Object Storage** | **PostgreSQL + AWS S3** | Relational store for users, trophies, and match records; S3 for compressed deterministic replay files. |

---

## 2. Topology Diagram

```
                        +-----------------------------------+
                        |       Client Browser (Phaser)     |
                        +-----------------+-----------------+
                                          |
                      +-------------------+-------------------+
                      | HTTP / REST                           | WebSockets (WSS)
                      v                                       v
            +-------------------+                   +-------------------+
            |  API Gateway &    |                   | Game Server Node  |
            |  Matchmaker       |                   | (Node.js + uWS)   |
            +---------+---------+                   +---------+---------+
                      |                                       |
                      | Session Setup                         | Stream Events
                      v                                       v
            +-------------------+                   +-------------------+
            | Redis Cluster     |                   |  NATS / Kafka     |
            | (Queues & State)  |                   +---------+---------+
            +-------------------+                             |
                                                              v
                                                    +-------------------+
                                                    | Replay Persistence|
                                                    | (S3 + PostgreSQL) |
                                                    +-------------------+
```

---

## 3. Data & State Model (Server-Authoritative Grid)

### 3.1 Bitfield Grid Encoding
To ensure maximum cache efficiency, minimal memory allocation, and zero Garbage Collection pauses, the map grid is stored as a contiguous 1D TypedArray (`Uint16Array`). Each cell is packed into a 16-bit integer bitfield:

```
Bits [0..3]  : Entity Type (0: Empty, 1: Indestructible Wall, 2: Box, 3: Bomb, 4: Power-up)
Bits [4..7]  : Health / Durability (0 to 15 HP)
Bits [8..15] : Drop Payload ID (Power-up item type hidden inside box)
```

### 3.2 Server Collision & Passability Logic
```typescript
const ENTITY_MASK = 0x0F; // 0000000000001111

export function isCellWalkable(grid: Uint16Array, x: number, y: number, mapWidth: number): boolean {
  const index = y * mapWidth + x;
  const cell = grid[index];
  const type = cell & ENTITY_MASK;
  
  // Players pass through empty cells (0) and power-ups (4)
  // Indestructible Walls (1), Boxes (2), and Bombs (3) return false
  return type === 0 || type === 4;
}
```

---

## 4. Scalability & Latency Strategy for 100K CCU

1. **Server-Authoritative Input Pipeline:**
   * Clients send directional inputs (`MOVE_NORTH`, `PLACE_BOMB`), not coordinates.
   * Server executes a strict **20 Hz tick loop (50 ms window)**, validates inputs against grid bitmasks, calculates collisions/explosions, and broadcasts delta states.

2. **Garbage Collection (GC) Optimization:**
   * Pre-allocate memory buffers (`Uint16Array`) for rooms during startup.
   * Reuse object instances across ticks to prevent V8 engine heap allocations and avoid latency spikes caused by GC pauses.

3. **Asynchronous Replay Streaming:**
   * Instead of taking full map frame snapshots, room loops log only initial seeds and timestamped player input streams.
   * Input streams are flushed asynchronously to NATS/Kafka queues without interrupting the 50 ms tick loop execution.
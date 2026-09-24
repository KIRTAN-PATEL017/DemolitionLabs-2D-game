# Development Phases & Topological Sequence

## System: DemolitionLabs

---

## Topological Execution Pipeline

```
[Phase 1: Core Engine & Deterministic Grid] 
                     │
                     ▼
[Phase 2: Authoritative Server Loop] 
                     │
                     ▼
[Phase 3: Browser Client & Network Integration] 
                     │
                     ▼
[Phase 4: Persistence, Logging & Replays] 
                     │
                     ▼
[Phase 5: Matchmaking, Scale & Extensibility]
```

---

## Detailed Topological Steps

### Phase 1: Core Engine & Deterministic Grid Model
* **Step 1.1:** Define bitmask grid layout and data structures for Walls, Boxes, Bombs, and Power-ups in TypeScript.
* **Step 1.2:** Implement server-side collision resolution logic (Player-to-Grid, Player-to-Bomb, and Player-to-Player pass-through).
* **Step 1.3:** Build explosion raycast algorithms evaluating Cardinal directions ($N, S, E, W$) and box destruction handling.
* **Step 1.4:** Build power-up drop table manager and collection handlers upon box destruction.

---

### Phase 2: Server-Authoritative Loop (Node.js)
* **Step 2.1:** Implement a fixed 20 Hz (50 ms) tick loop runner in Node.js using high-resolution timers (`process.hrtime`).
* **Step 2.2:** Create Room state container supporting player slot assignment (min: 2, max: 4) and match state transitions (`LOBBY`, `RUNNING`, `FINISHED`).
* **Step 2.3:** Implement server-side input processing pipeline (queue incoming player inputs per tick, compute next state, emit deltas).
* **Step 2.4:** Add Spectator state handling: mark player state as `DEAD` on explosion overlap while keeping real-time data distribution pipelines active.

---

### Phase 3: Browser Client & Network Integration
* **Step 3.1:** Initialize Phaser.js / PixiJS tilemap scene and asset loading pipeline.
* **Step 3.2:** Implement `uWebSockets.js` client-server transport interface for low-latency WebSocket communication.
* **Step 3.3:** Build Client Prediction for local movement and Interpolation buffers for smooth remote player movement.
* **Step 3.4:** Add client visibility change handling (`visibilitychange`) to cleanly disconnect inactive clients and manage spectator view states.

---

### Phase 4: Persistence, Logging & Replay System
* **Step 4.1:** Build non-blocking Event Logger stream inside the server room loop.
* **Step 4.2:** Integrate NATS / Kafka queue producer to buffer match event logs upon room closure.
* **Step 4.3:** Set up worker service to flush completed match logs into AWS S3 storage.
* **Step 4.4:** Build client-side Replay Engine that accepts raw log files and simulates match playback deterministically.

---

### Phase 5: Matchmaking, Scale & Future Extensibility
* **Step 5.1:** Set up PostgreSQL database schema for Users, Trophies, and Match Summaries.
* **Step 5.2:** Build Redis-backed Matchmaking service (pair players based on skill/trophies and issue room assignment tokens).
* **Step 5.3:** Deploy game server nodes on Kubernetes with auto-scaling rules based on active CCU load.
* **Step 5.4:** Implement schema extensions for dynamic wall durability, variable bomb blast radii, and consumable power-up lifecycles.
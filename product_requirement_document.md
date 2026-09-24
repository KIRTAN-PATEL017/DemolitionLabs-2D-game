# Product Requirement Document (PRD)

## Project Title: DemolitionLabs

---

## 1. Executive Summary
**DemolitionLabs** is a high-concurrency, browser-based real-time multiplayer action-strategy game inspired by classic grid-bombing mechanics (e.g., *Bomberman*). Players navigate a 2D grid-based map, destroy obstacles, collect power-ups, and eliminate opponents using strategically placed bombs. The game features an authoritative real-time server architecture, persistent event logging for full-match deterministic replays, live spectator modes, and scale support for up to 100,000 Concurrent Users (CCU).

---

## 2. Core Functional Requirements (FR)

### 2.1 Matchmaking & Room Management
* **FR-1.1:** A match (internal system representation) corresponds to a single **Room** on the client side.
* **FR-1.2:** Standard rooms support a strict minimum of **2 players** and a maximum of **4 players**.
* **FR-1.3:** Once a match starts, late joins are strictly forbidden.
* **FR-1.4:** Support configurable room sizes (custom min/max limits) and varying map dimensions in future releases.

### 2.2 Gameplay & Physics Engine
* **FR-2.1:** **Player Passability:** Players can walk through other players.
* **FR-2.2:** **Impassable Obstacles:** Players **cannot** pass through Indestructible Walls, Destructible Boxes, or active Bombs.
* **FR-2.3:** **Map Layout:** Maps consist of fixed outer/inner Indestructible Walls and Destructible Boxes.
* **FR-2.4:** **Destruction & Item Spawning:**
  * Destroying a box has a randomized probability of dropping a Power-up.
  * Power-ups spawn strictly inside cell coordinates of broken boxes.
* **FR-2.5:** **Power-up Collection:**
  * A power-up is acquired when a player enters its grid cell.
  * Once collected, the power-up is removed permanently from the grid.
* **FR-2.6:** **Death & Spectator Mode:**
  * When eliminated by a bomb blast, a player enters Spectator Mode.
  * Spectators continue receiving real-time state deltas until the match finishes or they explicitly exit the room.

### 2.3 Event Logging & Replays
* **FR-3.1:** The game server must generate and stream lightweight, append-only logs of all match events (initial seed, player inputs, tick markers, drop locations).
* **FR-3.2:** Match logs must be persistently stored to support accurate, deterministic client-side replay rendering.

---

## 3. Non-Functional Requirements (NFR)

* **NFR-1 (Low Latency):** Server tick rate set to **20 Hz (50 ms/tick)** with end-to-end client input-to-render latency under **80 ms**.
* **NFR-2 (High Availability):** Target 99.9% uptime with zero single points of failure across stateless services.
* **NFR-3 (Fault Tolerance):** Game server node crashes isolated to active rooms on that node; room state recovered or cleanly terminated without corrupting global user states.
* **NFR-4 (Scalability):** System horizontally scalable to sustain **100,000 Concurrent Users (CCU)** (~25,000–50,000 simultaneous active rooms).

---

## 4. Future Scope & Extensibility

* **FS-1 (Durability Engine):** Walls/Boxes with health points ($HP > 1$).
* **FS-2 (Dynamic Bomb Properties):** Variable blast radii across Cardinal directions ($N, S, E, W$) and dynamic firepower multipliers based on collected items.
* **FS-3 (Power-up Lifecycles):** Support for passive (permanent for full match lifecycle) vs. active/consumable (single-use) items.
* **FS-4 (MMR & Match History):** Skill-based matchmaking powered by user Trophies/Levels and persistent match summary records.
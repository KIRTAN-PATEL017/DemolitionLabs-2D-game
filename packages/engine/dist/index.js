/**
 * index.ts
 * --------
 * Public API barrel export for @demolition-labs/engine.
 *
 * Consumers (Phase 2 server, Phase 3 client tools) import from this file.
 * Internal modules (grid.ts, collision.ts, etc.) are NOT re-exported in full —
 * only the surface area needed by external packages is exposed here.
 */
// Main engine class
export { GameEngine } from "./engine.js";
// Constants used by consumers (e.g., server loop, client renderer)
export { BOMB_FUSE_TICKS, DEFAULT_FIREPOWER, DEFAULT_BOMB_LIMIT, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, ENTITY_BOMB, ENTITY_BOX, ENTITY_EMPTY, ENTITY_MASK, ENTITY_POWERUP, ENTITY_WALL, MS_PER_TICK, POWERUP_BOMB_UP, POWERUP_FIRE_UP, POWERUP_NONE, POWERUP_SPEED_UP, SPAWN_POSITIONS, TICK_RATE_HZ, getSpeedCooldownTicks, } from "./constants.js";
// Grid utilities (needed by Phase 2 for initial state broadcast)
export { getCell, isCellWalkable, packCell, unpackDrop, unpackHp, unpackType, generateMap, } from "./grid.js";
// Power-up utilities
export { DROP_RATE, DROP_TABLE, applyPowerupToPlayer, rollDrop } from "./powerup.js";
//# sourceMappingURL=index.js.map
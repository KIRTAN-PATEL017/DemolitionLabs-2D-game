/**
 * constants.ts
 * -----------
 * All compile-time numeric constants for the DemolitionLabs engine.
 * Every value here is intentionally a `const` (not enum) so V8 can inline them
 * directly at the call site, eliminating property lookups in the hot tick path.
 */
/** Mask to extract entity type from a packed cell value. */
export declare const ENTITY_MASK = 15;
/** Mask to extract HP from a packed cell value (before shifting). */
export declare const HP_MASK = 240;
/** Right-shift amount to isolate the HP nibble. */
export declare const HP_SHIFT = 4;
/** Mask to extract the drop payload byte (before shifting). */
export declare const DROP_MASK = 65280;
/** Right-shift amount to isolate the drop payload byte. */
export declare const DROP_SHIFT = 8;
/** An empty, walkable cell. */
export declare const ENTITY_EMPTY = 0;
/** An indestructible wall — never walkable. */
export declare const ENTITY_WALL = 1;
/** A destructible box — blocks movement; may contain a hidden power-up. */
export declare const ENTITY_BOX = 2;
/** A live bomb — blocks movement; has a fuse countdown. */
export declare const ENTITY_BOMB = 3;
/** A collectible power-up sitting on the grid. */
export declare const ENTITY_POWERUP = 4;
/** No drop / empty payload. */
export declare const POWERUP_NONE = 0;
/** +1 to player's concurrent bomb limit. */
export declare const POWERUP_BOMB_UP = 1;
/** +1 to player's explosion firepower (blast radius). */
export declare const POWERUP_FIRE_UP = 2;
/** +1 to player's movement speed tier (reserved for Phase 2+). */
export declare const POWERUP_SPEED_UP = 3;
/** Default map width for classic Bomberman-style layout. */
export declare const DEFAULT_MAP_WIDTH = 13;
/** Default map height for classic Bomberman-style layout. */
export declare const DEFAULT_MAP_HEIGHT = 11;
/** Fraction of interior non-fixed cells that will be filled with boxes. */
export declare const DEFAULT_BOX_DENSITY = 0.65;
/** Server tick rate: 20 Hz → 50 ms per tick. */
export declare const TICK_RATE_HZ = 20;
/** Milliseconds per tick. */
export declare const MS_PER_TICK: number;
/**
 * Number of ticks a bomb fuse burns before exploding.
 * Default: 3 seconds × 20 ticks/s = 60 ticks.
 */
export declare const BOMB_FUSE_TICKS = 60;
/**
 * Ticks of delay before a chain-detonated bomb explodes after being hit
 * by another explosion.  0 = instant chain (classic Bomberman behaviour).
 */
export declare const BOMB_CHAIN_DELAY_TICKS = 0;
/** Default firepower (blast radius in cells) for a freshly placed bomb. */
export declare const DEFAULT_FIREPOWER = 2;
/**
 * Maps a player's speed stat to the number of engine ticks required between moves.
 * TICK_RATE_HZ is 20 (50ms per tick).
 * Speed 1: 4 ticks (200ms)
 * Speed 2: 3 ticks (150ms)
 * Speed 3+: 2 ticks (100ms)
 */
export declare function getSpeedCooldownTicks(speed: number): number;
/** Default maximum number of simultaneously active bombs per player. */
export declare const DEFAULT_BOMB_LIMIT = 1;
/** Maximum HP value encodable in the 4-bit HP field. */
export declare const MAX_HP = 15;
/**
 * Fixed spawn positions for up to 4 players.
 * Index 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right.
 */
export declare const SPAWN_POSITIONS: readonly [number, number][];
/** Number of cells around each spawn corner kept box-free for safety. */
export declare const SPAWN_CLEAR_RADIUS = 1;
//# sourceMappingURL=constants.d.ts.map
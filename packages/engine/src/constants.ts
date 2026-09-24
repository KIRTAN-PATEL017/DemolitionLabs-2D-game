/**
 * constants.ts
 * -----------
 * All compile-time numeric constants for the DemolitionLabs engine.
 * Every value here is intentionally a `const` (not enum) so V8 can inline them
 * directly at the call site, eliminating property lookups in the hot tick path.
 */

// ---------------------------------------------------------------------------
// Bitfield layout (16-bit cell):
//   Bits [0..3]  : EntityType   (0–15)
//   Bits [4..7]  : HP           (0–15, max 15 HP per FR-2.2 / FS-1)
//   Bits [8..15] : Drop payload (PowerupType hidden inside box, 0 = none)
// ---------------------------------------------------------------------------

/** Mask to extract entity type from a packed cell value. */
export const ENTITY_MASK = 0x000f; // 0000 0000 0000 1111

/** Mask to extract HP from a packed cell value (before shifting). */
export const HP_MASK = 0x00f0; // 0000 0000 1111 0000

/** Right-shift amount to isolate the HP nibble. */
export const HP_SHIFT = 4;

/** Mask to extract the drop payload byte (before shifting). */
export const DROP_MASK = 0xff00; // 1111 1111 0000 0000

/** Right-shift amount to isolate the drop payload byte. */
export const DROP_SHIFT = 8;

// ---------------------------------------------------------------------------
// Entity type identifiers (stored in bits [0..3])
// ---------------------------------------------------------------------------

/** An empty, walkable cell. */
export const ENTITY_EMPTY = 0;

/** An indestructible wall — never walkable. */
export const ENTITY_WALL = 1;

/** A destructible box — blocks movement; may contain a hidden power-up. */
export const ENTITY_BOX = 2;

/** A live bomb — blocks movement; has a fuse countdown. */
export const ENTITY_BOMB = 3;

/** A collectible power-up sitting on the grid. */
export const ENTITY_POWERUP = 4;

// ---------------------------------------------------------------------------
// Power-up type identifiers (stored in bits [8..15] as drop payload)
// ---------------------------------------------------------------------------

/** No drop / empty payload. */
export const POWERUP_NONE = 0;

/** +1 to player's concurrent bomb limit. */
export const POWERUP_BOMB_UP = 1;

/** +1 to player's explosion firepower (blast radius). */
export const POWERUP_FIRE_UP = 2;

/** +1 to player's movement speed tier (reserved for Phase 2+). */
export const POWERUP_SPEED_UP = 3;

// ---------------------------------------------------------------------------
// Map defaults
// ---------------------------------------------------------------------------

/** Default map width for classic Bomberman-style layout. */
export const DEFAULT_MAP_WIDTH = 13;

/** Default map height for classic Bomberman-style layout. */
export const DEFAULT_MAP_HEIGHT = 11;

/** Fraction of interior non-fixed cells that will be filled with boxes. */
export const DEFAULT_BOX_DENSITY = 0.65;

// ---------------------------------------------------------------------------
// Gameplay tuning constants
// ---------------------------------------------------------------------------

/** Server tick rate: 20 Hz → 50 ms per tick. */
export const TICK_RATE_HZ = 20;

/** Milliseconds per tick. */
export const MS_PER_TICK = 1000 / TICK_RATE_HZ; // 50 ms

/**
 * Number of ticks a bomb fuse burns before exploding.
 * Default: 3 seconds × 20 ticks/s = 60 ticks.
 */
export const BOMB_FUSE_TICKS = 60;

/**
 * Ticks of delay before a chain-detonated bomb explodes after being hit
 * by another explosion.  0 = instant chain (classic Bomberman behaviour).
 */
export const BOMB_CHAIN_DELAY_TICKS = 0;

/** Default firepower (blast radius in cells) for a freshly placed bomb. */
export const DEFAULT_FIREPOWER = 2;

// ---------------------------------------------------------------------------
// Speed Cooldowns
// ---------------------------------------------------------------------------

/**
 * Maps a player's speed stat to the number of engine ticks required between moves.
 * TICK_RATE_HZ is 20 (50ms per tick).
 * Speed 1: 4 ticks (200ms)
 * Speed 2: 3 ticks (150ms)
 * Speed 3+: 2 ticks (100ms)
 */
export function getSpeedCooldownTicks(speed: number): number {
  if (speed <= 1) return 4;
  if (speed === 2) return 3;
  return 2;
}

/** Default maximum number of simultaneously active bombs per player. */
export const DEFAULT_BOMB_LIMIT = 1;

/** Maximum HP value encodable in the 4-bit HP field. */
export const MAX_HP = 15;

// ---------------------------------------------------------------------------
// Spawn corners (top-left origin, classic layout)
// Spawn index → [col, row] in a 13×11 grid.
// ---------------------------------------------------------------------------

/**
 * Fixed spawn positions for up to 4 players.
 * Index 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right.
 */
export const SPAWN_POSITIONS: readonly [number, number][] = [
  [1, 1],
  [11, 1],
  [1, 9],
  [11, 9],
] as const;

/** Number of cells around each spawn corner kept box-free for safety. */
export const SPAWN_CLEAR_RADIUS = 1;

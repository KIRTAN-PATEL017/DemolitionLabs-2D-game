/**
 * constants.ts
 * -----------
 * Client-side rendering and layout constants.
 */

// ---------------------------------------------------------------------------
// Grid layout
// ---------------------------------------------------------------------------

/** Pixel size of one grid cell. */
export const CELL_SIZE = 60;

/** Height of the top HUD bar in pixels. */
export const HUD_HEIGHT = 60;

/** Canvas dimensions derived from the 13×11 map + HUD. */
export const CANVAS_WIDTH  = 13 * CELL_SIZE; // 780
export const CANVAS_HEIGHT = 11 * CELL_SIZE + HUD_HEIGHT; // 720

// ---------------------------------------------------------------------------
// Entity colours (Phaser hex format 0xRRGGBB)
// ---------------------------------------------------------------------------

export const COLOR_BG        = 0x161a25; // Deep dark metallic base
export const COLOR_WALL      = 0x222938; // Dark slate metallic bulkhead
export const COLOR_BOX       = 0x936233; // Warm brown crates
export const COLOR_BOX_EDGE  = 0x5a391a; // Darker crate edge
export const COLOR_BOMB      = 0x1c1c1c; // Near-black bomb orb
export const COLOR_FUSE      = 0xff3300; // Glowing red/orange blast core
export const COLOR_EXPLOSION = 0xff6600; // Neon orange blast wave

// Power-up colours (Glowing icons)
export const COLOR_PU_BOMB  = 0x00f0ff; // Neon cyan — BOMB_UP
export const COLOR_PU_FIRE  = 0xff3300; // Neon red — FIRE_UP
export const COLOR_PU_SPEED = 0x00ff88; // Neon green/teal — SPEED_UP

// HUD bar
export const COLOR_HUD_BG     = 0x10131c; // Very dark header background
export const COLOR_HUD_BORDER = 0x00f0ff; // Neon cyan border

// ---------------------------------------------------------------------------
// Player colours (spawn index → colour)
// ---------------------------------------------------------------------------

export const PLAYER_COLORS: readonly number[] = [
  0x3498db, // P1 — blue
  0xe74c3c, // P2 — red
  0x2ecc71, // P3 — green
  0x9b59b6, // P4 — purple
] as const;

export const PLAYER_COLORS_HEX: readonly string[] = [
  "#3498db",
  "#e74c3c",
  "#2ecc71",
  "#9b59b6",
] as const;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Server tick interval in ms. */
export const TICK_MS = 50;

/** Milliseconds for explosion flash animation. */
export const EXPLOSION_FLASH_MS = 250;

/** Ping interval in ms. */
export const PING_INTERVAL_MS = 5000;

// ---------------------------------------------------------------------------
// Phaser scene keys
// ---------------------------------------------------------------------------

export const SCENE_LOBBY   = "LobbyScene";
export const SCENE_GAME    = "GameScene";
export const SCENE_REPLAY  = "ReplayScene";

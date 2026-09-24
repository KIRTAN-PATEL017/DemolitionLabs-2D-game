/**
 * types.ts
 * --------
 * All TypeScript types and interfaces for the DemolitionLabs engine.
 * No runtime values are exported from this file — pure type information only.
 */
import type { POWERUP_BOMB_UP, POWERUP_FIRE_UP, POWERUP_NONE, POWERUP_SPEED_UP } from "./constants.js";
/** A 2-D integer grid coordinate. Immutable by convention; always copy on write. */
export interface Vec2 {
    readonly x: number;
    readonly y: number;
}
/** The four cardinal movement directions the server accepts. */
export type Direction = "NORTH" | "SOUTH" | "EAST" | "WEST";
/**
 * A single player action for one tick.
 * Clients send one input per tick; the server batches and resolves them.
 */
export type GameInput = {
    readonly type: "MOVE";
    readonly dir: Direction;
} | {
    readonly type: "PLACE_BOMB";
} | {
    readonly type: "NOOP";
};
/** Numeric power-up type IDs that match the constants in constants.ts. */
export type PowerupTypeId = typeof POWERUP_NONE | typeof POWERUP_BOMB_UP | typeof POWERUP_FIRE_UP | typeof POWERUP_SPEED_UP;
/** Human-readable power-up string names (used in the drop table & events). */
export type PowerupName = "BOMB_UP" | "FIRE_UP" | "SPEED_UP";
/** A power-up item currently visible on the grid (collectible state). */
export interface PowerupState {
    readonly pos: Vec2;
    readonly typeId: PowerupTypeId;
    readonly name: PowerupName;
}
/** Live state for a single player. Mutated in-place by the engine each tick. */
export interface PlayerState {
    /** Unique player identifier (e.g., socket ID or UUID). */
    readonly id: string;
    /** Current grid cell position. */
    pos: Vec2;
    /** False once the player has been eliminated by a bomb blast. */
    alive: boolean;
    /**
     * True while the player is receiving state updates after death
     * (FR-2.6: spectators keep receiving real-time deltas).
     */
    spectator: boolean;
    /** Maximum number of live bombs this player may have on the grid simultaneously. */
    bombLimit: number;
    /** Number of bombs currently active (placed, fuse still burning). */
    activeBombs: number;
    /** Explosion range in cells per cardinal direction. */
    firepower: number;
    /**
     * Speed tier (reserved for SPEED_UP power-up, Phase 2+).
     * 1 = normal (one cell per move input).
     */
    speed: number;
    /** The engine tick when the player last successfully moved. Used for cooldowns. */
    lastMoveTick: number;
}
/** A live bomb placed on the grid. */
export interface BombState {
    /** ID of the player who placed this bomb. */
    readonly ownerId: string;
    /** Grid cell where the bomb sits. */
    readonly pos: Vec2;
    /** Ticks remaining before detonation (counts down each tick). */
    fuseTicksLeft: number;
    /** Blast radius at the moment of placement (snapshot of owner's firepower). */
    readonly firepower: number;
}
export type MatchPhase = "LOBBY" | "RUNNING" | "FINISHED";
/**
 * Complete authoritative game state for one room.
 * Stored server-side; clients receive deltas (GameStateDelta), not the full object.
 */
export interface GameState {
    /** Monotonically increasing tick counter (starts at 0, increments each tick). */
    tick: number;
    /**
     * Contiguous 1-D Uint16Array encoding the entire map grid as 16-bit bitfields.
     * Index = y * mapWidth + x.
     */
    grid: Uint16Array;
    mapWidth: number;
    mapHeight: number;
    /** Keyed by player ID for O(1) lookup. */
    players: Map<string, PlayerState>;
    /** All currently live bombs. Splice-removed on detonation. */
    bombs: BombState[];
    /** All collectible power-ups currently on the grid. */
    powerups: PowerupState[];
    phase: MatchPhase;
    /**
     * Set to a player ID once the match ends with a winner,
     * or null if the match ends in a draw.
     */
    winnerId: string | null;
    /** Seeded PRNG state (mutable integer, updated each call). */
    rngState: number;
}
/** Describes a cell that changed this tick. */
export interface CellChange {
    readonly x: number;
    readonly y: number;
    /** New packed 16-bit cell value. */
    readonly value: number;
}
/** Minimal diff emitted after each tick for network transmission. */
export interface GameStateDelta {
    readonly tick: number;
    /** Player positions and stat changes. */
    readonly playerUpdates: ReadonlyArray<Readonly<PlayerState>>;
    /** New bombs placed this tick. */
    readonly newBombs: ReadonlyArray<Readonly<BombState>>;
    /** Bombs that detonated this tick (by position). */
    readonly explodedBombs: ReadonlyArray<Vec2>;
    /** Grid cells whose values changed (box destroyed, power-up collected, etc.). */
    readonly cellChanges: ReadonlyArray<CellChange>;
    /** Power-ups that appeared this tick (from destroyed boxes). */
    readonly spawnedPowerups: ReadonlyArray<PowerupState>;
    /** Power-ups collected this tick (by position). */
    readonly collectedPowerups: ReadonlyArray<Vec2>;
    /** Player IDs eliminated this tick. */
    readonly killedPlayerIds: ReadonlyArray<string>;
    readonly phase: MatchPhase;
    readonly winnerId: string | null;
}
/** Configuration passed to GameEngine at construction time. */
export interface RoomConfig {
    /** Unique room identifier. */
    roomId: string;
    mapWidth?: number;
    mapHeight?: number;
    /** PRNG seed for deterministic map generation and drop rolls. */
    seed: number;
    /** Minimum players required to start. */
    minPlayers?: number;
    /** Maximum concurrent players. */
    maxPlayers?: number;
}
/** A single cell affected by an explosion. */
export interface BlastCell {
    readonly pos: Vec2;
    /** True if this cell contained a box that was destroyed by the blast. */
    readonly destroysBox: boolean;
}
/** Result returned by applyExplosion(). */
export interface ExplosionResult {
    readonly killedPlayerIds: ReadonlyArray<string>;
    readonly destroyedBoxPositions: ReadonlyArray<Vec2>;
    readonly spawnedPowerups: ReadonlyArray<PowerupState>;
    /** Positions of bombs that were caught in the blast and should chain-detonate. */
    readonly chainTriggeredBombPositions: ReadonlyArray<Vec2>;
    readonly cellChanges: ReadonlyArray<CellChange>;
}
//# sourceMappingURL=types.d.ts.map
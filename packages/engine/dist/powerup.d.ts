/**
 * powerup.ts
 * ----------
 * Step 1.4 — Power-up drop table and stat application.
 *
 * Responsibility:
 *   - Define the weighted drop table for power-up rolls.
 *   - Provide rollDrop() for seeded-PRNG-based drop resolution.
 *   - Provide applyPowerupToPlayer() as the canonical stat mutation path.
 *
 * The drop table is intentionally separated from the grid generation so
 * map seeds and drop-roll seeds can diverge if needed (e.g., for replay
 * fidelity when the drop table weights are tweaked post-launch).
 */
import type { PlayerState, PowerupName } from "./types.js";
/**
 * Probability that a destroyed box drops ANY power-up.
 * 35% matches the architecture doc's implicit distribution.
 */
export declare const DROP_RATE = 0.35;
/**
 * Weighted drop table.
 * Entries: [PowerupName, relativeWeight].
 * Weights are normalised at runtime — no need for them to sum to 1.
 *
 * Tuning:
 *   BOMB_UP  → 40% of drops  (most impactful early-game item)
 *   FIRE_UP  → 40% of drops  (equally valuable for aggressive players)
 *   SPEED_UP → 20% of drops  (more situational, reserved for future use)
 */
export declare const DROP_TABLE: ReadonlyArray<[PowerupName, number]>;
export declare function powerupNameToId(name: PowerupName): number;
/**
 * Roll a power-up drop using the provided PRNG state.
 *
 * Returns [PowerupName | null, nextRngState]:
 *   - PowerupName  if the roll yields a drop.
 *   - null         if no drop occurs (64.5% of the time by default).
 *
 * The caller (engine.ts) is responsible for passing the returned rngState
 * back into subsequent calls to maintain the deterministic PRNG stream.
 *
 * @example
 * const [drop, newRng] = rollDrop(state.rngState);
 * state.rngState = newRng;
 * if (drop) { ... }
 */
export declare function rollDrop(rngState: number): [PowerupName | null, number];
/**
 * Apply a collected power-up's stat effect to a player.
 * Mutates the PlayerState in place.
 *
 * This is the single source of truth for power-up stat mutations —
 * collision.ts's applyPowerupById delegates here for the stat changes.
 */
export declare function applyPowerupToPlayer(player: PlayerState, name: PowerupName): void;
//# sourceMappingURL=powerup.d.ts.map
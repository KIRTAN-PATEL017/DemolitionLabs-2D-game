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
import { POWERUP_BOMB_UP, POWERUP_FIRE_UP, POWERUP_SPEED_UP } from "./constants.js";
import { mulberry32 } from "./grid.js";
// ---------------------------------------------------------------------------
// Drop table
// ---------------------------------------------------------------------------
/**
 * Probability that a destroyed box drops ANY power-up.
 * 35% matches the architecture doc's implicit distribution.
 */
export const DROP_RATE = 0.35;
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
export const DROP_TABLE = [
    ["BOMB_UP", 40],
    ["FIRE_UP", 40],
    ["SPEED_UP", 20],
];
/** Pre-computed total weight for O(1) normalisation. */
const TOTAL_WEIGHT = DROP_TABLE.reduce((sum, [, w]) => sum + w, 0);
// ---------------------------------------------------------------------------
// Power-up type ID map (name → numeric ID for grid encoding)
// ---------------------------------------------------------------------------
const NAME_TO_ID = {
    BOMB_UP: POWERUP_BOMB_UP,
    FIRE_UP: POWERUP_FIRE_UP,
    SPEED_UP: POWERUP_SPEED_UP,
};
export function powerupNameToId(name) {
    return NAME_TO_ID[name];
}
// ---------------------------------------------------------------------------
// rollDrop
// ---------------------------------------------------------------------------
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
export function rollDrop(rngState) {
    let roll;
    [roll, rngState] = mulberry32(rngState);
    if (roll >= DROP_RATE) {
        return [null, rngState];
    }
    // Select which power-up type
    let typeRoll;
    [typeRoll, rngState] = mulberry32(rngState);
    const threshold = typeRoll * TOTAL_WEIGHT;
    let cumulative = 0;
    for (const [name, weight] of DROP_TABLE) {
        cumulative += weight;
        if (threshold < cumulative) {
            return [name, rngState];
        }
    }
    // Fallback (floating-point edge case): return last item
    const lastName = DROP_TABLE[DROP_TABLE.length - 1]?.[0] ?? "BOMB_UP";
    return [lastName, rngState];
}
// ---------------------------------------------------------------------------
// applyPowerupToPlayer
// ---------------------------------------------------------------------------
/**
 * Apply a collected power-up's stat effect to a player.
 * Mutates the PlayerState in place.
 *
 * This is the single source of truth for power-up stat mutations —
 * collision.ts's applyPowerupById delegates here for the stat changes.
 */
export function applyPowerupToPlayer(player, name) {
    switch (name) {
        case "BOMB_UP":
            player.bombLimit += 1;
            break;
        case "FIRE_UP":
            player.firepower += 1;
            break;
        case "SPEED_UP":
            // Speed tiers are resolved by the server loop in Phase 2.
            // For Phase 1, we simply increment the counter for testing.
            player.speed += 1;
            break;
    }
}
//# sourceMappingURL=powerup.js.map
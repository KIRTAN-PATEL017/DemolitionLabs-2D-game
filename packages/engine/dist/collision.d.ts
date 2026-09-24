/**
 * collision.ts
 * ------------
 * Step 1.2 — Server-side collision resolution.
 *
 * All collision logic is computed against the authoritative grid bitfield,
 * not client positions.  This makes the server fully authoritative and
 * prevents any client-side position spoofing.
 *
 * Rules (from PRD §2.2):
 *   FR-2.1: Players CAN walk through other players.
 *   FR-2.2: Players CANNOT walk through Walls, Boxes, or live Bombs.
 *   FR-2.5: A player collects a power-up by entering its cell.
 */
import type { GameState, PlayerState, PowerupName, Vec2 } from "./types.js";
/**
 * Compute the new grid position for a player attempting to move in `dir`.
 *
 * Returns the **new** Vec2 if the target cell is walkable, or the player's
 * **current** position if movement is blocked.
 *
 * This function is pure — it does NOT mutate any state.
 */
export declare function resolvePlayerMove(state: GameState, playerId: string, dir: string): Vec2;
/**
 * Check whether the player's **current** position contains a collectible
 * power-up.  If so, apply its effect to the player's stats and return the
 * power-up name so the caller can:
 *   1. Remove the power-up from state.powerups[].
 *   2. Clear the cell on the grid.
 *   3. Emit a `collectedPowerups` delta event.
 *
 * Returns `null` if there is no power-up at the player's position.
 */
export declare function tryCollectPowerup(state: GameState, playerId: string): PowerupName | null;
/**
 * Apply the stat effect of a power-up to a player.
 * Returns the human-readable name of the collected power-up, or null if
 * the typeId is unrecognised.
 */
export declare function applyPowerupById(player: PlayerState, typeId: number): PowerupName | null;
//# sourceMappingURL=collision.d.ts.map
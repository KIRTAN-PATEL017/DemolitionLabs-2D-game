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
import { isCellWalkable } from "./grid.js";
import {
  ENTITY_MASK,
  ENTITY_POWERUP,
  POWERUP_BOMB_UP,
  POWERUP_FIRE_UP,
  POWERUP_SPEED_UP,
} from "./constants.js";
import { getCell, unpackDrop } from "./grid.js";

// ---------------------------------------------------------------------------
// Direction → delta vector
// ---------------------------------------------------------------------------

/** Maps a Direction string to a (dx, dy) grid offset. */
const DIR_DELTA: Record<string, [number, number]> = {
  NORTH: [0, -1],
  SOUTH: [0, 1],
  EAST: [1, 0],
  WEST: [-1, 0],
};

// ---------------------------------------------------------------------------
// resolvePlayerMove
// ---------------------------------------------------------------------------

/**
 * Compute the new grid position for a player attempting to move in `dir`.
 *
 * Returns the **new** Vec2 if the target cell is walkable, or the player's
 * **current** position if movement is blocked.
 *
 * This function is pure — it does NOT mutate any state.
 */
export function resolvePlayerMove(
  state: GameState,
  playerId: string,
  dir: string,
): Vec2 {
  const player = state.players.get(playerId);
  if (!player || !player.alive) return player?.pos ?? { x: 0, y: 0 };

  const delta = DIR_DELTA[dir];
  if (!delta) return player.pos;

  const [dx, dy] = delta;
  const nx = player.pos.x + dx;
  const ny = player.pos.y + dy;

  // Bounds check (should never fail on a correctly generated map with border walls)
  if (nx < 0 || nx >= state.mapWidth || ny < 0 || ny >= state.mapHeight) {
    return player.pos;
  }

  if (!isCellWalkable(state.grid, nx, ny, state.mapWidth)) {
    return player.pos; // blocked
  }

  return { x: nx, y: ny };
}

// ---------------------------------------------------------------------------
// tryCollectPowerup
// ---------------------------------------------------------------------------

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
export function tryCollectPowerup(
  state: GameState,
  playerId: string,
): PowerupName | null {
  const player = state.players.get(playerId);
  if (!player || !player.alive) return null;

  const { x, y } = player.pos;
  const cell = getCell(state.grid, x, y, state.mapWidth);

  if ((cell & ENTITY_MASK) !== ENTITY_POWERUP) return null;

  const typeId = unpackDrop(cell);
  return applyPowerupById(player, typeId);
}

// ---------------------------------------------------------------------------
// Internal: apply a power-up effect by its numeric type ID
// ---------------------------------------------------------------------------

/**
 * Apply the stat effect of a power-up to a player.
 * Returns the human-readable name of the collected power-up, or null if
 * the typeId is unrecognised.
 */
export function applyPowerupById(
  player: PlayerState,
  typeId: number,
): PowerupName | null {
  switch (typeId) {
    case POWERUP_BOMB_UP:
      player.bombLimit += 1;
      return "BOMB_UP";

    case POWERUP_FIRE_UP:
      player.firepower += 1;
      return "FIRE_UP";

    case POWERUP_SPEED_UP:
      player.speed += 1;
      return "SPEED_UP";

    default:
      return null;
  }
}

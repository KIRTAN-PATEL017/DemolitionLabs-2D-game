/**
 * Interpolator.ts
 * ---------------
 * Step 3.3 — Remote player position interpolation.
 *
 * Remote players are updated at 20 Hz (one position per 50 ms tick).
 * Without interpolation they would visibly teleport between cells.
 *
 * Algorithm:
 *   - Maintain a ring buffer of the last 3 server-confirmed positions
 *     (with receive timestamps) per remote player.
 *   - Each render frame, lerp between the two most recent positions
 *     using t = elapsed / TICK_MS where elapsed = now - lastTickReceivedAt.
 *   - Result: smooth ~60 fps visual movement between server ticks.
 */

import type { Vec2 } from "@demolition-labs/engine";
import { getSpeedCooldownTicks } from "@demolition-labs/engine";
import { TICK_MS } from "../constants.js";

interface InterpolatorState {
  targetPos: Vec2;
  visualPos: { x: number; y: number };
}

export class Interpolator {
  private readonly states = new Map<string, InterpolatorState>();

  // ---------------------------------------------------------------------------
  // Push a new server snapshot
  // ---------------------------------------------------------------------------

  pushServerState(playerId: string, pos: Vec2): void {
    let state = this.states.get(playerId);
    if (!state) {
      state = {
        targetPos: { ...pos },
        visualPos: { x: pos.x, y: pos.y },
      };
      this.states.set(playerId, state);
    } else {
      state.targetPos = { ...pos };
    }
  }

  // ---------------------------------------------------------------------------
  // Get interpolated pixel coordinates
  // ---------------------------------------------------------------------------

  /**
   * Returns the smoothly lerped position for `playerId`.
   * Should be called every frame with the frame deltaMs.
   */
  updateAndGetVisualPos(playerId: string, deltaMs: number, speed: number): Vec2 {
    const state = this.states.get(playerId);
    if (!state) return { x: 0, y: 0 };

    const cooldownMs = getSpeedCooldownTicks(speed) * TICK_MS;
    const maxDist = (1 / cooldownMs) * deltaMs;

    const dx = state.targetPos.x - state.visualPos.x;
    const dy = state.targetPos.y - state.visualPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      // If we are way too far behind (e.g. teleported), snap immediately
      state.visualPos.x = state.targetPos.x;
      state.visualPos.y = state.targetPos.y;
    } else if (dist <= maxDist) {
      state.visualPos.x = state.targetPos.x;
      state.visualPos.y = state.targetPos.y;
    } else {
      state.visualPos.x += (dx / dist) * maxDist;
      state.visualPos.y += (dy / dist) * maxDist;
    }

    return state.visualPos;
  }

  removePlayer(playerId: string): void {
    this.states.delete(playerId);
  }

  clearAll(): void {
    this.states.clear();
  }
}

/**
 * ClientPredictor.ts
 * ------------------
 * Step 3.3 — Client-side prediction for the local player.
 *
 * Algorithm:
 *   1. On key input: immediately compute the predicted new position by running
 *      the same collision check as the server (using the engine's isCellWalkable).
 *   2. On server TICK: reconcile — if the server position differs from the
 *      predicted position, snap to the server's authoritative position.
 *
 * This produces zero-latency local movement while staying consistent with
 * the server's authoritative state on each tick.
 */

import { isCellWalkable, getSpeedCooldownTicks } from "@demolition-labs/engine";
import type { Vec2 } from "@demolition-labs/engine";

const DIR_DELTA: Record<string, [number, number]> = {
  NORTH: [0, -1],
  SOUTH: [0, 1],
  EAST:  [1,  0],
  WEST:  [-1, 0],
};

export class ClientPredictor {
  private _pos: Vec2;
  private grid: Uint16Array;
  private readonly mapWidth: number;

  /** True if the last reconcile caused a snap (for debug display). */
  lastReconciled = false;

  /** Visual position for smooth rendering, chases _pos */
  private _visualPos: { x: number; y: number };

  constructor(startPos: Vec2, grid: Uint16Array, mapWidth: number) {
    this._pos       = { ...startPos };
    this._visualPos = { x: startPos.x, y: startPos.y };
    this.grid       = grid;
    this.mapWidth   = mapWidth;
  }

  get pos(): Vec2 { return this._pos; }
  get visualPos(): { x: number; y: number } { return this._visualPos; }

  /** Call every frame to lerp visualPos towards logical pos */
  updateVisuals(deltaMs: number, speed: number): void {
    // 50ms per tick. Cooldown = 4 ticks -> 200ms
    // The player should move 1 tile over `cooldown` ms.
    // Speed (cells/ms) = 1 / cooldownMs
    const cooldownMs = getSpeedCooldownTicks(speed) * 50;
    
    // We can use a simple lerp or constant velocity. Constant velocity looks best for grid games.
    const maxDist = (1 / cooldownMs) * deltaMs;

    const dx = this._pos.x - this._visualPos.x;
    const dy = this._pos.y - this._visualPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= maxDist) {
      this._visualPos.x = this._pos.x;
      this._visualPos.y = this._pos.y;
    } else {
      this._visualPos.x += (dx / dist) * maxDist;
      this._visualPos.y += (dy / dist) * maxDist;
    }
  }

  // ---------------------------------------------------------------------------
  // Prediction
  // ---------------------------------------------------------------------------

  private lastMoveTime = 0;

  /**
   * Apply a movement input immediately (no server round-trip).
   * Uses the same walkability logic as the server for accurate prediction.
   *
   * @returns The new predicted position.
   */
  applyMove(dir: string): Vec2 {
    const delta = DIR_DELTA[dir];
    if (!delta) return this._pos;

    const nx = this._pos.x + delta[0];
    const ny = this._pos.y + delta[1];

    if (isCellWalkable(this.grid, nx, ny, this.mapWidth)) {
      this._pos = { x: nx, y: ny };
      this.lastMoveTime = Date.now();
    }
    return this._pos;
  }

  // ---------------------------------------------------------------------------
  // Reconciliation
  // ---------------------------------------------------------------------------

  /**
   * Reconcile local state with authoritative server state.
   * Snaps the client if the prediction was wrong or if they stopped moving.
   */
  reconcile(serverPos: Vec2): void {
    const dx = Math.abs(serverPos.x - this._pos.x);
    const dy = Math.abs(serverPos.y - this._pos.y);
    const dist = dx + dy;

    // If we are actively moving (within last 200ms) and the server is only 1 cell behind,
    // we trust our prediction and DO NOT snap. This prevents RTT stuttering.
    if (dist <= 1 && Date.now() - this.lastMoveTime < 200) {
      this.lastReconciled = false;
      return;
    }

    // Otherwise, if we are off by more than 1 cell (prediction failed e.g. blocked by bomb)
    // or we've stopped moving for >200ms, snap to server strictly.
    if (serverPos.x !== this._pos.x || serverPos.y !== this._pos.y) {
      this._pos = { ...serverPos };
      this._visualPos = { ...serverPos }; // Snap visually too
      this.lastReconciled = true;
    } else {
      this.lastReconciled = false;
    }
  }

  /**
   * Update the grid reference after cell changes (boxes destroyed, etc.).
   * The predictor must use the latest grid state to stay accurate.
   */
  updateGrid(grid: Uint16Array): void {
    this.grid = grid;
  }

}

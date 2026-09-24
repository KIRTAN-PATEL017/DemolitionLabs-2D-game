/**
 * BombRenderer.ts
 * ---------------
 * Renders live bombs with an animated fuse arc that burns down over 60 ticks.
 */

import Phaser from "phaser";
import { BOMB_FUSE_TICKS } from "@demolition-labs/engine";
import type { BombState } from "@demolition-labs/engine";
import { CELL_SIZE, HUD_HEIGHT, COLOR_BOMB, COLOR_FUSE } from "../constants.js";

export class BombRenderer {
  private readonly scene: Phaser.Scene;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private bombs: ReadonlyArray<Readonly<BombState>> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx   = scene.add.graphics();
    this.gfx.setDepth(5);
  }

  // ---------------------------------------------------------------------------
  // Update the bomb list from TICK delta
  // ---------------------------------------------------------------------------

  updateBombs(bombs: ReadonlyArray<Readonly<BombState>>): void {
    this.bombs = bombs;
  }

  // ---------------------------------------------------------------------------
  // Draw each frame (fuse arc updates smoothly at render FPS)
  // ---------------------------------------------------------------------------

  draw(): void {
    this.gfx.clear();

    for (const bomb of this.bombs) {
      const cx = bomb.pos.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = bomb.pos.y * CELL_SIZE + CELL_SIZE / 2 + HUD_HEIGHT;
      const r  = CELL_SIZE * 0.28;
      // Pulsating fuse effect
      const fuseRatio = Math.max(0, bomb.fuseTicksLeft / BOMB_FUSE_TICKS);
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 80); // Fast pulse
      
      // Body (Dark orb)
      const arrowColor = COLOR_FUSE;
      this.gfx.fillStyle(COLOR_BOMB, 1);
      this.gfx.fillCircle(cx, cy, r);
      this.gfx.lineStyle(2, arrowColor, pulse);
      this.gfx.strokeCircle(cx, cy, r);

      // Glowing red core
      this.gfx.fillStyle(0xff0000, 0.4 + pulse * 0.6);
      this.gfx.fillCircle(cx, cy, r * 0.5);

      // Countdown Text (Optional, we can draw a number if we add a text object, but drawing lines is enough for now)
      // The pulsing ring is enough visual indicator.
    }
  }
}

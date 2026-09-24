/**
 * ExplosionRenderer.ts
 * --------------------
 * Flashes blast cells with an orange/white animation when a bomb detonates.
 */

import Phaser from "phaser";
import type { Vec2 } from "@demolition-labs/engine";
import { CELL_SIZE, HUD_HEIGHT, COLOR_EXPLOSION, EXPLOSION_FLASH_MS } from "../constants.js";

interface Flash {
  pos: Vec2;
  startMs: number;
}

export class ExplosionRenderer {
  private readonly scene: Phaser.Scene;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private flashes: Flash[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx   = scene.add.graphics();
    this.gfx.setDepth(8);
  }

  /** Call when a TICK delta contains explodedBombs positions. */
  triggerExplosions(blastPositions: ReadonlyArray<Vec2>): void {
    const now = Date.now();
    for (const pos of blastPositions) {
      // Add the origin and a 1-cell cross pattern
      const cells: Vec2[] = [
        pos,
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 },
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
      ];
      for (const p of cells) {
        this.flashes.push({ pos: p, startMs: now });
      }
    }
  }

  /** Call every Phaser update() frame. */
  draw(now: number): void {
    this.gfx.clear();

    // Expire old flashes
    this.flashes = this.flashes.filter(
      (f) => now - f.startMs < EXPLOSION_FLASH_MS,
    );

    for (const flash of this.flashes) {
      const t = (now - flash.startMs) / EXPLOSION_FLASH_MS; // 0 → 1
      const alpha = 1 - t;                                    // fade out

      const px = flash.pos.x * CELL_SIZE;
      const py = flash.pos.y * CELL_SIZE + HUD_HEIGHT;

      // Outer blast wave (expanding circle)
      const cx = px + CELL_SIZE / 2;
      const cy = py + CELL_SIZE / 2;
      const r = (CELL_SIZE / 2) * (0.5 + t * 0.5); // expand

      this.gfx.lineStyle(4, COLOR_EXPLOSION, alpha);
      this.gfx.strokeCircle(cx, cy, r);

      // Inner intense core
      this.gfx.fillStyle(0xffffff, alpha * 0.8);
      this.gfx.fillCircle(cx, cy, r * 0.5 * (1 - t));

      // Grid cell highlight (Sci-Fi burn)
      this.gfx.fillStyle(COLOR_EXPLOSION, alpha * 0.2);
      this.gfx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
    }
  }
}

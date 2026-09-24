/**
 * PowerupRenderer.ts
 * ------------------
 * Renders collectible power-up icons as labeled glowing circles.
 * Works alongside GridRenderer (which draws the background circle);
 * this renderer adds the text label on top.
 */

import Phaser from "phaser";
import type { PowerupState } from "@demolition-labs/engine";
import { CELL_SIZE, HUD_HEIGHT, COLOR_PU_BOMB, COLOR_PU_FIRE, COLOR_PU_SPEED } from "../constants.js";

const ICON: Record<string, string> = {
  BOMB_UP:  "💣",
  FIRE_UP:  "🔥",
  SPEED_UP: "⚡",
};

const HEX_COLOR: Record<string, string> = {
  BOMB_UP:  "#00f0ff", // Neon cyan
  FIRE_UP:  "#ff3300", // Neon red
  SPEED_UP: "#00ff88", // Neon green
};

interface PuSprite {
  label: Phaser.GameObjects.Text;
  key: string; // "x,y"
}

export class PowerupRenderer {
  private readonly scene: Phaser.Scene;
  private readonly sprites = new Map<string, PuSprite>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  syncPowerups(powerups: ReadonlyArray<Readonly<PowerupState>>): void {
    const activeKeys = new Set(powerups.map((p) => `${p.pos.x},${p.pos.y}`));

    // Remove collected power-ups
    for (const [key, sprite] of this.sprites) {
      if (!activeKeys.has(key)) {
        sprite.label.destroy();
        this.sprites.delete(key);
      }
    }

    // Add new power-ups
    for (const pu of powerups) {
      const key = `${pu.pos.x},${pu.pos.y}`;
      if (!this.sprites.has(key)) {
        const px = pu.pos.x * CELL_SIZE + CELL_SIZE / 2;
        const py = pu.pos.y * CELL_SIZE + CELL_SIZE / 2 + HUD_HEIGHT;
        const icon  = ICON[pu.name]  ?? "?";
        const color = HEX_COLOR[pu.name] ?? "#fff";

        const label = this.scene.add.text(px, py, icon, {
          fontSize: `${Math.floor(CELL_SIZE * 0.45)}px`,
          color,
        });
        label.setOrigin(0.5, 0.5);
        label.setDepth(6);

        // Pulse tween
        this.scene.tweens.add({
          targets: label,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        this.sprites.set(key, { label, key });
      }
    }
  }

  destroyAll(): void {
    for (const sprite of this.sprites.values()) sprite.label.destroy();
    this.sprites.clear();
  }
}

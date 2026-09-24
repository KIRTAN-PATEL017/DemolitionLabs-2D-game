/**
 * PlayerRenderer.ts
 * -----------------
 * Renders all players as colored circles with name labels.
 *
 * Local player: position comes from ClientPredictor (immediate).
 * Remote players: position comes from Interpolator (lerped).
 * Dead/spectator players: rendered at reduced opacity.
 */

import Phaser from "phaser";
import { CELL_SIZE, HUD_HEIGHT, PLAYER_COLORS, PLAYER_COLORS_HEX } from "../constants.js";
import type { PlayerState } from "@demolition-labs/engine";

interface PlayerSprite {
  gfx:   Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  spawnIndex: number;
}

export class PlayerRenderer {
  private readonly scene: Phaser.Scene;
  private readonly sprites = new Map<string, PlayerSprite>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ---------------------------------------------------------------------------
  // Ensure a sprite exists for each player
  // ---------------------------------------------------------------------------

  syncPlayers(players: ReadonlyArray<Readonly<PlayerState>>, localPlayerId: string): void {
    // Remove sprites for players who no longer exist
    for (const [id, sprite] of this.sprites) {
      if (!players.find((p) => p.id === id)) {
        sprite.gfx.destroy();
        sprite.label.destroy();
        this.sprites.delete(id);
      }
    }

    // Create sprites for new players
    for (const player of players) {
      if (!this.sprites.has(player.id)) {
        const spawnIndex = players.indexOf(player);
        const color = PLAYER_COLORS[spawnIndex % PLAYER_COLORS.length] ?? 0xffffff;
        const hexColor = PLAYER_COLORS_HEX[spawnIndex % PLAYER_COLORS_HEX.length] ?? "#fff";

        const gfx = this.scene.add.graphics();
        gfx.setDepth(10);

        const isLocal = player.id === localPlayerId;
        const label = this.scene.add.text(0, 0,
          isLocal ? "YOU" : `P${spawnIndex + 1}`,
          {
            fontSize: isLocal ? "14px" : "12px",
            fontFamily: "Courier, monospace",
            fontStyle: "bold",
            color: isLocal ? "#ffffff" : hexColor,
            stroke: "#000000",
            strokeThickness: 3,
            shadow: { color: isLocal ? "#ffffff" : hexColor, blur: 4, fill: true }
          },
        );
        label.setDepth(11);
        label.setOrigin(0.5, 1);

        this.sprites.set(player.id, { gfx, label, spawnIndex });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Update positions and states each frame
  // ---------------------------------------------------------------------------

  updatePlayer(
    playerId: string,
    worldX: number, // fractional cell X (from interpolator or predictor)
    worldY: number,
    alive: boolean,
    spectator: boolean,
    isLocal: boolean,
  ): void {
    const sprite = this.sprites.get(playerId);
    if (!sprite) return;

    const px = worldX * CELL_SIZE + CELL_SIZE / 2;
    const py = worldY * CELL_SIZE + CELL_SIZE / 2 + HUD_HEIGHT;
    const alpha = alive ? 1 : 0.35;
    const radius = CELL_SIZE * 0.38;

    const color = PLAYER_COLORS[sprite.spawnIndex % PLAYER_COLORS.length] ?? 0xffffff;

    sprite.gfx.clear();
    sprite.gfx.setAlpha(alpha);

    // Shadow
    sprite.gfx.fillStyle(0x000000, 0.3);
    sprite.gfx.fillEllipse(px + 3, py + 3, radius * 2, radius * 1.4);

    // Base Helmet
    sprite.gfx.fillStyle(color, 1);
    sprite.gfx.fillCircle(px, py, radius);

    // Inner mechanical panel
    sprite.gfx.fillStyle(0x111111, 0.8);
    sprite.gfx.fillCircle(px, py, radius * 0.8);

    // Sci-fi Visor
    sprite.gfx.fillStyle(0x000000, 1);
    sprite.gfx.fillRoundedRect(px - radius * 0.7, py - radius * 0.3, radius * 1.4, radius * 0.6, 4);

    // Glowing Visor Line
    sprite.gfx.lineStyle(3, color, 1);
    sprite.gfx.strokeLineShape(new Phaser.Geom.Line(px - radius * 0.5, py, px + radius * 0.5, py));

    // Highlight (local player gets extra pulsing white ring)
    if (isLocal) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
      sprite.gfx.lineStyle(2, 0xffffff, pulse);
      sprite.gfx.strokeCircle(px, py, radius + 4 + pulse * 2);
    }

    // Label position
    sprite.label.setPosition(px, py - radius - 10);
    sprite.label.setAlpha(alpha);
  }

  destroyAll(): void {
    for (const sprite of this.sprites.values()) {
      sprite.gfx.destroy();
      sprite.label.destroy();
    }
    this.sprites.clear();
  }
}

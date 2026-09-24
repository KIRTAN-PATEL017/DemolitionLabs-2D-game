/**
 * GridRenderer.ts
 * ---------------
 * Step 3.1 — Renders the 13×11 map grid.
 *
 * On ROOM_JOINED: draws the full initial grid using the same seeded
 * generateMap() call as the server — no server round-trip needed for the
 * initial map state.
 *
 * On TICK delta: calls applyChanges() to update only the changed cells,
 * avoiding a full redraw every 50 ms.
 */

import Phaser from "phaser";
import { generateMap, unpackType } from "@demolition-labs/engine";
import {
  ENTITY_WALL, ENTITY_BOX, ENTITY_BOMB, ENTITY_POWERUP, ENTITY_EMPTY,
  POWERUP_BOMB_UP, POWERUP_FIRE_UP,
} from "@demolition-labs/engine";
import type { CellChange } from "@demolition-labs/engine";
import {
  CELL_SIZE, HUD_HEIGHT,
  COLOR_BG, COLOR_WALL, COLOR_BOX, COLOR_BOX_EDGE,
  COLOR_PU_BOMB, COLOR_PU_FIRE, COLOR_PU_SPEED,
} from "../constants.js";

export class GridRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private grid: Uint16Array;
  private readonly mapWidth: number;
  private readonly mapHeight: number;

  constructor(scene: Phaser.Scene, grid: Uint16Array, mapWidth: number, mapHeight: number) {
    this.grid      = grid;
    this.mapWidth  = mapWidth;
    this.mapHeight = mapHeight;
    this.gfx       = scene.add.graphics();
    this.gfx.setDepth(0);
    this._drawFull();
  }

  // ---------------------------------------------------------------------------
  // Initial full draw
  // ---------------------------------------------------------------------------

  private _drawFull(): void {
    this.gfx.clear();
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const cell = this.grid[y * this.mapWidth + x] ?? 0;
        this._drawCell(x, y, unpackType(cell), cell);
      }
    }

    // Draw outer bulkhead frame
    const W = this.mapWidth * CELL_SIZE;
    const H = this.mapHeight * CELL_SIZE;
    this.gfx.lineStyle(10, COLOR_WALL, 1);
    this.gfx.strokeRect(5, HUD_HEIGHT + 5, W - 10, H - 10);
    
    // Inner glowing edge of the bulkhead
    this.gfx.lineStyle(2, 0x00f0ff, 0.4);
    this.gfx.strokeRect(10, HUD_HEIGHT + 10, W - 20, H - 20);
  }

  // ---------------------------------------------------------------------------
  // Delta update — only changed cells
  // ---------------------------------------------------------------------------

  applyChanges(changes: ReadonlyArray<CellChange>): void {
    for (const { x, y, value } of changes) {
      // Update our local grid copy
      const idx = y * this.mapWidth + x;
      if (idx >= 0 && idx < this.grid.length) {
        this.grid[idx] = value;
      }
    }
    // Redraw only the changed cells by clearing and re-rendering all
    // (Phaser Graphics doesn't support per-cell invalidation, so we do a full
    // redraw — still fast at 13×11 = 143 cells)
    this._drawFull();
  }

  /** Expose the current grid buffer for the ClientPredictor. */
  getGrid(): Uint16Array { return this.grid; }

  // ---------------------------------------------------------------------------
  // Cell drawing
  // ---------------------------------------------------------------------------

  private _drawCell(x: number, y: number, type: number, cellValue: number): void {
    const px = x * CELL_SIZE;
    const py = y * CELL_SIZE + HUD_HEIGHT;
    const g  = this.gfx;
    const S  = CELL_SIZE;

    // Always draw base background and grid lines for every cell
    g.fillStyle(COLOR_BG, 1);
    g.fillRect(px, py, S, S);
    
    // Neon grid lines
    g.lineStyle(1.5, 0x00f0ff, 0.15); // subtle cyan glow
    g.strokeRect(px, py, S, S);

    switch (type) {
      case ENTITY_WALL:
        // Make walls look like solid, raised metal pillars so they don't look like empty cells
        
        // Base block
        g.fillStyle(0x2a3546, 1);
        g.fillRect(px + 2, py + 2, S - 4, S - 4);
        
        // Darker bevels
        g.fillStyle(0x19212d, 1);
        g.fillRect(px + 2, py + 2, S - 4, 6); // top
        g.fillRect(px + 2, py + 2, 6, S - 4); // left
        
        g.fillStyle(0x3a485c, 1);
        g.fillRect(px + 2, py + S - 8, S - 4, 6); // bottom
        g.fillRect(px + S - 8, py + 2, 6, S - 4); // right
        
        // Glowing cyan core/vent in the center
        g.fillStyle(0x00f0ff, 0.6);
        g.fillRect(px + S / 2 - 6, py + S / 2 - 6, 12, 12);
        
        // Core glow
        g.fillStyle(0x00f0ff, 0.2);
        g.fillCircle(px + S / 2, py + S / 2, 12);
        break;

      case ENTITY_BOX: {
        // Wooden crate look
        g.fillStyle(COLOR_BOX, 1);
        g.fillRect(px + 3, py + 3, S - 6, S - 6);
        
        // Edges
        g.fillStyle(COLOR_BOX_EDGE, 1);
        g.fillRect(px + 3, py + 3, S - 6, 4); // top
        g.fillRect(px + 3, py + 3, 4, S - 6); // left
        g.fillRect(px + 3, py + S - 7, S - 6, 4); // bottom
        g.fillRect(px + S - 7, py + 3, 4, S - 6); // right
        
        // Inner X
        g.lineStyle(3, COLOR_BOX_EDGE, 0.8);
        g.beginPath();
        g.moveTo(px + 7, py + 7);
        g.lineTo(px + S - 7, py + S - 7);
        g.moveTo(px + S - 7, py + 7);
        g.lineTo(px + 7, py + S - 7);
        g.strokePath();
        break;
      }

      case ENTITY_POWERUP: {
        // Handled by PowerupRenderer, just draw the glowing base here
        const dropId = (cellValue >> 8) & 0xff;
        const color =
          dropId === POWERUP_BOMB_UP ? COLOR_PU_BOMB  :
          dropId === POWERUP_FIRE_UP ? COLOR_PU_FIRE  :
                                       COLOR_PU_SPEED;
        // Outer faint glow
        g.fillStyle(color, 0.15);
        g.fillCircle(px + S / 2, py + S / 2, S / 2 - 4);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory helper — generates the map client-side using the server seed
// ---------------------------------------------------------------------------

export function buildClientGrid(
  seed: number,
  mapWidth: number,
  mapHeight: number,
): Uint16Array {
  const [grid] = generateMap(mapWidth, mapHeight, seed);
  return grid;
}

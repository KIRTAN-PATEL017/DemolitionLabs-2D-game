/**
 * GameScene.ts
 * ------------
 * Step 3.1 — Main gameplay scene.
 *
 * Owns all renderers, prediction logic, and input handling.
 * Receives the GameClient and initial state from LobbyScene.
 */

import Phaser from "phaser";
import { GameClient } from "../net/GameClient.js";
import { InputSender } from "../net/InputSender.js";
import { ClientPredictor } from "../prediction/ClientPredictor.js";
import { Interpolator } from "../prediction/Interpolator.js";
import { GridRenderer } from "../renderer/GridRenderer.js";
import { PlayerRenderer } from "../renderer/PlayerRenderer.js";
import { BombRenderer } from "../renderer/BombRenderer.js";
import { PowerupRenderer } from "../renderer/PowerupRenderer.js";
import { ExplosionRenderer } from "../renderer/ExplosionRenderer.js";
import {
  SCENE_GAME, CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, COLOR_HUD_BG, COLOR_HUD_BORDER,
  TICK_MS
} from "../constants.js";
import type { GameStateDelta, PlayerState, BombState, PowerupState } from "@demolition-labs/engine";

export interface GameSceneData {
  client: GameClient;
  seed: number;
  grid: Uint16Array;
  startTick: number;
  localPlayerId: string;
}

export class GameScene extends Phaser.Scene {
  private client!: GameClient;
  
  private inputSender!: InputSender;
  private predictor!: ClientPredictor | null;
  private interpolator!: Interpolator;
  
  private gridRenderer!: GridRenderer;
  private playerRenderer!: PlayerRenderer;
  private bombRenderer!: BombRenderer;
  private powerupRenderer!: PowerupRenderer;
  private explosionRenderer!: ExplosionRenderer;

  private hudText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;
  
  private localPlayerId = "";
  private players: ReadonlyArray<Readonly<PlayerState>> = [];
  private activeBombs: BombState[] = [];
  private activePowerups: PowerupState[] = [];
  
  private lastServerTick = 0;
  private isSpectator = false;

  constructor() { super(SCENE_GAME); }

  init(data: GameSceneData): void {
    this.client = data.client;
    this.localPlayerId = data.localPlayerId;
    this.lastServerTick = data.startTick;
    this.predictor = null;
    this.isSpectator = false;
    this.activeBombs = [];
    this.activePowerups = [];
    
    // Initialize systems
    this.inputSender = new InputSender(this, this.client);
    this.interpolator = new Interpolator();
    
    // Initialize renderers
    this.gridRenderer = new GridRenderer(this, data.grid, 13, 11);
    this.playerRenderer = new PlayerRenderer(this);
    this.bombRenderer = new BombRenderer(this);
    this.powerupRenderer = new PowerupRenderer(this);
    this.explosionRenderer = new ExplosionRenderer(this);
  }

  create(): void {
    this._createHud();
    this._createOverlay();

    // Wire up network events
    this.client.on("tick", (msg) => this._onTick(msg.delta));
    this.client.on("match_end", (msg) => this._onMatchEnd(msg.winnerId));
    this.client.on("disconnected", () => this._onDisconnected());
  }

  override update(time: number, delta: number): void {
    if (this.isSpectator || !this.predictor) {
      // Spectator doesn't send input
    } else {
      // Local prediction step
      const localPlayer = this.players.find((p) => p.id === this.localPlayerId);
      if (localPlayer) {
        const sentDir = this.inputSender.update(
          time,
          localPlayer.speed,
          localPlayer.lastMoveTick,
          this.lastServerTick
        );
        if (sentDir) {
          this.predictor.applyMove(sentDir);
        }
        
        // Update visual lerping for local player
        this.predictor.updateVisuals(delta, localPlayer.speed);
      }
    }

    // Render players
    for (const p of this.players) {
      const isLocal = p.id === this.localPlayerId;
      if (isLocal && this.predictor) {
        // Local prediction uses visual pos
        const pos = this.predictor.visualPos;
        this.playerRenderer.updatePlayer(p.id, pos.x, pos.y, p.alive, p.spectator, true);
      } else {
        // Remote interpolation
        const pos = this.interpolator.updateAndGetVisualPos(p.id, delta, p.speed);
        this.playerRenderer.updatePlayer(p.id, pos.x, pos.y, p.alive, p.spectator, false);
      }
    }

    // Render bombs & explosions
    this.bombRenderer.draw();
    this.explosionRenderer.draw(Date.now());

    // Update HUD
    this._updateHud();
  }

  // ---------------------------------------------------------------------------
  // Network Handlers
  // ---------------------------------------------------------------------------

  private _onTick(delta: GameStateDelta): void {
    this.lastServerTick = delta.tick;
    this.players = delta.playerUpdates;
    
    // Sync players array
    this.playerRenderer.syncPlayers(this.players, this.localPlayerId);
    
    const localPlayer = this.players.find((p) => p.id === this.localPlayerId);

    // Initialize predictor once we know local player's start pos
    if (localPlayer && !this.predictor && !localPlayer.spectator) {
      this.predictor = new ClientPredictor(localPlayer.pos, this.gridRenderer.getGrid(), 13);
    }
    
    // Check if we died
    if (delta.killedPlayerIds.includes(this.localPlayerId) && !this.isSpectator) {
      this.isSpectator = true;
      this.predictor = null; // stop predicting
      this._showOverlay("ELIMINATED\nSpectating...");
    }

    // 1. Grid updates
    if (delta.cellChanges.length > 0) {
      this.gridRenderer.applyChanges(delta.cellChanges);
      if (this.predictor) {
        this.predictor.updateGrid(this.gridRenderer.getGrid());
      }
    }

    // 2. Local Reconcile & Remote Buffer
    const now = Date.now();
    for (const p of this.players) {
      if (p.id === this.localPlayerId && this.predictor && p.alive) {
        this.predictor.reconcile(p.pos);
      } else if (p.id !== this.localPlayerId) {
        this.interpolator.pushServerState(p.id, p.pos);
      }
    }

    // 3. Entity sync: Bombs
    this.activeBombs.forEach((b) => b.fuseTicksLeft--);
    this.activeBombs = this.activeBombs.filter(
      (b) => !delta.explodedBombs.find((exp) => exp.origin.x === b.pos.x && exp.origin.y === b.pos.y)
    );
    // Push a copy of new bombs since we will mutate fuseTicksLeft
    for (const nb of delta.newBombs) {
      this.activeBombs.push({ ...nb, pos: { ...nb.pos } });
    }
    this.bombRenderer.updateBombs(this.activeBombs);

    // 4. Entity sync: Explosions
    this.explosionRenderer.triggerExplosions(delta.explodedBombs);

    // 5. Entity sync: Powerups
    const removedPu = new Set<string>();
    for (const pos of delta.collectedPowerups) removedPu.add(`${pos.x},${pos.y}`);
    for (const c of delta.cellChanges) {
      // 3 is ENTITY_POWERUP, if it's not a powerup anymore, remove it
      if ((c.value & 0xf) !== 3) removedPu.add(`${c.x},${c.y}`);
    }
    this.activePowerups = this.activePowerups.filter(
      (p) => !removedPu.has(`${p.pos.x},${p.pos.y}`)
    );
    for (const np of delta.spawnedPowerups) {
      this.activePowerups.push({ ...np, pos: { ...np.pos } });
    }
    this.powerupRenderer.syncPowerups(this.activePowerups);
  }

  private _onMatchEnd(winnerId: string | null): void {
    if (winnerId === this.localPlayerId) {
      this._showOverlay("VICTORY!");
    } else if (winnerId) {
      const winnerIndex = this.players.findIndex(p => p.id === winnerId);
      this._showOverlay(`DEFEAT\nP${winnerIndex + 1} Wins`);
    } else {
      this._showOverlay("DRAW");
    }
  }

  private _onDisconnected(): void {
    this._showOverlay("DISCONNECTED");
  }

  // ---------------------------------------------------------------------------
  // HUD & Overlay
  // ---------------------------------------------------------------------------

  private _createHud(): void {
    const bg = this.add.graphics();
    bg.setDepth(100);
    
    // Solid background
    bg.fillStyle(COLOR_HUD_BG, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

    // Decorative HUD elements
    bg.lineStyle(2, COLOR_HUD_BORDER, 0.8);
    
    // Bottom border with tech gaps
    bg.beginPath();
    bg.moveTo(0, HUD_HEIGHT);
    bg.lineTo(CANVAS_WIDTH / 2 - 100, HUD_HEIGHT);
    bg.lineTo(CANVAS_WIDTH / 2 - 80, HUD_HEIGHT - 10);
    bg.lineTo(CANVAS_WIDTH / 2 + 80, HUD_HEIGHT - 10);
    bg.lineTo(CANVAS_WIDTH / 2 + 100, HUD_HEIGHT);
    bg.lineTo(CANVAS_WIDTH, HUD_HEIGHT);
    bg.strokePath();

    // Title
    const title = this.add.text(CANVAS_WIDTH / 2, HUD_HEIGHT / 2 - 5, "[DEMOLITIONLABS]", {
      fontSize: "20px",
      fontFamily: "Courier, monospace",
      fontStyle: "bold",
      color: "#00f0ff",
      shadow: { color: "#00f0ff", blur: 10, fill: true }
    });
    title.setOrigin(0.5, 0.5);
    title.setDepth(101);

    this.hudText = this.add.text(20, HUD_HEIGHT / 2, "", {
      fontSize: "14px",
      fontFamily: "Courier, monospace",
      color: "#ffffff",
    });
    this.hudText.setOrigin(0, 0.5);
    this.hudText.setDepth(101);
  }

  private _updateHud(): void {
    const me = this.players.find((p) => p.id === this.localPlayerId);
    let stats = "";
    if (me && !me.spectator) {
      stats = `BOMBS: ${me.bombLimit} | FIRE: ${me.firepower} | SPD: ${me.speed}`;
    }
    const ping = this.client.latencyMs;
    this.hudText.setText(`PING: ${ping}ms\n${stats}`);
  }

  private _createOverlay(): void {
    this.overlay = this.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.overlay.setDepth(200);
    this.overlay.setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(-CANVAS_WIDTH / 2, -CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    const text = this.add.text(0, -40, "", {
      fontSize: "48px",
      fontFamily: "'Segoe UI', 'Arial Black', sans-serif",
      fontStyle: "bold",
      color: "#e17055",
      align: "center",
      stroke: "#fff",
      strokeThickness: 2,
    }).setOrigin(0.5);
    text.setName("overlay-text");

    const exitBtn = this.add.text(0, 60, "[ EXIT TO LOBBY ]", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#fff",
      backgroundColor: "#2d3436",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    exitBtn.on("pointerdown", () => {
      this.client.disconnect();
      this.scene.start("LobbyScene");
    });
    
    // On hover, change background color
    exitBtn.on("pointerover", () => exitBtn.setBackgroundColor("#e17055"));
    exitBtn.on("pointerout", () => exitBtn.setBackgroundColor("#2d3436"));

    const replayBtn = this.add.text(0, 120, "[ WATCH REPLAY ]", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#000",
      backgroundColor: "#00f0ff",
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    replayBtn.on("pointerdown", () => {
      this.client.disconnect();
      this.scene.start("ReplayScene", { matchId: this.client.roomId });
    });

    replayBtn.on("pointerover", () => replayBtn.setBackgroundColor("#fff"));
    replayBtn.on("pointerout", () => replayBtn.setBackgroundColor("#00f0ff"));

    this.overlay.add([bg, text, exitBtn, replayBtn]);
  }

  private _showOverlay(message: string): void {
    const text = this.overlay.getByName("overlay-text") as Phaser.GameObjects.Text;
    text.setText(message);
    this.overlay.setVisible(true);
  }
}

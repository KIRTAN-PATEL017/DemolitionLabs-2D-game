import Phaser from "phaser";
import { GameEngine } from "@demolition-labs/engine";
import type { GameStateDelta, GameInput } from "@demolition-labs/engine";
import { SCENE_REPLAY, CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants.js";
import { GridRenderer } from "../renderer/GridRenderer.js";
import { PlayerRenderer } from "../renderer/PlayerRenderer.js";
import { BombRenderer } from "../renderer/BombRenderer.js";
import { PowerupRenderer } from "../renderer/PowerupRenderer.js";
import { ExplosionRenderer } from "../renderer/ExplosionRenderer.js";
import { Interpolator } from "../prediction/Interpolator.js";
// MatchLog definition inline to avoid cross-package imports
interface MatchLog {
  matchId: string;
  seed: number;
  playerOrder: string[];
  ticks: { tick: number; inputs: [string, GameInput][] }[];
}

export class ReplayScene extends Phaser.Scene {
  private engine!: GameEngine;
  private log!: MatchLog;

  private gridRenderer!: GridRenderer;
  private playerRenderer!: PlayerRenderer;
  private bombRenderer!: BombRenderer;
  private powerupRenderer!: PowerupRenderer;
  private explosionRenderer!: ExplosionRenderer;
  private interpolator!: Interpolator;

  private statusText!: Phaser.GameObjects.Text;
  private isPlaying = false;
  private playbackTick = 0;
  private lastUpdateMs = 0;
  private matchId: string = "";

  constructor() {
    super(SCENE_REPLAY);
  }

  init(data: { matchId: string }): void {
    this.matchId = data.matchId;
  }

  async create(): Promise<void> {
    this._createUI();
    this.statusText.setText("Loading Replay...");

    try {
      // Fetch the log via the Vite proxy to bypass CORS
      const res = await fetch(`/demolition-replays/${this.matchId}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      this.log = await res.json() as MatchLog;
      this._initPlayback();
    } catch (err: any) {
      console.error(err);
      this.statusText.setText(`Failed to load replay: ${err.message}`);
    }
  }

  private _createUI(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x111111, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.statusText = this.add.text(20, 20, "", {
      fontSize: "20px",
      fontFamily: "monospace",
      color: "#00f0ff",
    }).setDepth(100);

    const exitBtn = this.add.text(CANVAS_WIDTH - 20, 20, "[ EXIT REPLAY ]", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#fff",
      backgroundColor: "#2d3436",
      padding: { x: 10, y: 5 }
    }).setOrigin(1, 0).setDepth(100).setInteractive({ useHandCursor: true });

    exitBtn.on("pointerdown", () => {
      this.scene.start("LobbyScene");
    });
  }

  private _initPlayback(): void {
    this.interpolator = new Interpolator();
    
    this.engine = new GameEngine({
      roomId: this.log.matchId,
      seed: this.log.seed,
      mapWidth: 13,
      mapHeight: 11,
      minPlayers: 2,
      maxPlayers: 4,
    });

    for (let i = 0; i < this.log.playerOrder.length; i++) {
      this.engine.addPlayer(this.log.playerOrder[i]!, i);
    }
    
    this.engine.startMatch();

    this.gridRenderer = new GridRenderer(this, (this.engine as any).state.grid, 13, 11);
    this.playerRenderer = new PlayerRenderer(this);
    this.bombRenderer = new BombRenderer(this);
    this.powerupRenderer = new PowerupRenderer(this);
    this.explosionRenderer = new ExplosionRenderer(this);
    this.playerRenderer.syncPlayers(Array.from((this.engine as any).state.players.values()), "");

    this.isPlaying = true;
    this.playbackTick = 0;
    this.lastUpdateMs = this.time.now;
    this.statusText.setText(`Playing: ${this.matchId}`);
  }

  override update(time: number, deltaMs: number): void {
    if (!this.isPlaying || !this.engine) return;

    try {
      // Run engine ticks to catch up to real time
      while (time - this.lastUpdateMs >= 50) {
        this.lastUpdateMs += 50;

        if (this.engine.isFinished()) {
          this.isPlaying = false;
          this.statusText.setText(`Replay Finished. Winner: ${(this.engine as any).state.winnerId ?? 'Draw'}`);
          return;
        }

        // 1. Feed inputs for this tick
        const logTick = this.log.ticks.find(t => t.tick === this.playbackTick);
        if (logTick) {
          for (const [playerId, input] of logTick.inputs) {
            this.engine.processInput(playerId, input);
          }
        }

        // 2. Advance engine state
        const delta: GameStateDelta = this.engine.tick();
        this.playbackTick++;

        // 3. Process delta for renderers
        this._processDelta(delta);
      }

      // Smooth render current visual state
      this._renderFrame(deltaMs);
    } catch (err: any) {
      this.isPlaying = false;
      this.statusText.setText(`Replay crashed: ${err.message}`);
      console.error(err);
    }
  }

  private _processDelta(delta: GameStateDelta): void {
    const state = (this.engine as any).state;
    
    this.gridRenderer.applyChanges(delta.cellChanges);
    
    // Push targets to interpolator
    for (const player of state.players.values()) {
      this.interpolator.pushServerState(player.id, player.pos);
    }

    this.powerupRenderer.syncPowerups(state.powerups);
    this.bombRenderer.updateBombs(state.bombs);
    
    if (delta.explodedBombs.length > 0) {
      this.explosionRenderer.triggerExplosions(delta.explodedBombs as any);
    }
  }

  private _renderFrame(deltaMs: number): void {
    const state = (this.engine as any).state;
    
    this.playerRenderer.syncPlayers(Array.from(state.players.values()), "");
    for (const player of state.players.values()) {
      const vPos = this.interpolator.updateAndGetVisualPos(player.id, deltaMs, player.speed);
      this.playerRenderer.updatePlayer(
        player.id,
        vPos.x,
        vPos.y,
        player.alive,
        player.spectator,
        false
      );
    }

    this.bombRenderer.draw();
    this.explosionRenderer.draw(Date.now());
  }
}

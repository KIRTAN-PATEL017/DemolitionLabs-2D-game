import Phaser from "phaser";
import { GameEngine } from "@demolition-labs/engine";
import type { GameStateDelta, GameInput } from "@demolition-labs/engine";
import { SCENE_REPLAY, CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants.js";
import { GridRenderer } from "../renderer/GridRenderer.js";
import { PlayerRenderer } from "../renderer/PlayerRenderer.js";
import { BombRenderer } from "../renderer/BombRenderer.js";
import { PowerupRenderer } from "../renderer/PowerupRenderer.js";
import { ExplosionRenderer } from "../renderer/ExplosionRenderer.js";
import type { MatchLog } from "../../../server/src/EventLogger.js";

export class ReplayScene extends Phaser.Scene {
  private engine!: GameEngine;
  private log!: MatchLog;

  private gridRenderer!: GridRenderer;
  private playerRenderer!: PlayerRenderer;
  private bombRenderer!: BombRenderer;
  private powerupRenderer!: PowerupRenderer;
  private explosionRenderer!: ExplosionRenderer;

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
      // Fetch the log from our public MinIO bucket
      const res = await fetch(`http://localhost:9000/demolition-replays/${this.matchId}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      this.log = await res.json() as MatchLog;
      this._initPlayback();
    } catch (err) {
      console.error(err);
      this.statusText.setText(`Failed to load replay ${this.matchId}`);
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
    this.gridRenderer = new GridRenderer(this);
    this.playerRenderer = new PlayerRenderer(this);
    this.bombRenderer = new BombRenderer(this);
    this.powerupRenderer = new PowerupRenderer(this);
    this.explosionRenderer = new ExplosionRenderer(this);

    this.engine = new GameEngine({
      roomId: this.log.roomId,
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

    this.gridRenderer.initGrid(
      this.engine.state.grid,
      this.engine.state.mapWidth,
      this.engine.state.mapHeight
    );
    this.playerRenderer.syncPlayers(Array.from(this.engine.state.players.values()), "");

    this.isPlaying = true;
    this.playbackTick = 0;
    this.lastUpdateMs = this.time.now;
    this.statusText.setText(`Playing: ${this.matchId}`);
  }

  update(time: number, deltaMs: number): void {
    if (!this.isPlaying) return;

    // Playback at standard 20Hz (50ms per tick)
    if (time - this.lastUpdateMs >= 50) {
      this.lastUpdateMs = time;

      if (this.engine.isFinished()) {
        this.isPlaying = false;
        this.statusText.setText(`Replay Finished. Winner: ${this.engine.state.winnerId ?? 'Draw'}`);
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

      // 3. Render
      this._renderFrame(delta, time);
    }

    this.bombRenderer.draw();
    this.explosionRenderer.draw(time);
  }

  private _renderFrame(delta: GameStateDelta, now: number): void {
    // We can just rely on the engine.state since we are local!
    const state = this.engine.state;
    
    // Grid changes
    for (const change of delta.cellChanges) {
      this.gridRenderer.updateCell(change.x, change.y, change.value);
    }
    
    // Player syncing (positions are immediate, no interpolator needed for replays!)
    this.playerRenderer.syncPlayers(Array.from(state.players.values()), "");
    for (const player of state.players.values()) {
      this.playerRenderer.updatePlayer(
        player.id,
        player.pos.x,
        player.pos.y,
        player.alive,
        player.spectator,
        false
      );
    }

    this.powerupRenderer.syncPowerups(state.powerups);
    this.bombRenderer.updateBombs(state.bombs);
    
    if (delta.explodedBombs.length > 0) {
      this.explosionRenderer.triggerExplosions(delta.explodedBombs);
    }
  }
}

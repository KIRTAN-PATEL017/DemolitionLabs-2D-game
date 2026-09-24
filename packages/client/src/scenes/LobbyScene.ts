/**
 * LobbyScene.ts
 * -------------
 * Step 3.1 — Pre-match lobby scene.
 *
 * Displays:
 *   - Animated bomb icon and game title
 *   - Room ID input + Join button (DOM elements overlaid on canvas)
 *   - Connection status text
 *   - Player count once connected
 *
 * Transitions to GameScene on receiving MATCH_START.
 */

import Phaser from "phaser";
import { GameClient } from "../net/GameClient.js";
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT,
  COLOR_BG, SCENE_LOBBY, SCENE_GAME,
  PLAYER_COLORS,
} from "../constants.js";
import { buildClientGrid } from "../renderer/GridRenderer.js";

export class LobbyScene extends Phaser.Scene {
  private client!: GameClient;
  private statusText!: Phaser.GameObjects.Text;
  private titleBomb!: Phaser.GameObjects.Graphics;
  private domForm!: Phaser.GameObjects.DOMElement;
  private playerDots: Phaser.GameObjects.Graphics[] = [];
  private playerCount = 0;
  private seed = 0;

  constructor() { super(SCENE_LOBBY); }

  create(): void {
    this.client = new GameClient();
    this._drawBackground();
    this._drawTitle();
    this._createForm();
    this._createStatusText();
    this._animateBomb();
  }

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------

  private _drawBackground(): void {
    const bg = this.add.graphics();

    // Gradient-like multi-layer background
    bg.fillStyle(COLOR_BG, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle grid pattern
    bg.lineStyle(1, 0x16213e, 0.6);
    for (let x = 0; x < CANVAS_WIDTH; x += 60) {
      bg.lineBetween(x, 0, x, CANVAS_HEIGHT);
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 60) {
      bg.lineBetween(0, y, CANVAS_WIDTH, y);
    }

    // Corner bombs decoration
    this._drawDecoBomb(30, 30, 0.3);
    this._drawDecoBomb(CANVAS_WIDTH - 30, 30, 0.3);
    this._drawDecoBomb(30, CANVAS_HEIGHT - 30, 0.3);
    this._drawDecoBomb(CANVAS_WIDTH - 30, CANVAS_HEIGHT - 30, 0.3);
  }

  private _drawDecoBomb(cx: number, cy: number, alpha: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xe17055, alpha);
    g.fillCircle(cx, cy, 18);
  }

  // ---------------------------------------------------------------------------
  // Title
  // ---------------------------------------------------------------------------

  private _drawTitle(): void {
    // Animated bomb icon (redrawn in update)
    this.titleBomb = this.add.graphics();
    this.titleBomb.setDepth(2);

    this.add.text(CANVAS_WIDTH / 2, 160, "DEMOLITION", {
      fontSize: "52px",
      fontFamily: "'Segoe UI', 'Arial Black', sans-serif",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#e17055",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2);

    this.add.text(CANVAS_WIDTH / 2, 215, "LABS", {
      fontSize: "38px",
      fontFamily: "'Segoe UI', 'Arial Black', sans-serif",
      fontStyle: "bold",
      color: "#e17055",
      stroke: "#ffffff",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2);

    this.add.text(CANVAS_WIDTH / 2, 255, "REAL-TIME MULTIPLAYER GRID BOMBING", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "rgba(255,255,255,0.4)",
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(2);
  }

  // ---------------------------------------------------------------------------
  // DOM form
  // ---------------------------------------------------------------------------

  private _createForm(): void {
    const html = `
      <div class="lobby-overlay">
        <input
          id="room-id-input"
          class="lobby-input"
          type="text"
          placeholder="Enter room ID…"
          maxlength="16"
          value="room-1"
          autocomplete="off"
          spellcheck="false"
        />
        <button id="join-btn" class="lobby-btn">JOIN ROOM</button>
        <div id="lobby-status-dom" class="lobby-status"></div>
      </div>
    `;
    this.domForm = this.add.dom(CANVAS_WIDTH / 2, 370).createFromHTML(html);
    this.domForm.setDepth(20);

    const btn = document.getElementById("join-btn")!;
    btn.addEventListener("click", () => this._onJoinClick());

    // Also allow Enter key in the input
    const input = document.getElementById("room-id-input") as HTMLInputElement;
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") this._onJoinClick();
    });
  }

  private _createStatusText(): void {
    // Phaser text for player dot indicators below the form
    this.statusText = this.add.text(CANVAS_WIDTH / 2, 460, "", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "rgba(255,255,255,0.5)",
      align: "center",
    }).setOrigin(0.5).setDepth(2);
  }

  // ---------------------------------------------------------------------------
  // Join flow
  // ---------------------------------------------------------------------------

  private _onJoinClick(): void {
    const input  = document.getElementById("room-id-input") as HTMLInputElement;
    const btn    = document.getElementById("join-btn")!;
    const status = document.getElementById("lobby-status-dom")!;

    const roomId = (input.value || "room-1").trim();
    if (!roomId) return;

    let localPlayerId = "";

    btn.setAttribute("disabled", "true");
    status.textContent = "Connecting…";

    this.client.on("room_joined", (msg) => {
      this.playerCount = 1;
      this.seed = msg.seed;
      localPlayerId = msg.playerId;
      status.textContent = `Connected! Waiting for players… (1 / 2+)`;
      this.statusText.setText(`Player ${msg.spawnIndex + 1} joined`);
    });

    this.client.on("tick", () => {
      // Each tick means at least 2 players are in — use for live count display
    });

    this.client.on("match_start", (msg) => {
      status.textContent = "Starting!";
      const grid = buildClientGrid(this.seed, 13, 11);
      this.scene.start(SCENE_GAME, {
        client: this.client,
        seed: this.seed,
        grid,
        startTick: msg.tick,
        localPlayerId,
      });
    });

    this.client.on("error", (msg) => {
      status.textContent = `Error: ${msg.message}`;
      btn.removeAttribute("disabled");
    });

    this.client.on("disconnected", () => {
      status.textContent = "Disconnected. Try again.";
      btn.removeAttribute("disabled");
    });

    this.client.connect(roomId);
  }

  // ---------------------------------------------------------------------------
  // Animated bomb in title
  // ---------------------------------------------------------------------------

  private _animateBomb(): void {
    // Pulse tween on the title bomb graphic via a custom property
    this.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 2000,
      repeat: -1,
      onUpdate: (tween) => {
        const t = tween.getValue() || 0;
        const scale = 1 + Math.sin(t) * 0.08;
        this.titleBomb.setScale(scale);

        // Redraw pulsing bomb icon
        this.titleBomb.clear();
        this.titleBomb.fillStyle(0x2d3436, 1);
        this.titleBomb.fillCircle(CANVAS_WIDTH / 2, 100, 28);
        this.titleBomb.fillStyle(0xe17055, 0.5 + Math.sin(t) * 0.3);
        this.titleBomb.fillCircle(CANVAS_WIDTH / 2, 100, 34);
        this.titleBomb.fillStyle(0x2d3436, 1);
        this.titleBomb.fillCircle(CANVAS_WIDTH / 2, 100, 26);
        this.titleBomb.fillStyle(0xffeaa7, 0.9);
        this.titleBomb.fillCircle(CANVAS_WIDTH / 2 - 8, 93, 7);
      },
    });
  }
}

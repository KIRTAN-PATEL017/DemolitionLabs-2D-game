/**
 * InputSender.ts
 * --------------
 * Step 3.2/3.3 — Keyboard → GameInput → server pipeline.
 *
 * Reads WASD / arrow keys each Phaser `update()` frame, throttles to one
 * input per 50 ms window (matching the server tick rate), and sends it via
 * GameClient.  This prevents flooding the server with inputs faster than
 * the engine can consume them.
 *
 * Priority: PLACE_BOMB > MOVE > NOOP (if bomb key AND move key held,
 * sends PLACE_BOMB only for that tick).
 */

import Phaser from "phaser";
import type { GameClient } from "./GameClient.js";
import { TICK_MS } from "../constants.js";
import { getSpeedCooldownTicks } from "@demolition-labs/engine";

type CursorKeys = Phaser.Types.Input.Keyboard.CursorKeys;

export class InputSender {
  private readonly client: GameClient;
  private readonly cursors: CursorKeys;
  private readonly wKey: Phaser.Input.Keyboard.Key;
  private readonly aKey: Phaser.Input.Keyboard.Key;
  private readonly sKey: Phaser.Input.Keyboard.Key;
  private readonly dKey: Phaser.Input.Keyboard.Key;
  private readonly spaceKey: Phaser.Input.Keyboard.Key;

  private lastSentMs = 0;

  /** Last direction sent — used by ClientPredictor for immediate local movement. */
  lastDir: string | null = null;
  lastType: "MOVE" | "PLACE_BOMB" | "NOOP" = "NOOP";

  constructor(scene: Phaser.Scene, client: GameClient) {
    this.client = client;

    const kb = scene.input.keyboard!;
    this.cursors  = kb.createCursorKeys();
    this.wKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.sKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.dKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Prevent keys getting stuck when switching tabs
    window.addEventListener("blur", () => {
      kb.resetKeys();
    });
  }

  /**
   * Call once per Phaser `update()` frame.
   * Internally throttles to one send per TICK_MS.
   */
  update(
    time: number,
    playerSpeed: number,
    lastMoveTick: number,
    currentServerTick: number
  ): string | null {
    if (time - this.lastSentMs < TICK_MS) return null;
    this.lastSentMs = time;

    // PLACE_BOMB has highest priority
    if (this.spaceKey.isDown) {
      this.client.sendInput("PLACE_BOMB");
      return null;
    }

    // Movement — WASD or arrow keys
    const dir = this._readDirection();
    if (dir !== null) {
      const cooldown = getSpeedCooldownTicks(playerSpeed);
      if (currentServerTick - lastMoveTick >= cooldown) {
        this.client.sendInput("MOVE", dir);
        return dir;
      }
      // Cooldown not met, drop input or send NOOP
      this.client.sendInput("NOOP");
      return null;
    } else {
      this.client.sendInput("NOOP");
      return null;
    }
  }

  private _readDirection(): string | null {
    const up    = this.cursors.up.isDown    || this.wKey.isDown;
    const down  = this.cursors.down.isDown  || this.sKey.isDown;
    const left  = this.cursors.left.isDown  || this.aKey.isDown;
    const right = this.cursors.right.isDown || this.dKey.isDown;

    if (up)    return "NORTH";
    if (down)  return "SOUTH";
    if (left)  return "WEST";
    if (right) return "EAST";
    return null;
  }
}

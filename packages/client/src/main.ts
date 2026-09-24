/**
 * main.ts
 * -------
 * Entry point for the DemolitionLabs browser client.
 * Boots the Phaser 3 game instance and registers all scenes.
 */

import Phaser from "phaser";
import { LobbyScene } from "./scenes/LobbyScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { ReplayScene } from "./scenes/ReplayScene.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./constants.js";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: "game-container",
  backgroundColor: "#0d0d1a",
  pixelArt: false, // Using programmatic vector graphics, not pixel art yet
  
  // Necessary for the LobbyScene DOM input
  dom: {
    createContainer: true,
  },

  scene: [
    LobbyScene,
    GameScene,
    ReplayScene,
  ],
};

// Boot the game
new Phaser.Game(config);

import Phaser from 'phaser';
import { PreloadScene } from './game/scenes/PreloadScene';
import { GameScene } from './game/scenes/GameScene';
import { TileDebugScene } from './game/scenes/TileDebugScene';

// Toggle: set to true to inspect tile indices visually
const DEBUG_TILES = false;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 360, height: 270 },
    max: { width: 1920, height: 1080 },
  },
  pixelArt: true,
  input: {
    activePointers: 3, // Support multitouch (joystick + attack + UI)
  },
  scene: DEBUG_TILES ? [PreloadScene, TileDebugScene] : [PreloadScene, GameScene],
};

const game = new Phaser.Game(config);

export default game;

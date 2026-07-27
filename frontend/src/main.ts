import Phaser from 'phaser';
import { PreloadScene } from './game/scenes/PreloadScene';
import { GameScene } from './game/scenes/GameScene';
import { TileDebugScene } from './game/scenes/TileDebugScene';
import { BalanceGraphScene } from './game/scenes/BalanceGraphScene';
import { DEV_TOOLS_ENABLED } from './game/config/dev-tools';

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
    autoCenter: Phaser.Scale.CENTER_VERTICALLY,
    min: { width: 360, height: 270 },
    max: { width: 1920, height: 1080 },
  },
  pixelArt: true,
  input: {
    activePointers: 3, // Support multitouch (joystick + attack + UI)
  },
  scene: [PreloadScene, GameScene],
};

const game = new Phaser.Game(config);

// Register TileDebugScene without auto-starting it.
// Press T in-game to toggle it on/off (requires VITE_DEV_TOOLS=true).
if (DEV_TOOLS_ENABLED) {
  game.scene.add('TileDebugScene', TileDebugScene, false);
  game.scene.add('BalanceGraphScene', BalanceGraphScene, false);
}

export default game;

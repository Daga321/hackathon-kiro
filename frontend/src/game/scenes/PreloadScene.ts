import Phaser from 'phaser';
import { TILESET_KEYS } from '../config/map-config';

/**
 * Preloads all tileset spritesheets and images needed for map generation.
 * Assets are loaded with correct frame dimensions for tilemap consumption.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.createLoadingBar();

    // ─── Ground ─────────────────────────────────────────────────────────
    // grass.png is a single 16×16 tile — load as image for tilemap use
    this.load.image(TILESET_KEYS.GRASS, 'tilesets/grass.png');

    // ─── Elevated terrain ───────────────────────────────────────────────
    // plains.png: 96×192, 6 cols × 12 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.PLAINS, 'tilesets/plains.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Walls ──────────────────────────────────────────────────────────
    // walls.png: 128×128, 8 cols × 8 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.WALLS, 'tilesets/walls/walls.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Fences ─────────────────────────────────────────────────────────
    // fences.png: 64×64, 4 cols × 4 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.FENCES, 'tilesets/fences.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Decorations 16×16 ──────────────────────────────────────────────
    // decor_16x16.png: 64×80, 4 cols × 5 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.DECOR_16, 'tilesets/decor_16x16.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Decorations 8×8 ────────────────────────────────────────────────
    // decor_8x8.png: 32×32, 4 cols × 4 rows, 8×8 tiles
    this.load.spritesheet(TILESET_KEYS.DECOR_8, 'tilesets/decor_8x8.png', {
      frameWidth: 8,
      frameHeight: 8,
    });

    // ─── Objects ────────────────────────────────────────────────────────
    // objects.png: 256×208, 16 cols × 13 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.OBJECTS, 'objects/objects.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Floor tiles (for potential indoor areas) ───────────────────────
    // flooring.png: 80×48, 5 cols × 3 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.FLOORING, 'tilesets/floors/flooring.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Player character ───────────────────────────────────────────────
    // player.png: 288×480, 6 cols × 10 rows, 48×48 frames
    this.load.spritesheet('player', 'characters/player.png', {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  create(): void {
    // Check which scene to start based on the registered scenes
    const sceneKeys = this.scene.manager.keys;
    if (sceneKeys['TileDebugScene']) {
      this.scene.start('TileDebugScene');
    } else {
      this.scene.start('GameScene');
    }
  }

  /**
   * Create a simple loading progress bar.
   */
  private createLoadingBar(): void {
    const { width, height } = this.cameras.main;
    const barWidth = 320;
    const barHeight = 30;
    const barX = (width - barWidth) / 2;
    const barY = (height - barHeight) / 2;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(barX - 10, barY - 10, barWidth + 20, barHeight + 20);

    const progressBar = this.add.graphics();

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4a6741, 1);
      progressBar.fillRect(barX, barY, barWidth * value, barHeight);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });
  }
}

import Phaser from 'phaser';
import { TILESET_KEYS } from '../config/map-config';

/**
 * Debug scene that displays all frames from each spritesheet
 * in a grid with their frame index numbers.
 * 
 * Use this to visually verify which frame index corresponds to which tile.
 * Navigate between tilesets using LEFT/RIGHT arrow keys.
 * 
 * To activate: change main.ts scene array to [PreloadScene, TileDebugScene]
 */
export class TileDebugScene extends Phaser.Scene {
  private currentSheet = 0;
  private sheets: { key: string; cols: number; rows: number; tileSize: number }[] = [];
  private infoText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TileDebugScene' });
  }

  create(): void {
    // Define all spritesheets to inspect
    this.sheets = [
      { key: TILESET_KEYS.WALLS, cols: 8, rows: 8, tileSize: 16 },
      { key: TILESET_KEYS.PLAINS, cols: 6, rows: 12, tileSize: 16 },
      { key: TILESET_KEYS.FENCES, cols: 4, rows: 4, tileSize: 16 },
      { key: TILESET_KEYS.DECOR_16, cols: 4, rows: 5, tileSize: 16 },
      { key: TILESET_KEYS.OBJECTS, cols: 16, rows: 13, tileSize: 16 },
      { key: TILESET_KEYS.FLOORING, cols: 5, rows: 3, tileSize: 16 },
    ];

    this.infoText = this.add.text(10, 10, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    // Keyboard navigation
    this.input.keyboard?.on('keydown-RIGHT', () => {
      this.currentSheet = (this.currentSheet + 1) % this.sheets.length;
      this.renderCurrentSheet();
    });
    this.input.keyboard?.on('keydown-LEFT', () => {
      this.currentSheet = (this.currentSheet - 1 + this.sheets.length) % this.sheets.length;
      this.renderCurrentSheet();
    });

    this.renderCurrentSheet();
  }

  private renderCurrentSheet(): void {
    // Clear existing sprites and texts (except infoText)
    this.children.getAll().forEach((child) => {
      if (child !== this.infoText) child.destroy();
    });

    const sheet = this.sheets[this.currentSheet];
    const { key, cols, rows, tileSize } = sheet;
    const totalFrames = cols * rows;

    // Update header info
    this.infoText.setText(
      `[${this.currentSheet + 1}/${this.sheets.length}] ` +
      `"${key}" — ${cols}×${rows} = ${totalFrames} frames (${tileSize}px tiles)\n` +
      `Use LEFT/RIGHT arrows to switch tilesets`
    );

    // Scale factor so tiles are visible (render at 2x or 3x)
    const scale = tileSize === 8 ? 4 : 3;
    const cellSize = tileSize * scale;
    const padding = 4;
    const labelHeight = 14;
    const startX = 20;
    const startY = 60;

    // Draw each frame with its index
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const frameIndex = row * cols + col;
        const x = startX + col * (cellSize + padding);
        const y = startY + row * (cellSize + padding + labelHeight);

        // Draw background rectangle for visibility
        const bg = this.add.graphics();
        bg.fillStyle(0x333333, 1);
        bg.fillRect(x, y, cellSize, cellSize);

        // Draw the sprite frame
        const sprite = this.add.sprite(
          x + cellSize / 2,
          y + cellSize / 2,
          key,
          frameIndex
        );
        sprite.setScale(scale);
        sprite.setOrigin(0.5, 0.5);

        // Draw frame index label below
        this.add.text(x, y + cellSize + 1, `${frameIndex}`, {
          fontSize: '10px',
          color: '#ffff00',
        });
      }
    }

    // Set camera to fit all content
    const totalWidth = startX + cols * (cellSize + padding) + 20;
    const totalHeight = startY + rows * (cellSize + padding + labelHeight) + 20;
    this.cameras.main.setBounds(0, 0, totalWidth, totalHeight);
  }
}

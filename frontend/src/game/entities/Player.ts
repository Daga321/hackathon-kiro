import Phaser from 'phaser';
import { MAP_CONFIG, LAYER_DEPTH } from '../config/map-config';

/** Player facing direction */
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Player entity — manages the player sprite, spawn positioning, and orientation.
 *
 * Spritesheet: player.png (288×480, 6 cols × 10 rows, 48×48 frames)
 * Frame layout (rows 0-based):
 *   Row 0 (frames 0-5):   Idle Down
 *   Row 1 (frames 6-11):  Idle Right (flipX for Left)
 *   Row 2 (frames 12-17): Idle Up
 *   Rows 3-5: Move (down / right / up) — NOT used yet
 *   Rows 6-8: Attack (down / right / up) — NOT used yet
 *   Row 9:    Death — NOT used yet
 *
 * Current scope: static sprite with directional orientation via WASD/arrows.
 * Movement, animations, and combat are NOT implemented here.
 */
export class Player {
  private sprite: Phaser.GameObjects.Sprite;
  private direction: PlayerDirection = 'down';

  // Idle frame indices (first frame of each idle row)
  private static readonly IDLE_FRAMES: Record<PlayerDirection, number> = {
    down: 0,    // Row 0, first frame
    right: 6,   // Row 1, first frame
    left: 6,    // Row 1, first frame (flipped horizontally)
    up: 12,     // Row 2, first frame
  };

  constructor(scene: Phaser.Scene, collisionLayer: Phaser.Tilemaps.TilemapLayer | null) {
    const spawnPos = this.findValidSpawnPosition(scene, collisionLayer);

    this.sprite = scene.add.sprite(spawnPos.x, spawnPos.y, 'player', Player.IDLE_FRAMES.down);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setDepth(LAYER_DEPTH.OBJECTS + 1);
  }

  /** Get the player sprite (for camera follow, etc.) */
  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  /** Get the current facing direction */
  getDirection(): PlayerDirection {
    return this.direction;
  }

  /**
   * Set the player's facing direction — updates the idle frame and flipX.
   * Does NOT change position. The player remains completely static.
   */
  setDirection(dir: PlayerDirection): void {
    if (dir === this.direction) return;
    this.direction = dir;

    // Set the correct idle frame
    this.sprite.setFrame(Player.IDLE_FRAMES[dir]);

    // Flip horizontally for left (the spritesheet only has right-facing)
    this.sprite.setFlipX(dir === 'left');
  }

  /**
   * Called each frame from GameScene.update().
   * Checks directional input and updates orientation.
   * Does NOT move the player.
   */
  handleInput(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key }): void {
    if (cursors.up.isDown || wasd.W.isDown) {
      this.setDirection('up');
    } else if (cursors.down.isDown || wasd.S.isDown) {
      this.setDirection('down');
    } else if (cursors.left.isDown || wasd.A.isDown) {
      this.setDirection('left');
    } else if (cursors.right.isDown || wasd.D.isDown) {
      this.setDirection('right');
    }
    // If no key is pressed, direction stays unchanged (last pressed direction persists)
  }

  /**
   * Find a valid random spawn position within the map.
   */
  private findValidSpawnPosition(
    scene: Phaser.Scene,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null
  ): { x: number; y: number } {
    const { WIDTH, HEIGHT, TILE_SIZE, BORDER_THICKNESS, SPAWN_SAFE_RADIUS } = MAP_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const maxAttempts = 100;

    const minX = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxX = WIDTH - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE;
    const minY = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxY = HEIGHT - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * SPAWN_SAFE_RADIUS;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      if (collisionLayer) {
        const tile = collisionLayer.getTileAtWorldXY(x, y);
        if (tile && tile.index !== -1) continue;
      }

      return { x, y };
    }

    return { x: centerX, y: centerY };
  }
}

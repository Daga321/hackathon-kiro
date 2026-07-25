import Phaser from 'phaser';
import { MAP_CONFIG, LAYER_DEPTH } from '../config/map-config';

/**
 * Player entity — manages the player sprite and spawn positioning.
 *
 * Spritesheet: player.png (288×480, 6 cols × 10 rows, 48×48 frames)
 * Frame layout (rows 0-based):
 *   Rows 0-2: Idle (down / right / up — flip right for left)
 *   Rows 3-5: Move (down / right / up)
 *   Rows 6-8: Attack (down / right / up)
 *   Row 9:    Death
 *
 * Current scope: static sprite at a valid random spawn position.
 * Movement, input, animations, and combat are NOT implemented here.
 */
export class Player {
  private sprite: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, collisionLayer: Phaser.Tilemaps.TilemapLayer | null) {
    const spawnPos = this.findValidSpawnPosition(scene, collisionLayer);

    this.sprite = scene.add.sprite(spawnPos.x, spawnPos.y, 'player', 0);

    // Scale: each frame is 48×48 but tiles are 16×16.
    // Keep sprite at native size (48×48) so the character is ~3 tiles tall,
    // which is proportionally correct for a top-down RPG character.
    this.sprite.setOrigin(0.5, 0.75); // Anchor near feet for proper Y-sorting later

    // Depth: render above map layers. Use OBJECTS + 1 so player appears over decorations.
    // Future: replace with dynamic y-based depth sorting.
    this.sprite.setDepth(LAYER_DEPTH.OBJECTS + 1);
  }

  /** Get the player sprite (for camera follow, future physics, etc.) */
  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  /**
   * Find a valid random spawn position within the map.
   * A valid position must:
   * - Be within map bounds (excluding wall border)
   * - Not collide with the wall/collision layer
   * - Be within the spawn-safe radius from center (if defined)
   *
   * Falls back to map center if no valid position is found after max attempts.
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
      // Generate random position within spawn radius of center
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * SPAWN_SAFE_RADIUS;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Check bounds
      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      // Check collision layer — ensure not on a wall tile
      if (collisionLayer) {
        const tile = collisionLayer.getTileAtWorldXY(x, y);
        if (tile && tile.index !== -1) continue; // Occupied by wall
      }

      return { x, y };
    }

    // Fallback: center of map (always safe since spawn zone is kept clear)
    return { x: centerX, y: centerY };
  }
}

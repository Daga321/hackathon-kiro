import Phaser from 'phaser';
import { MAP_CONFIG, LAYER_DEPTH } from '../config/map-config';

/** Player facing direction */
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Player entity — manages sprite, spawn, orientation, idle/walk animations, and movement.
 *
 * Spritesheet: player.png (288×480, 6 cols × 10 rows, 48×48 frames)
 * Frame layout (rows 0-based):
 *   Row 0 (frames 0-5):   Idle Down
 *   Row 1 (frames 6-11):  Idle Right (flipX for Left)
 *   Row 2 (frames 12-17): Idle Up
 *   Row 3 (frames 18-23): Walk Down
 *   Row 4 (frames 24-29): Walk Right (flipX for Left)
 *   Row 5 (frames 30-35): Walk Up
 *   Rows 6-8: Attack — NOT used yet
 *   Row 9:    Death — NOT used yet
 */
export class Player {
  private sprite: Phaser.Physics.Arcade.Sprite;
  private direction: PlayerDirection = 'down';
  private isMoving: boolean = false;
  private currentAnimKey: string = '';

  /** Movement speed in pixels per second */
  private static readonly SPEED = 120;

  /** Animation frame rates */
  private static readonly IDLE_FRAME_RATE = 5;
  private static readonly WALK_FRAME_RATE = 8;

  /** Idle animation keys */
  private static readonly IDLE_ANIMS: Record<PlayerDirection, string> = {
    down: 'player_idle_down',
    right: 'player_idle_right',
    left: 'player_idle_right',
    up: 'player_idle_up',
  };

  /** Walk animation keys */
  private static readonly WALK_ANIMS: Record<PlayerDirection, string> = {
    down: 'player_walk_down',
    right: 'player_walk_right',
    left: 'player_walk_right',
    up: 'player_walk_up',
  };

  constructor(scene: Phaser.Scene, collisionLayer: Phaser.Tilemaps.TilemapLayer | null) {
    this.createAnimations(scene);

    const spawnPos = this.findValidSpawnPosition(scene, collisionLayer);

    // Use physics sprite for movement
    this.sprite = scene.physics.add.sprite(spawnPos.x, spawnPos.y, 'player', 0);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setDepth(LAYER_DEPTH.OBJECTS + 1);

    // Configure physics body
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body?.setSize(16, 16);    // Small hitbox (feet area)
    this.sprite.body?.setOffset(16, 28);  // Center hitbox at feet

    // Start idle animation
    this.playAnimation('player_idle_down', 'down');
  }

  /** Get the player sprite */
  getSprite(): Phaser.Physics.Arcade.Sprite {
    return this.sprite;
  }

  /** Get current direction */
  getDirection(): PlayerDirection {
    return this.direction;
  }

  /**
   * Called each frame. Handles input for movement + orientation + animations.
   */
  handleInput(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key }
  ): void {
    // Determine movement vector
    let vx = 0;
    let vy = 0;

    const up = cursors.up.isDown || wasd.W.isDown;
    const down = cursors.down.isDown || wasd.S.isDown;
    const left = cursors.left.isDown || wasd.A.isDown;
    const right = cursors.right.isDown || wasd.D.isDown;

    if (up) vy -= 1;
    if (down) vy += 1;
    if (left) vx -= 1;
    if (right) vx += 1;

    // Normalize diagonal movement so speed is consistent
    if (vx !== 0 && vy !== 0) {
      const factor = Math.SQRT1_2; // 1 / sqrt(2)
      vx *= factor;
      vy *= factor;
    }

    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      // Apply velocity
      this.sprite.setVelocity(vx * Player.SPEED, vy * Player.SPEED);

      // Determine facing direction (horizontal takes priority for diagonal)
      let newDir: PlayerDirection;
      if (vx < 0) newDir = 'left';
      else if (vx > 0) newDir = 'right';
      else if (vy < 0) newDir = 'up';
      else newDir = 'down';

      // Update direction and walk animation
      this.direction = newDir;
      this.sprite.setFlipX(newDir === 'left');
      this.playAnimation(Player.WALK_ANIMS[newDir], newDir);
      this.isMoving = true;
    } else {
      // Stop movement immediately
      this.sprite.setVelocity(0, 0);

      // Switch to idle if was moving
      if (this.isMoving) {
        this.isMoving = false;
        this.sprite.setFlipX(this.direction === 'left');
        this.playAnimation(Player.IDLE_ANIMS[this.direction], this.direction);
      }
    }
  }

  /**
   * Play an animation only if it's not already the current one.
   */
  private playAnimation(animKey: string, dir: PlayerDirection): void {
    if (this.currentAnimKey === animKey) return;
    this.currentAnimKey = animKey;
    this.sprite.play(animKey);
  }

  /**
   * Create all idle and walk animations.
   */
  private createAnimations(scene: Phaser.Scene): void {
    if (scene.anims.exists('player_idle_down')) return;

    // ─── Idle animations (rows 0-2) ───
    scene.anims.create({
      key: 'player_idle_down',
      frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 5 }),
      frameRate: Player.IDLE_FRAME_RATE,
      repeat: -1,
    });
    scene.anims.create({
      key: 'player_idle_right',
      frames: scene.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
      frameRate: Player.IDLE_FRAME_RATE,
      repeat: -1,
    });
    scene.anims.create({
      key: 'player_idle_up',
      frames: scene.anims.generateFrameNumbers('player', { start: 12, end: 17 }),
      frameRate: Player.IDLE_FRAME_RATE,
      repeat: -1,
    });

    // ─── Walk animations (rows 3-5) ───
    scene.anims.create({
      key: 'player_walk_down',
      frames: scene.anims.generateFrameNumbers('player', { start: 18, end: 23 }),
      frameRate: Player.WALK_FRAME_RATE,
      repeat: -1,
    });
    scene.anims.create({
      key: 'player_walk_right',
      frames: scene.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
      frameRate: Player.WALK_FRAME_RATE,
      repeat: -1,
    });
    scene.anims.create({
      key: 'player_walk_up',
      frames: scene.anims.generateFrameNumbers('player', { start: 30, end: 35 }),
      frameRate: Player.WALK_FRAME_RATE,
      repeat: -1,
    });
  }

  /**
   * Find a valid random spawn position.
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

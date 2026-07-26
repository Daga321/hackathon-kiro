import Phaser from 'phaser';
import { MAP_CONFIG, LAYER_DEPTH } from '../config/map-config';

/** Character facing direction */
export type CharacterDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Animation configuration for a character spritesheet.
 * Maps direction to animation keys with their frame ranges.
 */
export interface CharacterAnimConfig {
  /** Spritesheet texture key */
  textureKey: string;
  /** Prefix for animation keys (e.g. 'player', 'skeleton') */
  prefix: string;
  /** Idle animation frame ranges per direction */
  idle: { down: [number, number]; right: [number, number]; up: [number, number] };
  /** Walk animation frame ranges per direction */
  walk: { down: [number, number]; right: [number, number]; up: [number, number] };
  /** Attack animation frame ranges per direction (optional) */
  attack?: { down: [number, number]; right: [number, number]; up: [number, number] };
  /** Frame rates */
  idleFrameRate: number;
  walkFrameRate: number;
  attackFrameRate?: number;
}

/**
 * Base character class — shared logic for Player and Enemy entities.
 *
 * Handles:
 * - Sprite creation and physics body setup
 * - Direction and orientation (flipX for left)
 * - Animation playback (idle, walk, attack)
 * - Depth sorting based on Y position
 * - Corner sliding for smooth navigation around obstacles
 * - Movement velocity application
 *
 * Subclasses handle:
 * - Input source (Player: keyboard/touch, Enemy: AI)
 * - Spawn logic
 * - Attack triggers
 */
export abstract class Character {
  protected sprite: Phaser.Physics.Arcade.Sprite;
  protected direction: CharacterDirection = 'down';
  protected isMoving: boolean = false;
  protected isAttacking: boolean = false;
  protected currentAnimKey: string = '';
  protected scene: Phaser.Scene;

  /** Movement speed in pixels per second */
  protected speed: number;

  /** Animation key maps built from config */
  protected idleAnims: Record<CharacterDirection, string>;
  protected walkAnims: Record<CharacterDirection, string>;
  protected attackAnims: Record<CharacterDirection, string> | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    animConfig: CharacterAnimConfig,
    speed: number,
    bodyRadius: number = 5,
    bodyOffsetX: number = 19,
    bodyOffsetY: number = 33
  ) {
    this.scene = scene;
    this.speed = speed;

    // Create animations for this character type
    this.createAnimations(scene, animConfig);

    // Build animation key maps
    const p = animConfig.prefix;
    this.idleAnims = {
      down: `${p}_idle_down`,
      right: `${p}_idle_right`,
      left: `${p}_idle_right`,
      up: `${p}_idle_up`,
    };
    this.walkAnims = {
      down: `${p}_walk_down`,
      right: `${p}_walk_right`,
      left: `${p}_walk_right`,
      up: `${p}_walk_up`,
    };
    this.attackAnims = animConfig.attack ? {
      down: `${p}_attack_down`,
      right: `${p}_attack_right`,
      left: `${p}_attack_right`,
      up: `${p}_attack_up`,
    } : null;

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, animConfig.textureKey, 0);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setDepth(LAYER_DEPTH.OBJECTS + 1);
    this.sprite.setCollideWorldBounds(true);

    // Configure circular physics body at feet
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(bodyRadius, bodyOffsetX, bodyOffsetY);

    // Start idle
    this.playAnimation(this.idleAnims.down);
  }

  getSprite(): Phaser.Physics.Arcade.Sprite {
    return this.sprite;
  }

  getDirection(): CharacterDirection {
    return this.direction;
  }

  /**
   * Update depth based on Y position for proper depth sorting with trees/objects.
   */
  updateDepth(): void {
    this.sprite.setDepth(LAYER_DEPTH.OBJECTS + this.sprite.y / 10000);
  }

  /**
   * Apply movement velocity and update direction/animation.
   * @param vx Normalized horizontal velocity (-1 to 1)
   * @param vy Normalized vertical velocity (-1 to 1)
   * @param prioritizeHorizontal Whether to prioritize horizontal facing on diagonal movement
   */
  protected applyMovement(vx: number, vy: number, prioritizeHorizontal: boolean = false): void {
    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      this.sprite.setVelocity(vx * this.speed, vy * this.speed);
      this.applyCornerSliding(vx, vy);

      // Determine facing direction
      let newDir: CharacterDirection;
      if (prioritizeHorizontal) {
        if (Math.abs(vx) >= Math.abs(vy) && vx !== 0) {
          newDir = vx < 0 ? 'left' : 'right';
        } else {
          newDir = vy < 0 ? 'up' : 'down';
        }
      } else {
        if (Math.abs(vx) > Math.abs(vy)) {
          newDir = vx < 0 ? 'left' : 'right';
        } else {
          newDir = vy < 0 ? 'up' : 'down';
        }
      }

      this.direction = newDir;
      this.sprite.setFlipX(newDir === 'left');
      this.playAnimation(this.walkAnims[newDir]);
      this.isMoving = true;
    } else {
      this.sprite.setVelocity(0, 0);

      if (this.isMoving) {
        this.isMoving = false;
        this.sprite.setFlipX(this.direction === 'left');
        this.playAnimation(this.idleAnims[this.direction]);
      }
    }
  }

  /**
   * Trigger attack animation. Returns true if attack started.
   */
  protected triggerAttack(): boolean {
    if (this.isAttacking || !this.attackAnims) return false;

    this.isAttacking = true;
    this.sprite.setVelocity(0, 0);
    this.sprite.setFlipX(this.direction === 'left');
    const attackAnim = this.attackAnims[this.direction];
    const idleAnim = this.idleAnims[this.direction];
    this.currentAnimKey = attackAnim;
    this.sprite.play(attackAnim);
    this.sprite.chain(idleAnim);
    return true;
  }

  /**
   * Check if currently attacking and handle attack state transitions.
   * Returns true if still in attack state (movement should be blocked).
   */
  protected updateAttackState(): boolean {
    if (!this.isAttacking) return false;

    this.sprite.setVelocity(0, 0);
    const prefix = this.attackAnims
      ? Object.values(this.attackAnims)[0].replace(/_attack_.*$/, '_attack_')
      : '';
    if (this.sprite.anims.currentAnim &&
        !this.sprite.anims.currentAnim.key.startsWith(prefix)) {
      this.isAttacking = false;
      this.currentAnimKey = this.idleAnims[this.direction];
    }
    return this.isAttacking;
  }

  /**
   * Corner sliding: helps the character slide around tile corners smoothly.
   */
  protected applyCornerSliding(vx: number, vy: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    const isCardinalX = Math.abs(vx) > 0.5 && Math.abs(vy) < 0.3;
    const isCardinalY = Math.abs(vy) > 0.5 && Math.abs(vx) < 0.3;
    if (!isCardinalX && !isCardinalY) return;

    const blocked = body.blocked;
    const touching = body.touching;
    const isBlocked = blocked.left || blocked.right || blocked.up || blocked.down ||
                      touching.left || touching.right || touching.up || touching.down;

    if (!isBlocked) return;

    const slideForce = this.speed * 0.6;
    const tileSize = 16;
    const threshold = 11;

    if (isCardinalX && (blocked.left || blocked.right || touching.left || touching.right)) {
      const offsetY = ((body.center.y % tileSize) + tileSize) % tileSize;
      if (offsetY > 2 && offsetY <= threshold) {
        body.velocity.y = -slideForce;
      } else if (offsetY >= tileSize - threshold && offsetY < tileSize - 2) {
        body.velocity.y = slideForce;
      }
    }

    if (isCardinalY && (blocked.up || blocked.down || touching.up || touching.down)) {
      const offsetX = ((body.center.x % tileSize) + tileSize) % tileSize;
      if (offsetX > 2 && offsetX <= threshold) {
        body.velocity.x = -slideForce;
      } else if (offsetX >= tileSize - threshold && offsetX < tileSize - 2) {
        body.velocity.x = slideForce;
      }
    }
  }

  protected playAnimation(animKey: string): void {
    if (this.currentAnimKey === animKey) return;
    this.currentAnimKey = animKey;
    this.sprite.play(animKey);
  }

  /**
   * Create animations from config. Idempotent — won't recreate if already exist.
   */
  private createAnimations(scene: Phaser.Scene, config: CharacterAnimConfig): void {
    const p = config.prefix;
    const key = config.textureKey;

    if (scene.anims.exists(`${p}_idle_down`)) return;

    // Idle
    scene.anims.create({ key: `${p}_idle_down`, frames: scene.anims.generateFrameNumbers(key, { start: config.idle.down[0], end: config.idle.down[1] }), frameRate: config.idleFrameRate, repeat: -1 });
    scene.anims.create({ key: `${p}_idle_right`, frames: scene.anims.generateFrameNumbers(key, { start: config.idle.right[0], end: config.idle.right[1] }), frameRate: config.idleFrameRate, repeat: -1 });
    scene.anims.create({ key: `${p}_idle_up`, frames: scene.anims.generateFrameNumbers(key, { start: config.idle.up[0], end: config.idle.up[1] }), frameRate: config.idleFrameRate, repeat: -1 });

    // Walk
    scene.anims.create({ key: `${p}_walk_down`, frames: scene.anims.generateFrameNumbers(key, { start: config.walk.down[0], end: config.walk.down[1] }), frameRate: config.walkFrameRate, repeat: -1 });
    scene.anims.create({ key: `${p}_walk_right`, frames: scene.anims.generateFrameNumbers(key, { start: config.walk.right[0], end: config.walk.right[1] }), frameRate: config.walkFrameRate, repeat: -1 });
    scene.anims.create({ key: `${p}_walk_up`, frames: scene.anims.generateFrameNumbers(key, { start: config.walk.up[0], end: config.walk.up[1] }), frameRate: config.walkFrameRate, repeat: -1 });

    // Attack (optional)
    if (config.attack && config.attackFrameRate) {
      scene.anims.create({ key: `${p}_attack_down`, frames: scene.anims.generateFrameNumbers(key, { start: config.attack.down[0], end: config.attack.down[1] }), frameRate: config.attackFrameRate, repeat: 0, hideOnComplete: false });
      scene.anims.create({ key: `${p}_attack_right`, frames: scene.anims.generateFrameNumbers(key, { start: config.attack.right[0], end: config.attack.right[1] }), frameRate: config.attackFrameRate, repeat: 0, hideOnComplete: false });
      scene.anims.create({ key: `${p}_attack_up`, frames: scene.anims.generateFrameNumbers(key, { start: config.attack.up[0], end: config.attack.up[1] }), frameRate: config.attackFrameRate, repeat: 0, hideOnComplete: false });
    }
  }

  /**
   * Find a valid spawn position avoiding collision tiles.
   */
  protected static findValidSpawnPosition(
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
    centerX: number,
    centerY: number,
    radius: number
  ): { x: number; y: number } {
    const { WIDTH, HEIGHT, TILE_SIZE, BORDER_THICKNESS } = MAP_CONFIG;
    const minX = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxX = WIDTH - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE;
    const minY = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxY = HEIGHT - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE;

    for (let attempt = 0; attempt < 100; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

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

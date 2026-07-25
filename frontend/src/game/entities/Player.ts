import Phaser from 'phaser';
import { MAP_CONFIG, LAYER_DEPTH } from '../config/map-config';

/** Player facing direction */
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Player entity — manages sprite, spawn, orientation, animations, movement, and attack.
 *
 * Spritesheet: player.png (288×480, 6 cols × 10 rows, 48×48 frames)
 *   Row 0 (frames 0-5):   Idle Down
 *   Row 1 (frames 6-11):  Idle Right (flipX for Left)
 *   Row 2 (frames 12-17): Idle Up
 *   Row 3 (frames 18-23): Walk Down
 *   Row 4 (frames 24-29): Walk Right (flipX for Left)
 *   Row 5 (frames 30-35): Walk Up
 *   Row 6 (frames 36-41): Attack Down
 *   Row 7 (frames 42-47): Attack Right (flipX for Left)
 *   Row 8 (frames 48-53): Attack Up
 *   Row 9 (frames 54-59): Death — NOT used yet
 */
export class Player {
  private sprite: Phaser.Physics.Arcade.Sprite;
  private direction: PlayerDirection = 'down';
  private isMoving: boolean = false;
  private isAttacking: boolean = false;
  private currentAnimKey: string = '';

  /** Movement speed in pixels per second */
  private static readonly SPEED = 120;

  /** Animation frame rates */
  private static readonly IDLE_FRAME_RATE = 5;
  private static readonly WALK_FRAME_RATE = 8;
  private static readonly ATTACK_FRAME_RATE = 12;

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

  /** Attack animation keys */
  private static readonly ATTACK_ANIMS: Record<PlayerDirection, string> = {
    down: 'player_attack_down',
    right: 'player_attack_right',
    left: 'player_attack_right',
    up: 'player_attack_up',
  };

  constructor(scene: Phaser.Scene, collisionLayer: Phaser.Tilemaps.TilemapLayer | null) {
    this.createAnimations(scene);

    const spawnPos = this.findValidSpawnPosition(scene, collisionLayer);

    this.sprite = scene.physics.add.sprite(spawnPos.x, spawnPos.y, 'player', 0);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setDepth(LAYER_DEPTH.OBJECTS + 1);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.body?.setSize(16, 16);
    this.sprite.body?.setOffset(16, 28);

    // Start idle
    this.playAnimation(Player.IDLE_ANIMS.down, 'down');
  }

  getSprite(): Phaser.Physics.Arcade.Sprite {
    return this.sprite;
  }

  getDirection(): PlayerDirection {
    return this.direction;
  }

  /**
   * Called each frame. Handles movement, orientation, animations, and attack.
   * Accepts both keyboard and touch input vectors.
   */
  handleInput(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key },
    attackKey: Phaser.Input.Keyboard.Key,
    touchMove?: { x: number; y: number },
    touchAttack?: boolean
  ): void {
    // ─── Attack (keyboard or touch) ───
    const keyboardAttack = Phaser.Input.Keyboard.JustDown(attackKey);
    if ((keyboardAttack || touchAttack) && !this.isAttacking) {
      this.isAttacking = true;
      this.sprite.setVelocity(0, 0);
      this.sprite.setFlipX(this.direction === 'left');
      const attackAnim = Player.ATTACK_ANIMS[this.direction];
      const idleAnim = Player.IDLE_ANIMS[this.direction];
      this.currentAnimKey = attackAnim;
      this.sprite.play(attackAnim);
      this.sprite.chain(idleAnim);
      return;
    }

    // ─── While attacking, block movement/animation changes ───
    if (this.isAttacking) {
      this.sprite.setVelocity(0, 0);
      if (this.sprite.anims.currentAnim &&
          !this.sprite.anims.currentAnim.key.startsWith('player_attack_')) {
        this.isAttacking = false;
        this.currentAnimKey = Player.IDLE_ANIMS[this.direction];
      }
      return;
    }

    // ─── Movement (keyboard + touch combined) ───
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

    // Merge touch joystick input (already normalized -1 to 1)
    if (touchMove && (touchMove.x !== 0 || touchMove.y !== 0)) {
      vx = touchMove.x;
      vy = touchMove.y;
    }

    // Normalize diagonal (only for keyboard; touch is already normalized by joystick)
    if (!touchMove || (touchMove.x === 0 && touchMove.y === 0)) {
      if (vx !== 0 && vy !== 0) {
        const factor = Math.SQRT1_2;
        vx *= factor;
        vy *= factor;
      }
    }

    const moving = vx !== 0 || vy !== 0;

    if (moving) {
      this.sprite.setVelocity(vx * Player.SPEED, vy * Player.SPEED);

      // Determine facing direction based on dominant axis
      let newDir: PlayerDirection;
      if (Math.abs(vx) > Math.abs(vy)) {
        // Horizontal dominant
        newDir = vx < 0 ? 'left' : 'right';
      } else {
        // Vertical dominant (or equal)
        newDir = vy < 0 ? 'up' : 'down';
      }

      this.direction = newDir;
      this.sprite.setFlipX(newDir === 'left');
      this.playAnimation(Player.WALK_ANIMS[newDir], newDir);
      this.isMoving = true;
    } else {
      this.sprite.setVelocity(0, 0);

      if (this.isMoving) {
        this.isMoving = false;
        this.sprite.setFlipX(this.direction === 'left');
        this.playAnimation(Player.IDLE_ANIMS[this.direction], this.direction);
      }
    }
  }

  private playAnimation(animKey: string, _dir: PlayerDirection): void {
    if (this.currentAnimKey === animKey) return;
    this.currentAnimKey = animKey;
    this.sprite.play(animKey);
  }

  private createAnimations(scene: Phaser.Scene): void {
    if (scene.anims.exists('player_idle_down')) return;

    // Idle (rows 0-2)
    scene.anims.create({ key: 'player_idle_down', frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 5 }), frameRate: Player.IDLE_FRAME_RATE, repeat: -1 });
    scene.anims.create({ key: 'player_idle_right', frames: scene.anims.generateFrameNumbers('player', { start: 6, end: 11 }), frameRate: Player.IDLE_FRAME_RATE, repeat: -1 });
    scene.anims.create({ key: 'player_idle_up', frames: scene.anims.generateFrameNumbers('player', { start: 12, end: 17 }), frameRate: Player.IDLE_FRAME_RATE, repeat: -1 });

    // Walk (rows 3-5)
    scene.anims.create({ key: 'player_walk_down', frames: scene.anims.generateFrameNumbers('player', { start: 18, end: 23 }), frameRate: Player.WALK_FRAME_RATE, repeat: -1 });
    scene.anims.create({ key: 'player_walk_right', frames: scene.anims.generateFrameNumbers('player', { start: 24, end: 29 }), frameRate: Player.WALK_FRAME_RATE, repeat: -1 });
    scene.anims.create({ key: 'player_walk_up', frames: scene.anims.generateFrameNumbers('player', { start: 30, end: 35 }), frameRate: Player.WALK_FRAME_RATE, repeat: -1 });

    // Attack (rows 6-8) — single play, no loop. Use only 4 frames (frames 5-6 are empty/transparent)
    scene.anims.create({ key: 'player_attack_down', frames: scene.anims.generateFrameNumbers('player', { start: 36, end: 39 }), frameRate: Player.ATTACK_FRAME_RATE, repeat: 0, hideOnComplete: false });
    scene.anims.create({ key: 'player_attack_right', frames: scene.anims.generateFrameNumbers('player', { start: 42, end: 45 }), frameRate: Player.ATTACK_FRAME_RATE, repeat: 0, hideOnComplete: false });
    scene.anims.create({ key: 'player_attack_up', frames: scene.anims.generateFrameNumbers('player', { start: 48, end: 51 }), frameRate: Player.ATTACK_FRAME_RATE, repeat: 0, hideOnComplete: false });
  }

  private findValidSpawnPosition(
    scene: Phaser.Scene,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null
  ): { x: number; y: number } {
    const { WIDTH, HEIGHT, TILE_SIZE, BORDER_THICKNESS, SPAWN_SAFE_RADIUS } = MAP_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;

    const minX = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxX = WIDTH - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE;
    const minY = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxY = HEIGHT - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE;

    for (let attempt = 0; attempt < 100; attempt++) {
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

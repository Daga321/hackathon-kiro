import Phaser from 'phaser';
import { MAP_CONFIG } from '../config/map-config';
import { Character, CharacterAnimConfig, CombatConfig } from './Character';
import { Pathfinder } from '../ai/Pathfinder';

export type { CharacterDirection as PlayerDirection } from './Character';

/**
 * Player entity — extends Character with keyboard/touch input handling.
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

/** Player animation configuration */
const PLAYER_ANIM_CONFIG: CharacterAnimConfig = {
  textureKey: 'player',
  prefix: 'player',
  idle: { down: [0, 5], right: [6, 11], up: [12, 17] },
  walk: { down: [18, 23], right: [24, 29], up: [30, 35] },
  attack: { down: [36, 39], right: [42, 45], up: [48, 51] },
  idleFrameRate: 5,
  walkFrameRate: 8,
  attackFrameRate: 12,
};

/** Player combat configuration */
const PLAYER_COMBAT_CONFIG: CombatConfig = {
  attackCooldown: 500,
  hitWindowStart: 100,
  hitWindowDuration: 150,
  hitboxOffset: 18,
  hitboxRadius: 12,
  maxHealth: 100,
  knockbackForce: 70,
  invulnerabilityDuration: 1000,
};

export class Player extends Character {
  /** Death animation keys */
  private deathAnims: Record<string, string> | null = null;

  constructor(scene: Phaser.Scene, collisionLayer: Phaser.Tilemaps.TilemapLayer | null, pathfinder?: Pathfinder) {
    const spawnPos = Character.findValidSpawnPosition(
      collisionLayer,
      MAP_CONFIG.WIDTH / 2,
      MAP_CONFIG.HEIGHT / 2,
      MAP_CONFIG.SPAWN_SAFE_RADIUS,
      pathfinder
    );

    super(scene, spawnPos.x, spawnPos.y, PLAYER_ANIM_CONFIG, 120, 5, 19, 33, PLAYER_COMBAT_CONFIG);

    // Create death animations (Row 9: frames 54-59, same for all orientations)
    this.createDeathAnimations(scene);
  }

  private createDeathAnimations(scene: Phaser.Scene): void {
    if (scene.anims.exists('player_death_down')) return;

    scene.anims.create({ key: 'player_death_down', frames: scene.anims.generateFrameNumbers('player', { start: 54, end: 59 }), frameRate: 8, repeat: 0, hideOnComplete: false });
    scene.anims.create({ key: 'player_death_right', frames: scene.anims.generateFrameNumbers('player', { start: 54, end: 59 }), frameRate: 8, repeat: 0, hideOnComplete: false });
    scene.anims.create({ key: 'player_death_up', frames: scene.anims.generateFrameNumbers('player', { start: 54, end: 59 }), frameRate: 8, repeat: 0, hideOnComplete: false });

    this.deathAnims = {
      down: 'player_death_down',
      right: 'player_death_right',
      left: 'player_death_right',
      up: 'player_death_up',
    };
  }

  /**
   * Called when HP reaches 0. Plays death animation and disables the player.
   */
  protected override onDeath(): void {
    // Stop all movement
    this.sprite.setVelocity(0, 0);
    this.isInKnockback = false;

    // Disable physics body
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) body.enable = false;

    // Stop any blink tweens and ensure full visibility
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.alpha = 1;

    // Play death animation based on direction
    if (this.deathAnims) {
      const deathKey = this.deathAnims[this.direction];
      this.sprite.setFlipX(this.direction === 'left');
      this.sprite.play(deathKey);
      // Player stays in last frame — no destroy, ready for future Game Over/Respawn
    }
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
    // Skip input if in knockback or dead
    if (this.isInKnockback || this.isDead) return;

    // ─── Attack (keyboard or touch) ───
    const keyboardAttack = Phaser.Input.Keyboard.JustDown(attackKey);
    if ((keyboardAttack || touchAttack) && !this.isAttacking) {
      this.triggerAttack();
      return;
    }

    // ─── While attacking, block movement ───
    if (this.updateAttackState()) return;

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
    const isKeyboard = !touchMove || (touchMove.x === 0 && touchMove.y === 0);
    if (isKeyboard) {
      if (vx !== 0 && vy !== 0) {
        const factor = Math.SQRT1_2;
        vx *= factor;
        vy *= factor;
      }
    }

    // Apply movement with keyboard prioritizing horizontal facing
    this.applyMovement(vx, vy, isKeyboard);
  }
}

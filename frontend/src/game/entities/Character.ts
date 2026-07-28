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
 * Combat configuration — provided by subclasses to customize attack behavior.
 */
export interface CombatConfig {
  /** Cooldown between attacks in ms */
  attackCooldown?: number;
  /** Delay from attack start until hitbox activates (ms) */
  hitWindowStart?: number;
  /** Duration the hitbox stays active (ms) */
  hitWindowDuration?: number;
  /** Hitbox offset distance from sprite center (px) */
  hitboxOffset?: number;
  /** Hitbox radius (px) */
  hitboxRadius?: number;
  /** Maximum health points (default: 100 for player, 3 for skeleton) */
  maxHealth?: number;
  /** Knockback impulse force in px/s (default: 200) */
  knockbackForce?: number;
  /** Duration of invulnerability after taking damage in ms (default: 1000) */
  invulnerabilityDuration?: number;
  /** Whether to show a health bar above the character (default: false) */
  showHealthBar?: boolean;
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
 * - Attack system: cooldown, hitbox, hit window
 *
 * Subclasses handle:
 * - Input source (Player: keyboard/touch, Enemy: AI)
 * - Spawn logic
 * - Attack decision (WHEN to attack)
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

  // ─── Health & damage system ───
  protected maxHealth: number;
  protected currentHealth: number;
  protected isInvulnerable: boolean = false;
  protected isDead: boolean = false;
  protected isInKnockback: boolean = false;
  private knockbackForce: number;
  private invulnerabilityDurationMs: number;
  private attackHitTargets: Set<Character> = new Set();

  // ─── Health bar ───
  private healthBarBg: Phaser.GameObjects.Graphics | null = null;
  private healthBarFill: Phaser.GameObjects.Graphics | null = null;
  private healthBarVisible: boolean = false;
  private showHealthBar: boolean = false;

  // ─── Combat system ───
  private attackCooldownMs: number;
  private attackCooldownRemaining: number = 0;
  private hitWindowStartMs: number;
  private hitWindowDurationMs: number;
  private hitboxOffset: number;
  private hitboxRadius: number;
  private attackTimer: number = 0;
  private hitboxActive: boolean = false;
  /** The attack hitbox zone (created once, repositioned per attack) */
  private hitbox: Phaser.GameObjects.Zone | null = null;
  private hitboxBody: Phaser.Physics.Arcade.Body | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    animConfig: CharacterAnimConfig,
    speed: number,
    bodyRadius: number = 5,
    bodyOffsetX: number = 19,
    bodyOffsetY: number = 33,
    combatConfig?: CombatConfig,
  ) {
    this.scene = scene;
    this.speed = speed;

    // Combat config
    this.attackCooldownMs = combatConfig?.attackCooldown ?? 600;
    this.hitWindowStartMs = combatConfig?.hitWindowStart ?? 150;
    this.hitWindowDurationMs = combatConfig?.hitWindowDuration ?? 200;
    this.hitboxOffset = combatConfig?.hitboxOffset ?? 20;
    this.hitboxRadius = combatConfig?.hitboxRadius ?? 14;

    // Health & damage config
    this.maxHealth = combatConfig?.maxHealth ?? 100;
    this.currentHealth = this.maxHealth;
    this.knockbackForce = combatConfig?.knockbackForce ?? 200;
    this.invulnerabilityDurationMs = combatConfig?.invulnerabilityDuration ?? 1000;

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
    this.attackAnims = animConfig.attack
      ? {
          down: `${p}_attack_down`,
          right: `${p}_attack_right`,
          left: `${p}_attack_right`,
          up: `${p}_attack_up`,
        }
      : null;

    // Create sprite
    this.sprite = scene.physics.add.sprite(x, y, animConfig.textureKey, 0);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setDepth(LAYER_DEPTH.OBJECTS + 1);
    this.sprite.setCollideWorldBounds(true);

    // Configure circular physics body at feet
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(bodyRadius, bodyOffsetX, bodyOffsetY);

    // Health bar (hidden until first damage)
    this.showHealthBar = combatConfig?.showHealthBar ?? false;
    if (this.showHealthBar) {
      this.healthBarBg = scene.add.graphics();
      this.healthBarFill = scene.add.graphics();
      this.healthBarBg.setVisible(false);
      this.healthBarFill.setVisible(false);
    }

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
    this.updateHealthBar();
  }

  /**
   * Draw/update the health bar above the sprite.
   */
  private updateHealthBar(): void {
    if (!this.showHealthBar || !this.healthBarBg || !this.healthBarFill) return;
    if (!this.healthBarVisible) return;

    const barWidth = 24;
    const barHeight = 3;
    const offsetY = -20; // above the sprite

    const x = this.sprite.x - barWidth / 2;
    const y = this.sprite.y + offsetY;
    const depth = this.sprite.depth + 0.01;

    // Background (dark)
    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x000000, 0.6);
    this.healthBarBg.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);
    this.healthBarBg.setDepth(depth);

    // Fill (red → green gradient based on health %)
    const ratio = this.currentHealth / this.maxHealth;
    const color = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xcccc44 : 0xcc4444;
    this.healthBarFill.clear();
    this.healthBarFill.fillStyle(color, 1);
    this.healthBarFill.fillRect(x, y, barWidth * ratio, barHeight);
    this.healthBarFill.setDepth(depth);
  }

  /**
   * Destroy the health bar graphics. Call from subclass destroy methods.
   */
  protected destroyHealthBar(): void {
    if (this.healthBarBg) {
      this.healthBarBg.destroy();
      this.healthBarBg = null;
    }
    if (this.healthBarFill) {
      this.healthBarFill.destroy();
      this.healthBarFill = null;
    }
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
   * Check if the character can currently attack (not attacking, cooldown expired).
   */
  protected canAttack(): boolean {
    return !this.isAttacking && this.attackCooldownRemaining <= 0 && this.attackAnims !== null;
  }

  /**
   * Trigger attack animation and start the combat sequence.
   * Returns true if attack started successfully.
   * Subclasses call this — they decide WHEN, this handles HOW.
   */
  protected triggerAttack(): boolean {
    if (!this.canAttack()) return false;

    this.isAttacking = true;
    this.attackTimer = 0;
    this.hitboxActive = false;
    this.sprite.setVelocity(0, 0);
    this.sprite.setFlipX(this.direction === 'left');

    const attackAnim = this.attackAnims![this.direction];
    const idleAnim = this.idleAnims[this.direction];
    this.currentAnimKey = attackAnim;
    this.sprite.play(attackAnim);
    this.sprite.chain(idleAnim);
    return true;
  }

  /**
   * Update attack state each frame. Handles hit window timing, hitbox, and cooldown.
   * Returns true if still in attack state (movement should be blocked).
   * Must be called every frame by subclasses.
   */
  protected updateAttackState(): boolean {
    // Update cooldown
    if (this.attackCooldownRemaining > 0) {
      this.attackCooldownRemaining -= this.scene.game.loop.delta;
    }

    if (!this.isAttacking) return false;

    this.sprite.setVelocity(0, 0);
    this.attackTimer += this.scene.game.loop.delta;

    // Hit window management
    if (!this.hitboxActive && this.attackTimer >= this.hitWindowStartMs) {
      this.activateHitbox();
    }
    if (this.hitboxActive && this.attackTimer >= this.hitWindowStartMs + this.hitWindowDurationMs) {
      this.deactivateHitbox();
    }

    // Check if attack animation finished (idle started playing via chain)
    const prefix = this.attackAnims
      ? Object.values(this.attackAnims)[0].replace(/_attack_.*$/, '_attack_')
      : '';
    if (this.sprite.anims.currentAnim && !this.sprite.anims.currentAnim.key.startsWith(prefix)) {
      this.isAttacking = false;
      this.attackCooldownRemaining = this.attackCooldownMs;
      this.deactivateHitbox();
      this.attackHitTargets.clear();
      this.currentAnimKey = this.idleAnims[this.direction];
    }

    return this.isAttacking;
  }

  /**
   * Get the hitbox zone (for external overlap checks in GameScene).
   */
  getHitbox(): Phaser.GameObjects.Zone | null {
    return this.hitbox;
  }

  /**
   * Whether the hitbox is currently active (in hit window).
   */
  isHitboxActive(): boolean {
    return this.hitboxActive;
  }

  // ─── Health & Damage ───

  /**
   * Take damage from an attacker. Applies knockback, triggers invulnerability + blink.
   * Ignored if already invulnerable or dead.
   */
  takeDamage(amount: number, attacker: Character): void {
    if (this.isInvulnerable || this.isDead) return;

    this.currentHealth = Math.max(0, this.currentHealth - amount);

    // Show health bar on first damage
    if (this.showHealthBar && !this.healthBarVisible) {
      this.healthBarVisible = true;
      if (this.healthBarBg) this.healthBarBg.setVisible(true);
      if (this.healthBarFill) this.healthBarFill.setVisible(true);
    }

    if (this.currentHealth <= 0) {
      this.isDead = true;
      this.onDeath();
    }

    // Knockback: impulse away from attacker
    const attackerSprite = attacker.getSprite();
    const dx = this.sprite.x - attackerSprite.x;
    const dy = this.sprite.y - attackerSprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.isInKnockback = true;
    if (dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      this.sprite.setVelocity(nx * this.knockbackForce, ny * this.knockbackForce);
    }
    // Stop knockback velocity after 200ms
    this.scene.time.delayedCall(200, () => {
      this.isInKnockback = false;
      if (!this.isDead) {
        this.sprite.setVelocity(0, 0);
      }
    });

    // Invulnerability + blink
    this.isInvulnerable = true;
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.3 },
      duration: 80,
      yoyo: true,
      repeat: Math.floor(this.invulnerabilityDurationMs / 160) - 1,
      onComplete: () => {
        this.isInvulnerable = false;
        this.sprite.alpha = 1;
      },
    });
  }

  getHealth(): number {
    return this.currentHealth;
  }

  /**
   * Heal the character by the given amount. Cannot exceed max health.
   */
  heal(amount: number): void {
    if (this.isDead) return;
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  getSpeed(): number {
    return this.speed;
  }

  getIsDead(): boolean {
    return this.isDead;
  }

  getIsInKnockback(): boolean {
    return this.isInKnockback;
  }

  /** Called when HP reaches 0. Override in subclasses for death behavior. */
  protected onDeath(): void {
    // Base implementation does nothing — subclasses override
  }

  // ─── Hit target tracking (prevents multi-hit per swing) ───

  hasAlreadyHitTarget(target: Character): boolean {
    return this.attackHitTargets.has(target);
  }

  registerHit(target: Character): void {
    this.attackHitTargets.add(target);
  }

  // ─── Hitbox management ───

  private activateHitbox(): void {
    this.hitboxActive = true;

    // Calculate hitbox position based on direction
    const pos = this.getHitboxPosition();

    if (!this.hitbox) {
      // Create hitbox zone once
      this.hitbox = this.scene.add.zone(pos.x, pos.y, this.hitboxRadius * 2, this.hitboxRadius * 2);
      this.scene.physics.add.existing(this.hitbox, false);
      this.hitboxBody = this.hitbox.body as Phaser.Physics.Arcade.Body;
      this.hitboxBody.setCircle(this.hitboxRadius);
      this.hitboxBody.setAllowGravity(false);
      this.hitbox.setActive(true);
      this.hitbox.setVisible(false);
    } else {
      this.hitbox.setPosition(pos.x, pos.y);
      this.hitbox.setActive(true);
      if (this.hitboxBody) this.hitboxBody.enable = true;
    }
  }

  private deactivateHitbox(): void {
    this.hitboxActive = false;
    if (this.hitbox && this.hitboxBody) {
      this.hitboxBody.enable = false;
      this.hitbox.setActive(false);
    }
  }

  private getHitboxPosition(): { x: number; y: number } {
    const cx = this.sprite.x;
    const cy = this.sprite.y;
    const offset = this.hitboxOffset;

    switch (this.direction) {
      case 'up':
        return { x: cx, y: cy - offset };
      case 'down':
        return { x: cx, y: cy + offset };
      case 'left':
        return { x: cx - offset, y: cy };
      case 'right':
        return { x: cx + offset, y: cy };
    }
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
    const isBlocked =
      blocked.left ||
      blocked.right ||
      blocked.up ||
      blocked.down ||
      touching.left ||
      touching.right ||
      touching.up ||
      touching.down;

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
    scene.anims.create({
      key: `${p}_idle_down`,
      frames: scene.anims.generateFrameNumbers(key, {
        start: config.idle.down[0],
        end: config.idle.down[1],
      }),
      frameRate: config.idleFrameRate,
      repeat: -1,
    });
    scene.anims.create({
      key: `${p}_idle_right`,
      frames: scene.anims.generateFrameNumbers(key, {
        start: config.idle.right[0],
        end: config.idle.right[1],
      }),
      frameRate: config.idleFrameRate,
      repeat: -1,
    });
    scene.anims.create({
      key: `${p}_idle_up`,
      frames: scene.anims.generateFrameNumbers(key, {
        start: config.idle.up[0],
        end: config.idle.up[1],
      }),
      frameRate: config.idleFrameRate,
      repeat: -1,
    });

    // Walk
    scene.anims.create({
      key: `${p}_walk_down`,
      frames: scene.anims.generateFrameNumbers(key, {
        start: config.walk.down[0],
        end: config.walk.down[1],
      }),
      frameRate: config.walkFrameRate,
      repeat: -1,
    });
    scene.anims.create({
      key: `${p}_walk_right`,
      frames: scene.anims.generateFrameNumbers(key, {
        start: config.walk.right[0],
        end: config.walk.right[1],
      }),
      frameRate: config.walkFrameRate,
      repeat: -1,
    });
    scene.anims.create({
      key: `${p}_walk_up`,
      frames: scene.anims.generateFrameNumbers(key, {
        start: config.walk.up[0],
        end: config.walk.up[1],
      }),
      frameRate: config.walkFrameRate,
      repeat: -1,
    });

    // Attack (optional)
    if (config.attack && config.attackFrameRate) {
      scene.anims.create({
        key: `${p}_attack_down`,
        frames: scene.anims.generateFrameNumbers(key, {
          start: config.attack.down[0],
          end: config.attack.down[1],
        }),
        frameRate: config.attackFrameRate,
        repeat: 0,
        hideOnComplete: false,
      });
      scene.anims.create({
        key: `${p}_attack_right`,
        frames: scene.anims.generateFrameNumbers(key, {
          start: config.attack.right[0],
          end: config.attack.right[1],
        }),
        frameRate: config.attackFrameRate,
        repeat: 0,
        hideOnComplete: false,
      });
      scene.anims.create({
        key: `${p}_attack_up`,
        frames: scene.anims.generateFrameNumbers(key, {
          start: config.attack.up[0],
          end: config.attack.up[1],
        }),
        frameRate: config.attackFrameRate,
        repeat: 0,
        hideOnComplete: false,
      });
    }
  }

  /**
   * Find a valid spawn position avoiding collision tiles.
   * Uses pathfinder nav grid if available for comprehensive validation.
   */
  protected static findValidSpawnPosition(
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
    centerX: number,
    centerY: number,
    radius: number,
    pathfinder?: {
      worldToTile: (x: number, y: number) => { x: number; y: number };
      isWalkable: (x: number, y: number) => boolean;
    },
  ): { x: number; y: number } {
    const { WIDTH, HEIGHT, TILE_SIZE, BORDER_THICKNESS } = MAP_CONFIG;
    const minX = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxX = WIDTH - BORDER_THICKNESS * TILE_SIZE - TILE_SIZE;
    const minY = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE;
    const maxY = HEIGHT - BORDER_THICKNESS * TILE_SIZE - TILE_SIZE;

    for (let attempt = 0; attempt < 200; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      // Use pathfinder grid if available (covers ALL collision sources)
      if (pathfinder) {
        const tile = pathfinder.worldToTile(x, y);
        if (!pathfinder.isWalkable(tile.x, tile.y)) continue;
      } else if (collisionLayer) {
        const tile = collisionLayer.getTileAtWorldXY(x, y);
        if (tile && tile.index !== -1) continue;
      }
      return { x, y };
    }

    return { x: centerX, y: centerY };
  }
}

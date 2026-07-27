import Phaser from 'phaser';
import { MAP_CONFIG } from '../config/map-config';
import { Character, CharacterAnimConfig, CharacterDirection } from './Character';
import { Pathfinder } from '../ai/Pathfinder';

/**
 * Configuration to create an enemy type.
 */
export interface EnemyConfig {
  /** Spritesheet texture key (must be preloaded) */
  textureKey: string;
  /** Animation prefix (e.g. 'skeleton', 'slime') — must be unique per enemy type */
  prefix: string;
  /** Movement speed in pixels per second */
  speed?: number;
  /** Physics body circle radius */
  bodyRadius?: number;
  /** Physics body X offset */
  bodyOffsetX?: number;
  /** Physics body Y offset */
  bodyOffsetY?: number;
  /** Idle animation frame rate */
  idleFrameRate?: number;
  /** Walk animation frame rate */
  walkFrameRate?: number;
  /** Attack animation frame rate */
  attackFrameRate?: number;
  /** Special idle animation frame ranges (optional) */
  specialIdle?: { down: [number, number]; right: [number, number]; up: [number, number] };
  /** Special idle animation frame rate */
  specialIdleFrameRate?: number;
  /** Minimum seconds between special idle attempts */
  specialIdleMinInterval?: number;
  /** Maximum seconds between special idle attempts */
  specialIdleMaxInterval?: number;
  /** Detection radius in pixels */
  detectionRadius?: number;
  /** Attack range in pixels (skeleton attacks when player is within this distance) */
  attackRange?: number;
  /** Death animation frame ranges per orientation (optional) */
  deathAnim?: { down: [number, number]; right: [number, number]; up: [number, number] };
  /** Death animation frame rate */
  deathAnimFrameRate?: number;
  /** Override idle frame ranges (for spritesheets with different column counts) */
  idleFrames?: { down: [number, number]; right: [number, number]; up: [number, number] };
  /** Override walk frame ranges */
  walkFrames?: { down: [number, number]; right: [number, number]; up: [number, number] };
  /** Override attack frame ranges */
  attackFrames?: { down: [number, number]; right: [number, number]; up: [number, number] };
}

/**
 * Generic Enemy entity — extends Character with AI detection, pursuit, and obstacle avoidance.
 */
export class Enemy extends Character {
  readonly enemyType: string;

  // ─── Death animation ───
  private deathAnims: Record<CharacterDirection, string> | null = null;

  // ─── Special idle ───
  private specialIdleAnims: Record<CharacterDirection, string> | null = null;
  private isPlayingSpecial: boolean = false;
  private specialIdleMinMs: number;
  private specialIdleMaxMs: number;
  private specialIdleScheduled: boolean = false;

  // ─── Detection ───
  private detectionRadius: number;
  private attackRange: number;
  private playerDetected: boolean = false;

  // ─── Navigation / stuck detection ───
  private lastPosX: number = 0;
  private lastPosY: number = 0;
  private stuckTime: number = 0;
  private stuckCheckTimer: number = 0;
  private isNavigating: boolean = false;
  private navDirX: number = 0;
  private navDirY: number = 0;
  private navDuration: number = 0;
  private directPursuitCooldown: number = 0;
  private navStartX: number = 0;
  private navStartY: number = 0;

  // ─── A* Pathfinding ───
  private pathfinder: Pathfinder | null = null;
  /** Current A* path waypoints (world positions) */
  private currentPath: { x: number; y: number }[] | null = null;
  /** Index of the current waypoint being pursued */
  private pathIndex: number = 0;
  /** Time since last path recalculation (ms) */
  private pathRecalcTimer: number = 0;
  /** Whether currently following a path */
  private isFollowingPath: boolean = false;

  /** Tuning constants */
  private static readonly STUCK_THRESHOLD_MS = 250;
  private static readonly STUCK_MIN_DISTANCE = 1.5;
  private static readonly STUCK_CHECK_INTERVAL = 120;
  private static readonly NAV_MIN_DURATION = 500;
  private static readonly NAV_MAX_DURATION = 1200;
  private static readonly DIRECT_PURSUIT_COOLDOWN = 200;
  /** How close to a waypoint before advancing to next (px) */
  private static readonly WAYPOINT_TOLERANCE = 10;
  /** Minimum ms between path recalculations */
  private static readonly PATH_RECALC_INTERVAL = 1000;
  /** Distance player must move before recalculating path */
  private static readonly PATH_RECALC_PLAYER_DIST = 48;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig, pathfinder?: Pathfinder) {
    const animConfig: CharacterAnimConfig = {
      textureKey: config.textureKey,
      prefix: config.prefix,
      idle: config.idleFrames ?? { down: [0, 5], right: [6, 11], up: [12, 17] },
      walk: config.walkFrames ?? { down: [18, 23], right: [24, 29], up: [30, 35] },
      attack: config.attackFrames ?? { down: [36, 41], right: [42, 47], up: [48, 53] },
      idleFrameRate: config.idleFrameRate ?? 5,
      walkFrameRate: config.walkFrameRate ?? 8,
      attackFrameRate: config.attackFrameRate ?? 10,
    };

    super(
      scene,
      x,
      y,
      animConfig,
      config.speed ?? 95,
      config.bodyRadius ?? 5,
      config.bodyOffsetX ?? 19,
      config.bodyOffsetY ?? 33,
      { // Combat config for enemies
        attackCooldown: 1000,
        hitWindowStart: 200,
        hitWindowDuration: 200,
        hitboxOffset: 18,
        hitboxRadius: 12,
        maxHealth: 3,
        knockbackForce: 70,
        invulnerabilityDuration: 300,
        showHealthBar: true,
      }
    );

    this.enemyType = config.prefix;
    this.specialIdleMinMs = (config.specialIdleMinInterval ?? 4) * 1000;
    this.specialIdleMaxMs = (config.specialIdleMaxInterval ?? 10) * 1000;
    this.detectionRadius = config.detectionRadius ?? 150;
    this.attackRange = config.attackRange ?? 24;
    this.lastPosX = x;
    this.lastPosY = y;
    this.pathfinder = pathfinder ?? null;

    if (config.specialIdle) {
      this.createSpecialIdleAnimations(scene, config);
      this.scheduleNextSpecialIdle();
    }

    if (config.deathAnim) {
      this.createDeathAnimations(scene, config);
    }
  }

  /**
   * Update enemy each frame. Handles detection, pursuit, attack, and obstacle avoidance.
   * @param playerSprite The player sprite to target
   * @param globalAggro If true, ignores detection radius and always pursues the player
   */
  update(playerSprite: Phaser.Physics.Arcade.Sprite, globalAggro: boolean = false): void {
    // Skip AI if in knockback or dead
    if (this.isInKnockback || this.isDead) return;

    // Handle ongoing attack state (blocks movement)
    if (this.updateAttackState()) return;

    const dx = playerSprite.x - this.sprite.x;
    const dy = playerSprite.y - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const delta = this.scene.game.loop.delta;

    // Detection: normal range OR global aggro active
    const inRange = distance <= this.detectionRadius || globalAggro;

    if (inRange) {
      // ─── Player in range (or global aggro active) ───
      if (!this.playerDetected) {
        this.playerDetected = true;
        this.isPlayingSpecial = false;
        this.resetNavigation();
      }

      const directX = dx / distance;
      const directY = dy / distance;

      // ─── Attack range check ───
      if (distance <= this.attackRange) {
        // Stop moving, orient toward player, and attack
        this.applyMovement(0, 0);

        // Orient toward player
        let newDir: CharacterDirection;
        if (Math.abs(dx) > Math.abs(dy)) {
          newDir = dx < 0 ? 'left' : 'right';
        } else {
          newDir = dy < 0 ? 'up' : 'down';
        }
        this.direction = newDir;
        this.sprite.setFlipX(newDir === 'left');

        // Try to attack (respects cooldown)
        if (this.canAttack()) {
          this.triggerAttack();
        }
        return;
      }

      // ─── Chase: player in detection range but outside attack range ───
      this.updateStuckDetection(delta);
      if (this.directPursuitCooldown > 0) this.directPursuitCooldown -= delta;
      this.pathRecalcTimer += delta;

      let moveX: number;
      let moveY: number;

      if (this.isFollowingPath && this.currentPath && this.pathIndex < this.currentPath.length) {
        // ─── Following A* path ───
        const wp = this.currentPath[this.pathIndex];
        const wpDx = wp.x - this.sprite.x;
        const wpDy = wp.y - this.sprite.y;
        const wpDist = Math.sqrt(wpDx * wpDx + wpDy * wpDy);

        if (wpDist < Enemy.WAYPOINT_TOLERANCE) {
          // Reached waypoint — advance
          this.pathIndex++;
          if (this.pathIndex >= this.currentPath.length) {
            // Path complete — switch to direct pursuit
            this.isFollowingPath = false;
            this.currentPath = null;
          }
        }

        if (this.isFollowingPath && this.currentPath && this.pathIndex < this.currentPath.length) {
          const nextWp = this.currentPath[this.pathIndex];
          const nDx = nextWp.x - this.sprite.x;
          const nDy = nextWp.y - this.sprite.y;
          const nDist = Math.sqrt(nDx * nDx + nDy * nDy);
          moveX = nDist > 0 ? nDx / nDist : directX;
          moveY = nDist > 0 ? nDy / nDist : directY;
        } else {
          moveX = directX;
          moveY = directY;
        }

        // Recalculate path if player moved significantly
        if (this.pathRecalcTimer >= Enemy.PATH_RECALC_INTERVAL && this.currentPath && this.currentPath.length > 0) {
          const lastWp = this.currentPath[this.currentPath.length - 1];
          const pDist = Math.sqrt((playerSprite.x - lastWp.x) ** 2 + (playerSprite.y - lastWp.y) ** 2);
          if (pDist > Enemy.PATH_RECALC_PLAYER_DIST) {
            this.calculatePath(playerSprite.x, playerSprite.y);
          }
          this.pathRecalcTimer = 0;
        }

      } else if (this.isNavigating && this.navDuration > 0) {
        // ─── Basic navigation fallback (Phase 7/8) ───
        this.navDuration -= delta;
        moveX = this.navDirX * 0.8 + directX * 0.3;
        moveY = this.navDirY * 0.8 + directY * 0.3;
        const len = Math.sqrt(moveX * moveX + moveY * moveY);
        if (len > 0) { moveX /= len; moveY /= len; }

        if (this.navDuration <= 0 && this.directPursuitCooldown <= 0) {
          const navDistX = this.sprite.x - this.navStartX;
          const navDistY = this.sprite.y - this.navStartY;
          const navProgress = Math.sqrt(navDistX * navDistX + navDistY * navDistY);
          if (navProgress > 8) {
            this.isNavigating = false;
            this.stuckTime = 0;
          } else {
            // Basic nav failed — try A* pathfinding
            this.tryPathfinding(playerSprite.x, playerSprite.y, directX, directY);
          }
        }
      } else {
        // ─── Direct pursuit ───
        moveX = directX;
        moveY = directY;
      }

      this.applyMovement(moveX, moveY);

    } else {
      // ─── Player out of range: idle ───
      if (this.playerDetected) {
        this.playerDetected = false;
        this.applyMovement(0, 0);
        this.resetNavigation();
        if (!this.specialIdleScheduled && this.specialIdleAnims) {
          this.scheduleNextSpecialIdle();
        }
      }
    }
  }

  // ─── Stuck Detection & Navigation ──────────────────────────────────────

  private updateStuckDetection(delta: number): void {
    this.stuckCheckTimer += delta;

    if (this.stuckCheckTimer >= Enemy.STUCK_CHECK_INTERVAL) {
      this.stuckCheckTimer = 0;

      const movedX = this.sprite.x - this.lastPosX;
      const movedY = this.sprite.y - this.lastPosY;
      const movedDist = Math.sqrt(movedX * movedX + movedY * movedY);

      if (movedDist < Enemy.STUCK_MIN_DISTANCE) {
        this.stuckTime += Enemy.STUCK_CHECK_INTERVAL;

        if (this.stuckTime >= Enemy.STUCK_THRESHOLD_MS) {
          if (this.isFollowingPath) {
            // Stuck while following A* path — path may be invalid, recalculate
            this.isFollowingPath = false;
            this.currentPath = null;
            this.stuckTime = 0;
          } else if (!this.isNavigating) {
            // Stuck in direct pursuit — try basic navigation first
            const body = this.sprite.body as Phaser.Physics.Arcade.Body;
            const vx = body?.velocity.x ?? 0;
            const vy = body?.velocity.y ?? 0;
            const vLen = Math.sqrt(vx * vx + vy * vy);
            const normVX = vLen > 0 ? vx / vLen : 0;
            const normVY = vLen > 0 ? vy / vLen : 0;
            this.chooseAlternateDirection(normVX, normVY);
          }
        }
      } else {
        this.stuckTime = 0;
      }

      this.lastPosX = this.sprite.x;
      this.lastPosY = this.sprite.y;
    }
  }

  /**
   * Choose the best alternate direction to navigate around an obstacle.
   * Evaluates perpendicular directions and picks the one that doesn't repeat
   * the previously blocked direction.
   */
  private chooseAlternateDirection(intendedX: number, intendedY: number): void {
    // Remember intended direction for context
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    const blocked = body.blocked;
    const touching = body.touching;
    const blockedLeft = blocked.left || touching.left;
    const blockedRight = blocked.right || touching.right;
    const blockedUp = blocked.up || touching.up;
    const blockedDown = blocked.down || touching.down;

    // Candidate directions: perpendicular to the intended movement
    type Candidate = { x: number; y: number; blocked: boolean };
    const candidates: Candidate[] = [];

    if (blockedLeft || blockedRight) {
      // Blocked horizontally → try vertical options
      candidates.push({ x: 0, y: -1, blocked: blockedUp });
      candidates.push({ x: 0, y: 1, blocked: blockedDown });
    }
    if (blockedUp || blockedDown) {
      // Blocked vertically → try horizontal options
      candidates.push({ x: -1, y: 0, blocked: blockedLeft });
      candidates.push({ x: 1, y: 0, blocked: blockedRight });
    }

    // If no clear axis block detected, add all perpendiculars
    if (candidates.length === 0) {
      candidates.push(
        { x: 0, y: -1, blocked: blockedUp },
        { x: 0, y: 1, blocked: blockedDown },
        { x: -1, y: 0, blocked: blockedLeft },
        { x: 1, y: 0, blocked: blockedRight }
      );
    }

    // Filter out blocked directions and directions that are the same as our last failed nav
    const viable = candidates.filter(c => {
      if (c.blocked) return false;
      // Avoid choosing the exact same direction we previously navigated (if it failed)
      if (this.isNavigating && c.x === this.navDirX && c.y === this.navDirY) return false;
      return true;
    });

    let chosen: { x: number; y: number };

    if (viable.length > 0) {
      // Pick the candidate that is least opposite to the player direction
      // (i.e., doesn't take us directly away from the player)
      viable.sort((a, b) => {
        const dotA = a.x * intendedX + a.y * intendedY;
        const dotB = b.x * intendedX + b.y * intendedY;
        // Higher dot product = more aligned with player direction (prefer this)
        return dotB - dotA;
      });
      chosen = viable[0];
    } else {
      // All directions blocked or failed — try the opposite of intended (retreat slightly)
      chosen = { x: -intendedX, y: -intendedY };
    }

    this.navDirX = chosen.x;
    this.navDirY = chosen.y;
    this.isNavigating = true;
    this.navDuration = Phaser.Math.Between(Enemy.NAV_MIN_DURATION, Enemy.NAV_MAX_DURATION);
    this.navStartX = this.sprite.x;
    this.navStartY = this.sprite.y;
    this.directPursuitCooldown = Enemy.DIRECT_PURSUIT_COOLDOWN;
    this.stuckTime = 0;
  }

  private resetNavigation(): void {
    this.isNavigating = false;
    this.navDuration = 0;
    this.stuckTime = 0;
    this.stuckCheckTimer = 0;
    this.directPursuitCooldown = 0;
    this.lastPosX = this.sprite.x;
    this.lastPosY = this.sprite.y;
    this.isFollowingPath = false;
    this.currentPath = null;
    this.pathIndex = 0;
    this.pathRecalcTimer = 0;
  }

  /**
   * Try A* pathfinding. If no pathfinder available or no path found, fall back to basic nav.
   */
  private tryPathfinding(playerX: number, playerY: number, directX: number, directY: number): void {
    if (this.pathfinder) {
      const path = this.calculatePath(playerX, playerY);
      if (path) return; // Successfully started following a path
    }
    // Fallback: choose a new alternate direction (Phase 7/8 behavior)
    this.chooseAlternateDirection(directX, directY);
  }

  /**
   * Calculate A* path to the player position. Returns true if a valid path was found.
   */
  private calculatePath(goalX: number, goalY: number): boolean {
    if (!this.pathfinder) return false;

    const path = this.pathfinder.findPath(this.sprite.x, this.sprite.y, goalX, goalY);
    if (path && path.length > 0) {
      this.currentPath = path;
      this.pathIndex = 0;
      this.isFollowingPath = true;
      this.isNavigating = false;
      this.stuckTime = 0;
      this.pathRecalcTimer = 0;
      return true;
    }

    return false;
  }

  // ─── Special Idle Animation System ─────────────────────────────────────

  private createSpecialIdleAnimations(scene: Phaser.Scene, config: EnemyConfig): void {
    if (!config.specialIdle) return;

    const p = config.prefix;
    const key = config.textureKey;
    const rate = config.specialIdleFrameRate ?? 6;

    if (!scene.anims.exists(`${p}_special_idle_down`)) {
      scene.anims.create({
        key: `${p}_special_idle_down`,
        frames: scene.anims.generateFrameNumbers(key, { start: config.specialIdle.down[0], end: config.specialIdle.down[1] }),
        frameRate: rate,
        repeat: 0,
        hideOnComplete: false,
      });
      scene.anims.create({
        key: `${p}_special_idle_right`,
        frames: scene.anims.generateFrameNumbers(key, { start: config.specialIdle.right[0], end: config.specialIdle.right[1] }),
        frameRate: rate,
        repeat: 0,
        hideOnComplete: false,
      });
      scene.anims.create({
        key: `${p}_special_idle_up`,
        frames: scene.anims.generateFrameNumbers(key, { start: config.specialIdle.up[0], end: config.specialIdle.up[1] }),
        frameRate: rate,
        repeat: 0,
        hideOnComplete: false,
      });
    }

    this.specialIdleAnims = {
      down: `${p}_special_idle_down`,
      right: `${p}_special_idle_right`,
      left: `${p}_special_idle_right`,
      up: `${p}_special_idle_up`,
    };
  }

  private scheduleNextSpecialIdle(): void {
    if (this.specialIdleScheduled) return;
    this.specialIdleScheduled = true;

    const delay = Phaser.Math.Between(this.specialIdleMinMs, this.specialIdleMaxMs);
    this.scene.time.delayedCall(delay, () => {
      this.specialIdleScheduled = false;
      this.tryPlaySpecialIdle();
    });
  }

  private tryPlaySpecialIdle(): void {
    if (!this.specialIdleAnims) return;
    if (this.playerDetected || this.isMoving || this.isAttacking || this.isPlayingSpecial) {
      this.scheduleNextSpecialIdle();
      return;
    }

    this.isPlayingSpecial = true;

    const animKey = this.specialIdleAnims[this.direction];
    const idleKey = this.idleAnims[this.direction];
    this.sprite.setFlipX(this.direction === 'left');
    this.currentAnimKey = animKey;
    this.sprite.play(animKey);
    this.sprite.chain(idleKey);

    const checkComplete = () => {
      if (!this.isPlayingSpecial) return;
      const currentKey = this.sprite.anims.currentAnim?.key;
      if (currentKey && !currentKey.includes('special')) {
        this.isPlayingSpecial = false;
        this.currentAnimKey = idleKey;
        if (!this.playerDetected) {
          this.scheduleNextSpecialIdle();
        }
      } else {
        this.scene.time.delayedCall(100, checkComplete);
      }
    };
    this.scene.time.delayedCall(500, checkComplete);
  }

  // ─── Death Animation System ─────────────────────────────────────────

  private createDeathAnimations(scene: Phaser.Scene, config: EnemyConfig): void {
    if (!config.deathAnim) return;

    const p = config.prefix;
    const key = config.textureKey;
    const rate = config.deathAnimFrameRate ?? 8;

    if (!scene.anims.exists(`${p}_death_down`)) {
      scene.anims.create({
        key: `${p}_death_down`,
        frames: scene.anims.generateFrameNumbers(key, { start: config.deathAnim.down[0], end: config.deathAnim.down[1] }),
        frameRate: rate,
        repeat: 0,
        hideOnComplete: false,
      });
      scene.anims.create({
        key: `${p}_death_right`,
        frames: scene.anims.generateFrameNumbers(key, { start: config.deathAnim.right[0], end: config.deathAnim.right[1] }),
        frameRate: rate,
        repeat: 0,
        hideOnComplete: false,
      });
      scene.anims.create({
        key: `${p}_death_up`,
        frames: scene.anims.generateFrameNumbers(key, { start: config.deathAnim.up[0], end: config.deathAnim.up[1] }),
        frameRate: rate,
        repeat: 0,
        hideOnComplete: false,
      });
    }

    this.deathAnims = {
      down: `${p}_death_down`,
      right: `${p}_death_right`,
      left: `${p}_death_right`,
      up: `${p}_death_up`,
    };
  }

  /**
   * Play death animation and destroy the enemy when complete.
   */
  die(): void {
    if (!this.isDead) return;

    // Stop all movement and AI
    this.sprite.setVelocity(0, 0);
    this.isInKnockback = false;

    // Disable physics body so it doesn't block the player
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (body) body.enable = false;

    // Play death animation based on current direction
    if (this.deathAnims) {
      const deathKey = this.deathAnims[this.direction];
      this.sprite.setFlipX(this.direction === 'left');
      this.sprite.play(deathKey);

      this.sprite.once('animationcomplete', () => {
        this.destroy();
      });
    } else {
      // No death animation — destroy immediately
      this.destroy();
    }
  }

  private destroy(): void {
    this.destroyHealthBar();
    this.sprite.destroy();
  }

  // ─── onDeath override ─────────────────────────────────────────────────

  protected override onDeath(): void {
    this.die();
  }

  // ─── Spawn Position ────────────────────────────────────────────────────

  static findSpawnPosition(
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
    elevatedLayer?: Phaser.Tilemaps.TilemapLayer | null
  ): { x: number; y: number } {
    const { WIDTH, HEIGHT, TILE_SIZE, BORDER_THICKNESS, SPAWN_SAFE_RADIUS } = MAP_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const minX = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE * 2;
    const maxX = WIDTH - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE * 2;
    const minY = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE * 2;
    const maxY = HEIGHT - (BORDER_THICKNESS * TILE_SIZE) - TILE_SIZE * 2;

    for (let attempt = 0; attempt < 200; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (distToCenter < SPAWN_SAFE_RADIUS + 100) continue;

      if (collisionLayer) {
        const tile = collisionLayer.getTileAtWorldXY(x, y);
        if (tile && tile.index !== -1) continue;
      }

      if (elevatedLayer) {
        const tile = elevatedLayer.getTileAtWorldXY(x, y);
        if (tile && tile.index !== -1) continue;
      }

      return { x, y };
    }

    return { x: minX + 100, y: minY + 100 };
  }
}

// ─── Predefined enemy type configs ──────────────────────────────────────────

export const ENEMY_TYPES = {
  SKELETON: {
    textureKey: 'skeleton_swordless',
    prefix: 'skeleton',
    speed: 108,  // ~90% of player speed (120)
    detectionRadius: 150,
    attackRange: 22,
    specialIdle: {
      down: [54, 56],
      right: [60, 62],
      up: [66, 68],
    },
    specialIdleFrameRate: 6,
    specialIdleMinInterval: 4,
    specialIdleMaxInterval: 10,
    deathAnim: {
      down: [72, 77],
      right: [72, 77],
      up: [72, 77],
    },
    deathAnimFrameRate: 8,
  } satisfies EnemyConfig,

  SKELETON_SWORD: {
    textureKey: 'skeleton',
    prefix: 'skeleton_sword',
    speed: 100,
    detectionRadius: 160,
    attackRange: 24,
    specialIdle: {
      down: [54, 56],
      right: [60, 62],
      up: [66, 68],
    },
    specialIdleFrameRate: 6,
    specialIdleMinInterval: 5,
    specialIdleMaxInterval: 12,
    deathAnim: {
      down: [72, 77],
      right: [72, 77],
      up: [72, 77],
    },
    deathAnimFrameRate: 8,
  } satisfies EnemyConfig,

  SLIME: {
    textureKey: 'slime',
    prefix: 'slime',
    speed: 70,
    detectionRadius: 120,
    attackRange: 18,
    bodyRadius: 4,
    bodyOffsetX: 12,
    bodyOffsetY: 20,
    idleFrames: { down: [0, 3], right: [7, 10], up: [14, 17] },
    walkFrames: { down: [21, 26], right: [28, 33], up: [35, 40] },
    attackFrames: { down: [42, 48], right: [49, 55], up: [56, 62] },
    specialIdle: {
      down: [63, 65],
      right: [70, 72],
      up: [77, 79],
    },
    specialIdleFrameRate: 5,
    specialIdleMinInterval: 5,
    specialIdleMaxInterval: 12,
    deathAnim: {
      down: [84, 88],
      right: [84, 88],
      up: [84, 88],
    },
    deathAnimFrameRate: 8,
  } satisfies EnemyConfig,
} as const;

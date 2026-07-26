import Phaser from 'phaser';
import { MAP_CONFIG } from '../config/map-config';
import { Character, CharacterAnimConfig } from './Character';

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
}

/**
 * Generic Enemy entity — extends Character.
 *
 * Works with any enemy spritesheet that follows this layout (6 cols, 48×48 frames):
 *   Row 0 (frames 0-5):   Idle Down
 *   Row 1 (frames 6-11):  Idle Right (flipX for Left)
 *   Row 2 (frames 12-17): Idle Up
 *   Row 3 (frames 18-23): Walk Down
 *   Row 4 (frames 24-29): Walk Right (flipX for Left)
 *   Row 5 (frames 30-35): Walk Up
 *   Row 6 (frames 36-41): Attack Down
 *   Row 7 (frames 42-47): Attack Right (flipX for Left)
 *   Row 8 (frames 48-53): Attack Up
 *   Rows 9+: Death/additional — NOT used yet
 *
 * Currently: spawns idle, no AI, no movement.
 * Future phases will add AI pursuit, attacks, and damage.
 */
export class Enemy extends Character {
  /** The enemy type config used to create this instance */
  readonly enemyType: string;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    const animConfig: CharacterAnimConfig = {
      textureKey: config.textureKey,
      prefix: config.prefix,
      idle: { down: [0, 5], right: [6, 11], up: [12, 17] },
      walk: { down: [18, 23], right: [24, 29], up: [30, 35] },
      attack: { down: [36, 41], right: [42, 47], up: [48, 53] },
      idleFrameRate: config.idleFrameRate ?? 5,
      walkFrameRate: config.walkFrameRate ?? 8,
      attackFrameRate: config.attackFrameRate ?? 10,
    };

    super(
      scene,
      x,
      y,
      animConfig,
      config.speed ?? 60,
      config.bodyRadius ?? 5,
      config.bodyOffsetX ?? 19,
      config.bodyOffsetY ?? 33
    );

    this.enemyType = config.prefix;
  }

  /**
   * Find a valid spawn position for an enemy.
   * Spawns away from the center (player spawn area).
   */
  static findSpawnPosition(collisionLayer: Phaser.Tilemaps.TilemapLayer | null): { x: number; y: number } {
    const offsetX = (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 300);
    const offsetY = (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 300);
    return Character.findValidSpawnPosition(
      collisionLayer,
      MAP_CONFIG.WIDTH / 2 + offsetX,
      MAP_CONFIG.HEIGHT / 2 + offsetY,
      150
    );
  }
}

// ─── Predefined enemy type configs ──────────────────────────────────────────

export const ENEMY_TYPES = {
  SKELETON: {
    textureKey: 'skeleton_swordless',
    prefix: 'skeleton',
    speed: 60,
  } satisfies EnemyConfig,
  // Future enemy types:
  // SLIME: { textureKey: 'slime', prefix: 'slime', speed: 40 } satisfies EnemyConfig,
} as const;

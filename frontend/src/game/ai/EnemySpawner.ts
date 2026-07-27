import Phaser from 'phaser';
import { MAP_CONFIG } from '../config/map-config';
import { Enemy, EnemyConfig, ENEMY_TYPES } from '../entities/Enemy';
import { Pathfinder } from './Pathfinder';

/**
 * Spawn request — defines what type and how many enemies to spawn.
 */
export interface SpawnRequest {
  config: EnemyConfig;
  count: number;
}

/**
 * EnemySpawner — manages enemy creation, position validation, and active enemy tracking.
 *
 * Responsibilities:
 * - Generate valid spawn positions (respects collisions, player safe zone, min distance)
 * - Create enemies with full collider registration
 * - Track active (alive) enemies
 * - Provide count of living enemies for future wave system
 */
export class EnemySpawner {
  private scene: Phaser.Scene;
  private pathfinder: Pathfinder;
  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null;
  private elevatedLayer: Phaser.Tilemaps.TilemapLayer | null;
  private fenceLayer: Phaser.Tilemaps.TilemapLayer | null;
  private graveColliders: Phaser.Physics.Arcade.StaticGroup | null;
  private treeColliders: Phaser.Physics.Arcade.StaticGroup | null;
  private obstacleColliders: Phaser.Physics.Arcade.StaticGroup | null;

  /** All enemies ever spawned (including dead) */
  private allEnemies: Enemy[] = [];

  /** Configuration */
  private static readonly MAX_SPAWN_ATTEMPTS = 50;
  private static readonly MIN_ENEMY_DISTANCE = 80; // px between enemies

  constructor(
    scene: Phaser.Scene,
    pathfinder: Pathfinder,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
    elevatedLayer: Phaser.Tilemaps.TilemapLayer | null,
    fenceLayer: Phaser.Tilemaps.TilemapLayer | null,
    graveColliders: Phaser.Physics.Arcade.StaticGroup | null,
    treeColliders: Phaser.Physics.Arcade.StaticGroup | null,
    obstacleColliders: Phaser.Physics.Arcade.StaticGroup | null,
  ) {
    this.scene = scene;
    this.pathfinder = pathfinder;
    this.collisionLayer = collisionLayer;
    this.elevatedLayer = elevatedLayer;
    this.fenceLayer = fenceLayer;
    this.graveColliders = graveColliders;
    this.treeColliders = treeColliders;
    this.obstacleColliders = obstacleColliders;
  }

  /**
   * Spawn the initial set of enemies for the game.
   */
  spawnInitial(): Enemy[] {
    const requests: SpawnRequest[] = [
      { config: ENEMY_TYPES.SKELETON, count: 1 },
      { config: ENEMY_TYPES.SKELETON_SWORD, count: 1 },
      { config: ENEMY_TYPES.SLIME, count: 1 },
    ];
    return this.spawnBatch(requests);
  }

  /**
   * Spawn a batch of enemies from multiple requests.
   */
  spawnBatch(requests: SpawnRequest[]): Enemy[] {
    const spawned: Enemy[] = [];
    for (const req of requests) {
      for (let i = 0; i < req.count; i++) {
        const enemy = this.spawnEnemy(req.config);
        if (enemy) spawned.push(enemy);
      }
    }
    return spawned;
  }

  /**
   * Spawn a single enemy of the given config at a valid position.
   * Returns null if no valid position found after max attempts.
   */
  spawnEnemy(config: EnemyConfig): Enemy | null {
    const pos = this.findValidPosition();
    if (!pos) {
      console.warn(`[EnemySpawner] Could not find valid position for ${config.prefix}`);
      return null;
    }

    const enemy = new Enemy(this.scene, pos.x, pos.y, config, this.pathfinder);

    // Register colliders
    const sprite = enemy.getSprite();
    if (this.collisionLayer) this.scene.physics.add.collider(sprite, this.collisionLayer);
    if (this.elevatedLayer) this.scene.physics.add.collider(sprite, this.elevatedLayer);
    if (this.fenceLayer) this.scene.physics.add.collider(sprite, this.fenceLayer);
    if (this.graveColliders) this.scene.physics.add.collider(sprite, this.graveColliders);
    if (this.treeColliders) this.scene.physics.add.collider(sprite, this.treeColliders);
    if (this.obstacleColliders) this.scene.physics.add.collider(sprite, this.obstacleColliders);

    this.allEnemies.push(enemy);
    return enemy;
  }

  /**
   * Get all enemies (including dead ones — for iteration in game loop).
   */
  getAllEnemies(): Enemy[] {
    return this.allEnemies;
  }

  /**
   * Get count of currently alive enemies.
   */
  getAliveCount(): number {
    return this.allEnemies.filter((e) => !e.getIsDead()).length;
  }

  /**
   * Check if all enemies are dead.
   */
  allDead(): boolean {
    return this.allEnemies.length > 0 && this.getAliveCount() === 0;
  }

  /**
   * Find a valid spawn position that:
   * - Is away from player spawn center
   * - Is not on collision tiles
   * - Is not on elevated terrain
   * - Is not too close to other spawned enemies
   */
  private findValidPosition(): { x: number; y: number } | null {
    const { WIDTH, HEIGHT, TILE_SIZE, BORDER_THICKNESS, SPAWN_SAFE_RADIUS } = MAP_CONFIG;
    const centerX = WIDTH / 2;
    const centerY = HEIGHT / 2;
    const minX = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE * 2;
    const maxX = WIDTH - BORDER_THICKNESS * TILE_SIZE - TILE_SIZE * 2;
    const minY = BORDER_THICKNESS * TILE_SIZE + TILE_SIZE * 2;
    const maxY = HEIGHT - BORDER_THICKNESS * TILE_SIZE - TILE_SIZE * 2;

    for (let attempt = 0; attempt < EnemySpawner.MAX_SPAWN_ATTEMPTS; attempt++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      // Must be away from player spawn center
      const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (distToCenter < SPAWN_SAFE_RADIUS + 100) continue;

      // Must not be on wall tiles
      if (this.collisionLayer) {
        const tile = this.collisionLayer.getTileAtWorldXY(x, y);
        if (tile && tile.index !== -1) continue;
      }

      // Must not be on elevated terrain
      if (this.elevatedLayer) {
        const tile = this.elevatedLayer.getTileAtWorldXY(x, y);
        if (tile && tile.index !== -1) continue;
      }

      // Must not be too close to other already-spawned enemies
      let tooClose = false;
      for (const existing of this.allEnemies) {
        if (existing.getIsDead()) continue;
        const ex = existing.getSprite().x;
        const ey = existing.getSprite().y;
        const dist = Math.sqrt((x - ex) ** 2 + (y - ey) ** 2);
        if (dist < EnemySpawner.MIN_ENEMY_DISTANCE) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      return { x, y };
    }

    return null;
  }
}

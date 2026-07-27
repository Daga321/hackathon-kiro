import Phaser from 'phaser';
import { EnemySpawner, SpawnRequest } from './EnemySpawner';
import { Enemy, ENEMY_TYPES } from '../entities/Enemy';
import { getEnemyCount, getEnemyHP, getEnemyDamage, getEnemySpeedMultiplier, getEnemyScoreReward } from '../config/difficulty-config';

/** Wave state */
type WaveState = 'spawning' | 'active' | 'waiting_next' | 'stopped';

/**
 * WaveManager — controls the wave-based enemy spawn system.
 *
 * Uses EnemySpawner for actual enemy creation.
 * Handles wave progression, enemy count scaling, and wave transitions.
 */
export class WaveManager {
  private scene: Phaser.Scene;
  private spawner: EnemySpawner;
  private state: WaveState = 'stopped';
  private currentWave: number = 0;
  private waveEnemies: Enemy[] = [];
  private currentWaveScoreReward: number = 10;

  /** Time between waves (ms) */
  private static readonly WAVE_DELAY_MS = 3000;

  constructor(scene: Phaser.Scene, spawner: EnemySpawner) {
    this.scene = scene;
    this.spawner = spawner;
  }

  /**
   * Start the wave system. Call once after scene setup.
   */
  start(): void {
    this.startWave(1);
  }

  /**
   * Update each frame. Checks for wave completion.
   * @param playerDead Whether the player is dead (stops progression)
   */
  update(playerDead: boolean): void {
    if (this.state === 'stopped') return;
    if (playerDead) {
      this.state = 'stopped';
      return;
    }

    if (this.state === 'active') {
      // Check if all wave enemies are dead
      const alive = this.waveEnemies.filter(e => !e.getIsDead()).length;

      if (alive === 0) {
        this.state = 'waiting_next';
        this.scene.time.delayedCall(WaveManager.WAVE_DELAY_MS, () => {
          if (this.state === 'waiting_next') {
            this.startWave(this.currentWave + 1);
          }
        });
      }
    }
  }

  /**
   * Get current wave number.
   */
  getWave(): number {
    return this.currentWave;
  }

  /**
   * Get all enemies from all waves (for game loop iteration).
   */
  getAllEnemies(): Enemy[] {
    return this.spawner.getAllEnemies();
  }

  /**
   * Get the score reward per enemy kill for the current wave.
   */
  getScoreReward(): number {
    return this.currentWaveScoreReward;
  }

  // ─── Private ───

  private startWave(wave: number): void {
    this.currentWave = wave;
    this.state = 'spawning';
    this.currentWaveScoreReward = getEnemyScoreReward(wave);

    const requests = this.buildWaveRequests(wave);
    const waveOverrides = {
      hp: getEnemyHP(wave),
      damage: getEnemyDamage(wave),
      speedMultiplier: getEnemySpeedMultiplier(wave),
    };
    this.waveEnemies = this.spawner.spawnBatch(requests, waveOverrides);

    this.state = 'active';
  }

  /**
   * Build spawn requests for a given wave number.
   * Scales enemy count: base + (wave - 1)
   * Distributes types round-robin.
   */
  private buildWaveRequests(wave: number): SpawnRequest[] {
    const totalEnemies = getEnemyCount(wave);

    // Available enemy types
    const types = [ENEMY_TYPES.SKELETON, ENEMY_TYPES.SKELETON_SWORD, ENEMY_TYPES.SLIME];

    // Distribute round-robin
    const counts = new Array(types.length).fill(0);
    for (let i = 0; i < totalEnemies; i++) {
      counts[i % types.length]++;
    }

    return types.map((config, idx) => ({
      config,
      count: counts[idx],
    }));
  }
}

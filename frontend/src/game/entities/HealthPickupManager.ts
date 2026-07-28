import Phaser from 'phaser';
import { HealthPickup } from './HealthPickup';
import { DIFFICULTY_CONFIG } from '../config/difficulty-config';

/**
 * HealthPickupManager — handles spawning, updating, and cleanup of health pickups.
 *
 * Listens for enemy death events and spawns pickups based on configurable drop chance.
 * Provides methods to check collection and render on minimap.
 */
export class HealthPickupManager {
  private scene: Phaser.Scene;
  private pickups: HealthPickup[] = [];
  private dropChance: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.dropChance = DIFFICULTY_CONFIG.HEALTH_PICKUP_DROP_CHANCE;
  }

  /**
   * Try to spawn a health pickup at the given position.
   * Uses configured drop chance to determine if a pickup should spawn.
   * @param x World X position (enemy death location)
   * @param y World Y position (enemy death location)
   * @returns true if a pickup was spawned
   */
  trySpawn(x: number, y: number): boolean {
    if (Math.random() > this.dropChance) return false;

    const pickup = new HealthPickup(this.scene, x, y);
    this.pickups.push(pickup);
    return true;
  }

  /**
   * Update all active pickups (despawn timers).
   * @param delta Frame delta in ms
   */
  update(delta: number): void {
    for (const pickup of this.pickups) {
      pickup.update(delta);
    }
    // Remove expired/collected pickups from the array
    this.pickups = this.pickups.filter((p) => !p.isGone());
  }

  /**
   * Check if the player is close enough to collect any pickup.
   * @param playerX Player world X
   * @param playerY Player world Y
   * @param collectRadius Distance threshold for collection
   * @returns Array of heal amounts collected this frame
   */
  checkCollection(playerX: number, playerY: number, collectRadius: number = 14): number[] {
    const heals: number[] = [];

    for (const pickup of this.pickups) {
      if (pickup.isGone()) continue;
      const pos = pickup.getPosition();
      const dist = Phaser.Math.Distance.Between(playerX, playerY, pos.x, pos.y);
      if (dist <= collectRadius) {
        const amount = pickup.collect();
        if (amount > 0) heals.push(amount);
      }
    }

    return heals;
  }

  /**
   * Get all active pickup positions for minimap rendering.
   */
  getActivePositions(): { x: number; y: number }[] {
    return this.pickups.filter((p) => !p.isGone()).map((p) => p.getPosition());
  }

  /**
   * Destroy all pickups (cleanup on scene restart).
   */
  destroyAll(): void {
    // Pickups destroy their own sprites in collect/expire,
    // but force-expire any remaining ones
    for (const pickup of this.pickups) {
      if (!pickup.isGone()) {
        pickup.collect(); // triggers destroy
      }
    }
    this.pickups = [];
  }
}

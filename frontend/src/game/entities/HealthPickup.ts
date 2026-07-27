import Phaser from 'phaser';
import { DIFFICULTY_CONFIG } from '../config/difficulty-config';
import { TILESET_KEYS } from '../config/map-config';

/**
 * HealthPickup — a collectible heart item that heals the player.
 *
 * Features:
 * - Uses tile 40 from the objects spritesheet (heart icon)
 * - Despawns after a configurable duration with blink warning
 * - Blink animation starts at 70% of lifetime
 * - Collection detected via overlap with player sprite
 */
export class HealthPickup {
  private sprite: Phaser.GameObjects.Sprite;
  private scene: Phaser.Scene;
  private elapsed: number = 0;
  private despawnTime: number;
  private healAmount: number;
  private _isCollected: boolean = false;
  private _isExpired: boolean = false;
  private blinkTween: Phaser.Tweens.Tween | null = null;

  /** Frame index for heart in objects spritesheet (16-col grid, tile 40) */
  private static readonly HEART_FRAME = 40;
  /** Blink starts at this percentage of lifetime */
  private static readonly BLINK_START_RATIO = 0.7;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.despawnTime = DIFFICULTY_CONFIG.HEALTH_PICKUP_DESPAWN_MS;
    this.healAmount = DIFFICULTY_CONFIG.HEALTH_PICKUP_HEAL_AMOUNT;

    // Create sprite from objects spritesheet, frame 40
    this.sprite = scene.add.sprite(x, y, TILESET_KEYS.OBJECTS, HealthPickup.HEART_FRAME);
    this.sprite.setDepth(50);
    this.sprite.setScale(1.5); // Slightly larger for visibility

    // Small floating bob animation
    scene.tweens.add({
      targets: this.sprite,
      y: y - 3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Update each frame. Handles despawn timer and blink.
   * @param delta Frame delta in ms
   */
  update(delta: number): void {
    if (this._isCollected || this._isExpired) return;

    this.elapsed += delta;

    // Start blinking when approaching despawn
    const blinkThreshold = this.despawnTime * HealthPickup.BLINK_START_RATIO;
    if (this.elapsed >= blinkThreshold && !this.blinkTween) {
      this.startBlink();
    }

    // Despawn when time runs out
    if (this.elapsed >= this.despawnTime) {
      this.expire();
    }
  }

  /**
   * Collect this pickup. Returns the heal amount.
   */
  collect(): number {
    if (this._isCollected || this._isExpired) return 0;
    this._isCollected = true;
    this.destroy();
    return this.healAmount;
  }

  /**
   * Get the sprite for overlap/distance checks.
   */
  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  /**
   * Get world position for minimap rendering.
   */
  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  /**
   * Whether this pickup has been collected or expired.
   */
  isGone(): boolean {
    return this._isCollected || this._isExpired;
  }

  // ─── Private ───

  private startBlink(): void {
    this.blinkTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 1, to: 0.2 },
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private expire(): void {
    this._isExpired = true;
    this.destroy();
  }

  private destroy(): void {
    if (this.blinkTween) {
      this.blinkTween.stop();
      this.blinkTween = null;
    }
    this.sprite.destroy();
  }
}

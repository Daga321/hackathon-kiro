import Phaser from 'phaser';

/**
 * Damage indicator event types with associated colors.
 */
export enum DamageType {
  /** Damage dealt to enemies */
  DEALT = 'dealt',
  /** Damage received by player */
  RECEIVED = 'received',
  /** Critical damage (future support) */
  CRITICAL = 'critical',
  /** Healing (future support) */
  HEAL = 'heal',
}

/** Color map for each damage type */
const DAMAGE_COLORS: Record<DamageType, string> = {
  [DamageType.DEALT]: '#ffffff',
  [DamageType.RECEIVED]: '#ff4444',
  [DamageType.CRITICAL]: '#ffdd00',
  [DamageType.HEAL]: '#44ff44',
};

/** Configuration for the damage indicator system */
interface DamageIndicatorConfig {
  /** Maximum simultaneous indicators on screen */
  maxIndicators: number;
  /** Lifetime of each indicator in ms */
  lifetime: number;
  /** Vertical travel distance in pixels */
  floatDistance: number;
  /** Font size in pixels */
  fontSize: number;
  /** Vertical offset between stacked indicators at the same position */
  stackOffset: number;
}

/** Internal state for a pooled indicator */
interface IndicatorEntry {
  text: Phaser.GameObjects.Text;
  active: boolean;
  elapsed: number;
  lifetime: number;
  startX: number;
  startY: number;
  floatDistance: number;
}

/**
 * DamageIndicatorSystem — manages floating damage numbers with object pooling.
 *
 * Features:
 * - Object pooling to minimize allocations
 * - Upward float + fade-out animation
 * - Color-coded by damage type
 * - Vertical stacking when multiple indicators spawn at the same location
 * - Configurable max simultaneous indicators
 */
export class DamageIndicatorSystem {
  private scene: Phaser.Scene;
  private pool: IndicatorEntry[] = [];
  private config: DamageIndicatorConfig;

  /** Track recent spawn positions to stack vertically */
  private recentPositions: Map<string, { count: number; timestamp: number }> = new Map();
  private static readonly STACK_WINDOW_MS = 400;

  constructor(scene: Phaser.Scene, config?: Partial<DamageIndicatorConfig>) {
    this.scene = scene;
    this.config = {
      maxIndicators: config?.maxIndicators ?? 20,
      lifetime: config?.lifetime ?? 650,
      floatDistance: config?.floatDistance ?? 18,
      fontSize: config?.fontSize ?? 7,
      stackOffset: config?.stackOffset ?? 10,
    };

    this.initPool();
  }

  /**
   * Spawn a damage indicator at the given world position.
   * @param x - World X position
   * @param y - World Y position
   * @param value - Damage/heal value to display
   * @param type - Type of damage event (determines color)
   */
  spawn(x: number, y: number, value: number, type: DamageType = DamageType.DEALT): void {
    const entry = this.getAvailableEntry();
    if (!entry) return; // All slots in use, skip (avoids screen clutter)

    // Calculate vertical stack offset
    const posKey = `${Math.round(x / 8)}_${Math.round(y / 8)}`;
    const now = this.scene.time.now;
    const recent = this.recentPositions.get(posKey);
    let stackIndex = 0;

    if (recent && now - recent.timestamp < DamageIndicatorSystem.STACK_WINDOW_MS) {
      stackIndex = recent.count;
      recent.count++;
      recent.timestamp = now;
    } else {
      this.recentPositions.set(posKey, { count: 1, timestamp: now });
    }

    const yOffset = stackIndex * this.config.stackOffset;
    const startY = y - yOffset;

    // Configure the text object
    const color = DAMAGE_COLORS[type];
    const displayValue = type === DamageType.HEAL ? `+${value}` : `${value}`;

    entry.text.setText(displayValue);
    entry.text.setStyle({
      fontSize: `${this.config.fontSize}px`,
      fontFamily: '"Press Start 2P", cursive',
      color,
      stroke: '#000000',
      strokeThickness: 2,
    });
    entry.text.setPosition(x, startY);
    entry.text.setAlpha(1);
    entry.text.setScale(1);
    entry.text.setOrigin(0.5, 0.5);
    entry.text.setVisible(true);
    entry.text.setDepth(900);

    // Reset animation state
    entry.active = true;
    entry.elapsed = 0;
    entry.lifetime = this.config.lifetime;
    entry.startX = x;
    entry.startY = startY;
    entry.floatDistance = this.config.floatDistance;
  }

  /**
   * Update all active indicators. Call from scene update().
   * @param delta - Frame delta in ms
   */
  update(delta: number): void {
    for (const entry of this.pool) {
      if (!entry.active) continue;

      entry.elapsed += delta;
      const progress = Math.min(entry.elapsed / entry.lifetime, 1);

      // Upward movement (ease-out)
      const eased = 1 - Math.pow(1 - progress, 2);
      const currentY = entry.startY - entry.floatDistance * eased;
      entry.text.setY(currentY);

      // Fade out in the last 40% of lifetime
      if (progress > 0.6) {
        const fadeProgress = (progress - 0.6) / 0.4;
        entry.text.setAlpha(1 - fadeProgress);
      }

      // Slight scale pop at start
      if (progress < 0.15) {
        const scaleProgress = progress / 0.15;
        entry.text.setScale(1 + 0.15 * (1 - scaleProgress));
      } else {
        entry.text.setScale(1);
      }

      // Deactivate when lifetime expires
      if (progress >= 1) {
        entry.active = false;
        entry.text.setVisible(false);
      }
    }

    // Clean up old stack tracking entries
    const now = this.scene.time.now;
    for (const [key, data] of this.recentPositions) {
      if (now - data.timestamp > DamageIndicatorSystem.STACK_WINDOW_MS * 2) {
        this.recentPositions.delete(key);
      }
    }
  }

  /**
   * Destroy all indicator objects (cleanup on scene shutdown).
   */
  destroy(): void {
    for (const entry of this.pool) {
      entry.text.destroy();
    }
    this.pool = [];
    this.recentPositions.clear();
  }

  // ─── Private ───

  private initPool(): void {
    for (let i = 0; i < this.config.maxIndicators; i++) {
      const text = this.scene.add.text(0, 0, '', {
        fontSize: `${this.config.fontSize}px`,
        fontFamily: '"Press Start 2P", cursive',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      });
      text.setOrigin(0.5, 0.5);
      text.setVisible(false);
      text.setDepth(900);

      this.pool.push({
        text,
        active: false,
        elapsed: 0,
        lifetime: this.config.lifetime,
        startX: 0,
        startY: 0,
        floatDistance: this.config.floatDistance,
      });
    }
  }

  private getAvailableEntry(): IndicatorEntry | null {
    // Find an inactive entry
    for (const entry of this.pool) {
      if (!entry.active) return entry;
    }
    // Pool exhausted — recycle the oldest (first active entry)
    const oldest = this.pool.find((e) => e.active);
    if (oldest) {
      oldest.active = false;
      oldest.text.setVisible(false);
      return oldest;
    }
    return null;
  }
}

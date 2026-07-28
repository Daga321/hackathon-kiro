/**
 * UpgradeManager — handles the random upgrade selection between waves.
 *
 * Before each wave, one random upgrade is selected from the pool.
 * The wave number determines the magnitude using exponential scaling:
 *   value = base × multiplier^(wave - 1)
 *
 * Upgrade types:
 * - SWORD: increases player attack damage
 * - SHIELD: increases player defense
 * - WINGED_BOOTS: increases player movement speed
 * - GOLDEN_HEART: increases player max HP (and heals by the same amount)
 */

export enum UpgradeType {
  SWORD = 'SWORD',
  SHIELD = 'SHIELD',
  WINGED_BOOTS = 'WINGED_BOOTS',
  GOLDEN_HEART = 'GOLDEN_HEART',
}

export interface UpgradeResult {
  type: UpgradeType;
  value: number;
  label: string;
  description: string;
}

/** Base values per upgrade type */
const UPGRADE_BASE: Record<UpgradeType, number> = {
  [UpgradeType.SWORD]: 5,
  [UpgradeType.SHIELD]: 10,
  [UpgradeType.WINGED_BOOTS]: 3,
  [UpgradeType.GOLDEN_HEART]: 2,
};

/** Exponential multiplier per wave: value = base × multiplier^(wave-1) */
const UPGRADE_MULTIPLIER: Record<UpgradeType, number> = {
  [UpgradeType.SWORD]: 1.03,
  [UpgradeType.SHIELD]: 1.04,
  [UpgradeType.WINGED_BOOTS]: 1.02,
  [UpgradeType.GOLDEN_HEART]: 1.03,
};

/** Friendly labels */
const UPGRADE_LABELS: Record<UpgradeType, string> = {
  [UpgradeType.SWORD]: 'Sword',
  [UpgradeType.SHIELD]: 'Shield',
  [UpgradeType.WINGED_BOOTS]: 'Winged Boots',
  [UpgradeType.GOLDEN_HEART]: 'Golden Heart',
};

/** Descriptions */
const UPGRADE_DESCRIPTIONS: Record<UpgradeType, string> = {
  [UpgradeType.SWORD]: 'Attack Damage',
  [UpgradeType.SHIELD]: 'Max HP + Heal',
  [UpgradeType.WINGED_BOOTS]: 'Movement Speed',
  [UpgradeType.GOLDEN_HEART]: 'Defense',
};

/** Configurable probabilities (must sum to 1.0) */
const UPGRADE_WEIGHTS: Record<UpgradeType, number> = {
  [UpgradeType.SWORD]: 0.25,
  [UpgradeType.SHIELD]: 0.25,
  [UpgradeType.WINGED_BOOTS]: 0.25,
  [UpgradeType.GOLDEN_HEART]: 0.25,
};

const ALL_UPGRADES: UpgradeType[] = [
  UpgradeType.SWORD,
  UpgradeType.SHIELD,
  UpgradeType.WINGED_BOOTS,
  UpgradeType.GOLDEN_HEART,
];

export class UpgradeManager {
  /**
   * Select a random upgrade (weighted) and calculate its value for the given wave.
   * Formula: value = base × multiplier^(wave - 1)
   */
  rollUpgrade(wave: number): UpgradeResult {
    const type = this.weightedRandom();
    const base = UPGRADE_BASE[type];
    const multiplier = UPGRADE_MULTIPLIER[type];
    const value = base * Math.pow(multiplier, wave - 1);

    return {
      type,
      value: Math.round(value * 100) / 100,
      label: UPGRADE_LABELS[type],
      description: UPGRADE_DESCRIPTIONS[type],
    };
  }

  /**
   * Weighted random selection. Configurable probabilities.
   */
  private weightedRandom(): UpgradeType {
    const roll = Math.random();
    let cumulative = 0;
    for (const type of ALL_UPGRADES) {
      cumulative += UPGRADE_WEIGHTS[type];
      if (roll < cumulative) return type;
    }
    return ALL_UPGRADES[ALL_UPGRADES.length - 1];
  }
}

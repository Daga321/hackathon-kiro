/**
 * Centralized difficulty scaling configuration.
 * All scalable values derive from: value = base * multiplier^(wave - 1)
 */
export const DIFFICULTY_CONFIG = {
  // ─── ENEMIES ───
  ENEMY_COUNT_BASE: 5,
  ENEMY_COUNT_MULTIPLIER: 1.1,

  ENEMY_HP_BASE: 100,
  ENEMY_HP_MULTIPLIER: 1.08,

  ENEMY_DAMAGE_BASE: 10,
  ENEMY_DAMAGE_MULTIPLIER: 1.05,

  ENEMY_SPEED_MULTIPLIER: 1.005,

  ENEMY_SCORE_REWARD_BASE: 10,
  ENEMY_SCORE_REWARD_MULTIPLIER: 1.07,

  // ─── PLAYER ───
  PLAYER_HP_BASE: 100,
  PLAYER_HP_MULTIPLIER: 1.0,

  PLAYER_DAMAGE_BASE: 33,
  PLAYER_DAMAGE_MULTIPLIER: 1.0,
} as const;

/**
 * Calculate a scaled value for a given wave.
 * Formula: base * multiplier^(wave - 1)
 */
export function scaleValue(base: number, multiplier: number, wave: number): number {
  return base * Math.pow(multiplier, wave - 1);
}

/**
 * Get the enemy count for a given wave (rounded to integer).
 */
export function getEnemyCount(wave: number): number {
  return Math.round(
    scaleValue(DIFFICULTY_CONFIG.ENEMY_COUNT_BASE, DIFFICULTY_CONFIG.ENEMY_COUNT_MULTIPLIER, wave),
  );
}

/**
 * Get the enemy HP for a given wave (rounded to integer).
 */
export function getEnemyHP(wave: number): number {
  return Math.round(
    scaleValue(DIFFICULTY_CONFIG.ENEMY_HP_BASE, DIFFICULTY_CONFIG.ENEMY_HP_MULTIPLIER, wave),
  );
}

/**
 * Get the enemy damage for a given wave (rounded to integer).
 */
export function getEnemyDamage(wave: number): number {
  return Math.round(
    scaleValue(
      DIFFICULTY_CONFIG.ENEMY_DAMAGE_BASE,
      DIFFICULTY_CONFIG.ENEMY_DAMAGE_MULTIPLIER,
      wave,
    ),
  );
}

/**
 * Get the enemy speed multiplier for a given wave.
 */
export function getEnemySpeedMultiplier(wave: number): number {
  return Math.pow(DIFFICULTY_CONFIG.ENEMY_SPEED_MULTIPLIER, wave - 1);
}

/**
 * Get the score reward for killing an enemy at a given wave (rounded to integer).
 */
export function getEnemyScoreReward(wave: number): number {
  return Math.round(
    scaleValue(
      DIFFICULTY_CONFIG.ENEMY_SCORE_REWARD_BASE,
      DIFFICULTY_CONFIG.ENEMY_SCORE_REWARD_MULTIPLIER,
      wave,
    ),
  );
}

/**
 * Get the player max HP for a given wave.
 */
export function getPlayerHP(wave: number): number {
  return Math.round(
    scaleValue(DIFFICULTY_CONFIG.PLAYER_HP_BASE, DIFFICULTY_CONFIG.PLAYER_HP_MULTIPLIER, wave),
  );
}

/**
 * Get the player damage for a given wave.
 */
export function getPlayerDamage(wave: number): number {
  return Math.round(
    scaleValue(
      DIFFICULTY_CONFIG.PLAYER_DAMAGE_BASE,
      DIFFICULTY_CONFIG.PLAYER_DAMAGE_MULTIPLIER,
      wave,
    ),
  );
}

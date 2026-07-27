import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { WaveManager } from '../ai/WaveManager';
import { HudManager } from './HudManager';
import {
  DIFFICULTY_CONFIG,
  getPlayerDamage,
  getEnemyHP,
  getEnemyDamage,
  getEnemySpeedMultiplier,
  getEnemyCount,
} from '../config/difficulty-config';

/**
 * BalancePanel — Developer-facing debug overlay that displays real-time
 * gameplay statistics for balancing purposes.
 *
 * Only available when DEV_TOOLS_ENABLED is true.
 * Rendered as a lightweight HTML DOM overlay (no Phaser rendering cost).
 * Toggled via a configurable keyboard shortcut (default: KeyI).
 */
export class BalancePanel {
  private container: HTMLDivElement;
  private visible: boolean = false;

  // Cached DOM elements for efficient updates
  private playerHpEl!: HTMLSpanElement;
  private playerDamageEl!: HTMLSpanElement;
  private playerSpeedEl!: HTMLSpanElement;

  private waveEl!: HTMLSpanElement;
  private enemyCountEl!: HTMLSpanElement;
  private enemyHpEl!: HTMLSpanElement;
  private enemyDamageEl!: HTMLSpanElement;
  private enemySpeedEl!: HTMLSpanElement;

  private aggroTimerEl!: HTMLSpanElement;
  private heartDropEl!: HTMLSpanElement;
  private scoreMultiplierEl!: HTMLSpanElement;
  private difficultyContainer!: HTMLDivElement;

  constructor() {
    this.container = this.createPanel();
    document.body.appendChild(this.container);
  }

  /**
   * Toggle panel visibility.
   */
  toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'block' : 'none';
  }

  /**
   * Whether the panel is currently visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Update all displayed values. Call once per frame when visible.
   */
  update(player: Player, waveManager: WaveManager, enemies: Enemy[], hud: HudManager): void {
    if (!this.visible) return;

    const wave = waveManager.getWave();

    // ─── Player Stats ───
    const hp = player.getHealth();
    const maxHp = player.getMaxHealth();
    const damage = getPlayerDamage(wave);
    const speed = player.getSpeed();

    this.playerHpEl.textContent = `${hp} / ${maxHp}`;
    this.playerDamageEl.textContent = `${damage}`;
    this.playerSpeedEl.textContent = `${speed.toFixed(2)}`;

    // ─── Enemy Stats ───
    const aliveEnemies = enemies.filter((e) => !e.getIsDead());
    const enemyCount = aliveEnemies.length;
    const expectedHp = getEnemyHP(wave);
    const expectedDamage = getEnemyDamage(wave);
    const expectedSpeed = getEnemySpeedMultiplier(wave);

    this.waveEl.textContent = `${wave}`;
    this.enemyCountEl.textContent = `${enemyCount} / ${getEnemyCount(wave)}`;
    this.enemyHpEl.textContent = `${expectedHp}`;
    this.enemyDamageEl.textContent = `${expectedDamage}`;
    this.enemySpeedEl.textContent = `${expectedSpeed.toFixed(3)}x`;

    // ─── Gameplay Stats ───
    const aggroActive = hud.getIsAggroActive();
    this.aggroTimerEl.textContent = aggroActive ? 'ACTIVE' : this.getAggroDisplay(wave);
    this.heartDropEl.textContent = `${(DIFFICULTY_CONFIG.HEALTH_PICKUP_DROP_CHANCE * 100).toFixed(0)}%`;
    this.scoreMultiplierEl.textContent = `${(DIFFICULTY_CONFIG.ENEMY_SCORE_REWARD_MULTIPLIER ** (wave - 1)).toFixed(2)}x`;

    // Active difficulty multipliers (rendered as a mini table)
    const multipliers = [
      { label: 'HP', value: (DIFFICULTY_CONFIG.ENEMY_HP_MULTIPLIER ** (wave - 1)).toFixed(2) },
      { label: 'DMG', value: (DIFFICULTY_CONFIG.ENEMY_DAMAGE_MULTIPLIER ** (wave - 1)).toFixed(2) },
      { label: 'SPD', value: (DIFFICULTY_CONFIG.ENEMY_SPEED_MULTIPLIER ** (wave - 1)).toFixed(3) },
      { label: 'CNT', value: (DIFFICULTY_CONFIG.ENEMY_COUNT_MULTIPLIER ** (wave - 1)).toFixed(2) },
    ];
    this.difficultyContainer.innerHTML = '';
    for (const m of multipliers) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; padding: 1px 8px;';
      const lbl = document.createElement('span');
      lbl.style.color = '#aaa';
      lbl.textContent = m.label;
      const val = document.createElement('span');
      val.style.color = '#fff';
      val.textContent = `${m.value}x`;
      row.appendChild(lbl);
      row.appendChild(val);
      this.difficultyContainer.appendChild(row);
    }
  }

  /**
   * Clean up the DOM element.
   */
  destroy(): void {
    this.container.remove();
  }

  // ─── Private ───

  private getAggroDisplay(wave: number): string {
    const duration = Math.max(15, 60 - wave * 2);
    return `${duration}s (wave reset)`;
  }

  private createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.id = 'balance-panel';
    panel.style.cssText = `
      display: none;
      position: fixed;
      top: 10px;
      right: 10px;
      width: 280px;
      max-height: calc(100vh - 20px);
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.85);
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #444;
      z-index: 10000;
      pointer-events: none;
      user-select: none;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText =
      'font-size: 13px; font-weight: bold; color: #ffcc00; margin-bottom: 8px; border-bottom: 1px solid #555; padding-bottom: 4px;';
    title.textContent = 'Balance Panel';
    panel.appendChild(title);

    // Player section
    panel.appendChild(this.createSectionHeader('Player', '#44cc44'));
    this.playerHpEl = this.createRow(panel, 'HP');
    this.playerDamageEl = this.createRow(panel, 'Damage');
    this.playerSpeedEl = this.createRow(panel, 'Speed');

    // Enemy section
    panel.appendChild(this.createSectionHeader('Enemies', '#cc4444'));
    this.waveEl = this.createRow(panel, 'Wave');
    this.enemyCountEl = this.createRow(panel, 'Count');
    this.enemyHpEl = this.createRow(panel, 'HP');
    this.enemyDamageEl = this.createRow(panel, 'Damage');
    this.enemySpeedEl = this.createRow(panel, 'Speed');

    // Gameplay section
    panel.appendChild(this.createSectionHeader('Gameplay', '#4488cc'));
    this.aggroTimerEl = this.createRow(panel, 'Aggro Timer');
    this.heartDropEl = this.createRow(panel, 'Heart Drop');
    this.scoreMultiplierEl = this.createRow(panel, 'Score Mult');

    // Multipliers sub-section with table layout
    const multLabel = document.createElement('div');
    multLabel.style.cssText = 'color: #aaa; margin-top: 4px; margin-bottom: 2px; font-size: 11px;';
    multLabel.textContent = 'Difficulty Multipliers';
    panel.appendChild(multLabel);

    this.difficultyContainer = document.createElement('div');
    this.difficultyContainer.style.cssText =
      'background: rgba(255,255,255,0.04); border-radius: 3px; padding: 2px 0;';
    panel.appendChild(this.difficultyContainer);

    // Footer hint
    const footer = document.createElement('div');
    footer.style.cssText =
      'margin-top: 8px; border-top: 1px solid #555; padding-top: 4px; color: #888; font-size: 10px;';
    footer.textContent = 'Toggle: I key | Debug only';
    panel.appendChild(footer);

    return panel;
  }

  private createSectionHeader(label: string, color: string): HTMLDivElement {
    const header = document.createElement('div');
    header.style.cssText = `font-weight: bold; color: ${color}; margin-top: 8px; margin-bottom: 2px;`;
    header.textContent = `── ${label} ──`;
    return header;
  }

  private createRow(parent: HTMLElement, label: string): HTMLSpanElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; padding: 1px 0;';

    const labelSpan = document.createElement('span');
    labelSpan.style.color = '#aaa';
    labelSpan.textContent = label;

    const valueSpan = document.createElement('span');
    valueSpan.style.color = '#fff';
    valueSpan.textContent = '-';

    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    parent.appendChild(row);

    return valueSpan;
  }
}

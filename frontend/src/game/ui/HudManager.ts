import { MAP_CONFIG } from '../config/map-config';
import { Player } from '../entities/Player';
import { WaveManager } from '../ai/WaveManager';
import { Enemy } from '../entities/Enemy';

/**
 * HudManager — updates the HTML HUD panel with game data each frame.
 */
export class HudManager {
  private healthBarFill: HTMLElement | null;
  private healthText: HTMLElement | null;
  private waveText: HTMLElement | null;
  private scoreText: HTMLElement | null;
  private enemiesText: HTMLElement | null;
  private aggroText: HTMLElement | null;
  private minimapCanvas: HTMLCanvasElement | null;
  private minimapCtx: CanvasRenderingContext2D | null;

  private score: number = 0;
  private aggroTime: number = 0; // ms
  private isAggro: boolean = false;

  constructor() {
    this.healthBarFill = document.getElementById('health-bar-fill');
    this.healthText = document.getElementById('health-text');
    this.waveText = document.getElementById('wave-text');
    this.scoreText = document.getElementById('score-text');
    this.enemiesText = document.getElementById('enemies-text');
    this.aggroText = document.getElementById('aggro-text');
    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
    this.minimapCtx = this.minimapCanvas?.getContext('2d') ?? null;
  }

  /**
   * Add to score (e.g., when enemy dies).
   */
  addScore(points: number): void {
    this.score += points;
  }

  /**
   * Update HUD each frame.
   */
  update(player: Player, waveManager: WaveManager, enemies: Enemy[], delta: number): void {
    // Health bar
    const hp = player.getHealth();
    const maxHp = player.getMaxHealth();
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    if (this.healthBarFill) {
      this.healthBarFill.style.width = `${ratio * 100}%`;
      // Color based on ratio
      if (ratio > 0.5) this.healthBarFill.style.background = '#44cc44';
      else if (ratio > 0.25) this.healthBarFill.style.background = '#cccc44';
      else this.healthBarFill.style.background = '#cc3333';
    }
    if (this.healthText) this.healthText.textContent = `${hp} / ${maxHp}`;

    // Wave
    if (this.waveText) this.waveText.textContent = `${waveManager.getWave()}`;

    // Score
    if (this.scoreText) this.scoreText.textContent = `${this.score}`;

    // Enemies alive
    const alive = enemies.filter(e => !e.getIsDead()).length;
    if (this.enemiesText) this.enemiesText.textContent = `${alive}`;

    // Aggro timer — counts up while any enemy is chasing (detected player)
    const anyChasing = alive > 0 && !player.getIsDead();
    if (anyChasing) {
      if (!this.isAggro) this.isAggro = true;
      this.aggroTime += delta;
    } else {
      this.isAggro = false;
    }
    if (this.aggroText) {
      const totalSec = Math.floor(this.aggroTime / 1000);
      const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const sec = (totalSec % 60).toString().padStart(2, '0');
      this.aggroText.textContent = `${min}:${sec}`;
    }

    // Minimap
    this.drawMinimap(player, enemies);
  }

  private drawMinimap(player: Player, enemies: Enemy[]): void {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const mapW = MAP_CONFIG.WIDTH;
    const mapH = MAP_CONFIG.HEIGHT;

    // Clear
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, w, h);

    // Draw enemies (red dots)
    ctx.fillStyle = '#cc3333';
    for (const enemy of enemies) {
      if (enemy.getIsDead()) continue;
      const sprite = enemy.getSprite();
      const ex = (sprite.x / mapW) * w;
      const ey = (sprite.y / mapH) * h;
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw player (blue dot)
    if (!player.getIsDead()) {
      const ps = player.getSprite();
      const px = (ps.x / mapW) * w;
      const py = (ps.y / mapH) * h;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

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
  private scoreTimeAccumulator: number = 0; // ms accumulated for +1/sec
  private previousAliveEnemies: Set<Enemy> = new Set();
  private gameStopped: boolean = false;

  // ─── Aggro Timer (countdown) ───
  private static readonly AGGRO_MIN_SEC = 15;
  private aggroTimeRemaining: number = 0; // set on wave change
  private aggroCountdownAccumulator: number = 0;
  private isAggroActive: boolean = false;
  private lastWave: number = 0;

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
   * Get the current score.
   */
  getScore(): number {
    return this.score;
  }

  /**
   * Whether the aggro countdown has reached zero (enemies should be aggressive).
   */
  getIsAggroActive(): boolean {
    return this.isAggroActive;
  }

  /**
   * Update HUD each frame.
   */
  update(
    player: Player,
    waveManager: WaveManager,
    enemies: Enemy[],
    delta: number,
    scoreRewardPerKill?: number,
  ): void {
    // Health bar
    const hp = player.getHealth();
    const maxHp = player.getMaxHealth();
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    if (this.healthBarFill) {
      this.healthBarFill.style.width = `${ratio * 100}%`;
      if (ratio > 0.5) this.healthBarFill.style.background = '#44cc44';
      else if (ratio > 0.25) this.healthBarFill.style.background = '#cccc44';
      else this.healthBarFill.style.background = '#cc3333';
    }
    if (this.healthText) this.healthText.textContent = `${hp} / ${maxHp}`;

    // Wave
    const currentWave = waveManager.getWave();
    if (this.waveText) this.waveText.textContent = `${currentWave}`;

    // Reset aggro timer on new wave: aggroTimer = max(15, 60 - (wave * 2))
    if (currentWave > this.lastWave) {
      this.lastWave = currentWave;
      const duration = Math.max(HudManager.AGGRO_MIN_SEC, 60 - currentWave * 2);
      this.aggroTimeRemaining = duration * 1000;
      this.aggroCountdownAccumulator = 0;
      this.isAggroActive = false;
    }

    // ─── Score system ───
    if (!this.gameStopped && !player.getIsDead()) {
      // +1 per second
      this.scoreTimeAccumulator += delta;
      while (this.scoreTimeAccumulator >= 1000) {
        this.score += 1;
        this.scoreTimeAccumulator -= 1000;
      }

      // +score per enemy killed (detect newly dead enemies)
      for (const enemy of enemies) {
        if (enemy.getIsDead() && this.previousAliveEnemies.has(enemy)) {
          this.score += scoreRewardPerKill ?? 10;
          this.previousAliveEnemies.delete(enemy);
        }
      }
      // Track alive enemies for next frame comparison
      for (const enemy of enemies) {
        if (!enemy.getIsDead()) {
          this.previousAliveEnemies.add(enemy);
        }
      }
    } else if (player.getIsDead()) {
      this.gameStopped = true;
    }

    if (this.scoreText) this.scoreText.textContent = `${this.score}`;

    // Enemies alive
    const alive = enemies.filter((e) => !e.getIsDead()).length;
    if (this.enemiesText) this.enemiesText.textContent = `${alive}`;

    // ─── Aggro Timer countdown ───
    if (!this.gameStopped && !this.isAggroActive) {
      this.aggroCountdownAccumulator += delta;
      while (this.aggroCountdownAccumulator >= 1000 && this.aggroTimeRemaining > 0) {
        this.aggroTimeRemaining -= 1000;
        this.aggroCountdownAccumulator -= 1000;
      }
      if (this.aggroTimeRemaining <= 0) {
        this.aggroTimeRemaining = 0;
        this.isAggroActive = true;
      }
    }
    if (this.aggroText) {
      const totalSec = Math.max(0, Math.floor(this.aggroTimeRemaining / 1000));
      const min = Math.floor(totalSec / 60)
        .toString()
        .padStart(2, '0');
      const sec = (totalSec % 60).toString().padStart(2, '0');
      this.aggroText.textContent = `${min}:${sec}`;
    }

    // Minimap
    this.drawMinimap(player, enemies);
  }

  /**
   * Set health pickup positions for minimap rendering.
   */
  setPickupPositions(positions: { x: number; y: number }[]): void {
    this.pickupPositions = positions;
  }

  private pickupPositions: { x: number; y: number }[] = [];

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

    // Draw health pickups (green dots)
    ctx.fillStyle = '#44ff44';
    for (const pos of this.pickupPositions) {
      const px = (pos.x / mapW) * w;
      const py = (pos.y / mapH) * h;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

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

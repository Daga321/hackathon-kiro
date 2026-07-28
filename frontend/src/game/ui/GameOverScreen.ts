/**
 * GameOverScreen — controls the HTML game over overlay.
 *
 * Displays final score and wave reached when the player dies.
 * Automatically submits the score to the backend if authenticated.
 * Provides a functional "Play Again" button that restarts the game.
 */
import { submitScore } from '../../services/leaderboard.service';
import { isAuthenticated } from '../../services/token-manager';

export class GameOverScreen {
  private backdrop: HTMLElement | null;
  private scoreEl: HTMLElement | null;
  private waveEl: HTMLElement | null;
  private btnRestart: HTMLElement | null;
  private btnShare: HTMLElement | null;

  private _isShowing: boolean = false;
  private onRestartCallback: (() => void) | null = null;
  private gameStartTime: number = Date.now();
  private enemiesKilled: number = 0;

  constructor() {
    this.backdrop = document.getElementById('gameover-backdrop');
    this.scoreEl = document.getElementById('gameover-score');
    this.waveEl = document.getElementById('gameover-wave');
    this.btnRestart = document.getElementById('gameover-btn-restart');
    this.btnShare = document.getElementById('gameover-btn-share');

    this.bindButtons();
  }

  /**
   * Whether the game over screen is currently visible.
   */
  get isShowing(): boolean {
    return this._isShowing;
  }

  /**
   * Register a callback for when the player clicks "Play Again".
   */
  onRestart(callback: () => void): void {
    this.onRestartCallback = callback;
  }

  /**
   * Reset the session timer (called when a new game starts).
   */
  resetSession(): void {
    this.gameStartTime = Date.now();
    this.enemiesKilled = 0;
  }

  /**
   * Track an enemy kill (called by the game when an enemy dies).
   */
  addKill(): void {
    this.enemiesKilled++;
  }

  /**
   * Set the total enemies killed directly (alternative to addKill).
   */
  setEnemiesKilled(count: number): void {
    this.enemiesKilled = count;
  }

  /**
   * Show the game over screen with final stats.
   * Automatically submits the score to the backend if authenticated.
   * @param score - Final score achieved
   * @param wave - Last wave reached
   */
  show(score: number, wave: number): void {
    if (this._isShowing) return;
    this._isShowing = true;

    if (this.scoreEl) this.scoreEl.textContent = `${score}`;
    if (this.waveEl) this.waveEl.textContent = `${wave}`;

    this.backdrop?.classList.add('visible');

    // Submit score to backend (silently — player doesn't wait for this)
    this.submitScoreToBackend(score, wave);
  }

  /**
   * Hide the game over screen.
   */
  hide(): void {
    this._isShowing = false;
    this.backdrop?.classList.remove('visible');
  }

  // ─── Private ───

  private async submitScoreToBackend(score: number, wave: number): Promise<void> {
    if (!isAuthenticated()) {
      this.updateShareButton('Login to save score');
      return;
    }

    this.updateShareButton('Saving...');

    const sessionDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);

    const result = await submitScore(wave, score, this.enemiesKilled, sessionDuration);

    if (result.success) {
      this.updateShareButton('Score saved!');
    } else {
      this.updateShareButton('Save failed - retry next game');
    }
  }

  private updateShareButton(text: string): void {
    if (this.btnShare) {
      this.btnShare.textContent = text;
    }
  }

  private bindButtons(): void {
    // Play Again — triggers restart callback
    // Using onclick assignment to avoid duplicate listeners on scene restart
    if (this.btnRestart) {
      this.btnRestart.onclick = () => {
        this.hide();
        this.onRestartCallback?.();
      };
    }

    // Share/Status button — no action needed, it's a status indicator now
    if (this.btnShare) {
      this.btnShare.onclick = () => {
        // Button text shows the submission status
      };
    }
  }
}

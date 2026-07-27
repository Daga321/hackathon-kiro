/**
 * GameOverScreen — controls the HTML game over overlay.
 *
 * Displays final score and wave reached when the player dies.
 * Provides a functional "Play Again" button that restarts the game
 * and a placeholder "Share Score" button for future implementation.
 */
export class GameOverScreen {
  private backdrop: HTMLElement | null;
  private scoreEl: HTMLElement | null;
  private waveEl: HTMLElement | null;
  private btnRestart: HTMLElement | null;
  private btnShare: HTMLElement | null;

  private _isShowing: boolean = false;
  private onRestartCallback: (() => void) | null = null;

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
   * Show the game over screen with final stats.
   * @param score - Final score achieved
   * @param wave - Last wave reached
   */
  show(score: number, wave: number): void {
    if (this._isShowing) return;
    this._isShowing = true;

    if (this.scoreEl) this.scoreEl.textContent = `${score}`;
    if (this.waveEl) this.waveEl.textContent = `${wave}`;

    this.backdrop?.classList.add('visible');
  }

  /**
   * Hide the game over screen.
   */
  hide(): void {
    this._isShowing = false;
    this.backdrop?.classList.remove('visible');
  }

  // ─── Private ───

  private bindButtons(): void {
    // Play Again — triggers restart callback
    // Using onclick assignment to avoid duplicate listeners on scene restart
    if (this.btnRestart) {
      this.btnRestart.onclick = () => {
        this.hide();
        this.onRestartCallback?.();
      };
    }

    // Share Score (placeholder — future implementation)
    if (this.btnShare) {
      this.btnShare.onclick = () => {
        // TODO: Implement share functionality (clipboard, social, etc.)
      };
    }
  }
}

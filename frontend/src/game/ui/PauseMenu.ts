/**
 * PauseMenu — controls the HTML pause menu overlay.
 *
 * Handles showing/hiding the pause board, button click listeners,
 * and communicates pause/resume state back to the game scene.
 *
 * Triggers:
 * - Desktop: ESC or P key
 * - Mobile: page visibility change (tab hidden, screen locked, app switch)
 *
 * The menu does NOT block the game loop directly — it emits callbacks
 * that the GameScene uses to pause/resume Phaser scenes.
 */
export class PauseMenu {
  private backdrop: HTMLElement | null;
  private btnResume: HTMLElement | null;
  private btnAudio: HTMLElement | null;
  private btnLeaderboard: HTMLElement | null;
  private btnQuit: HTMLElement | null;

  private _isPaused: boolean = false;
  private onResumeCallback: (() => void) | null = null;
  private onPauseCallback: (() => void) | null = null;

  constructor() {
    this.backdrop = document.getElementById('pause-menu-backdrop');
    this.btnResume = document.getElementById('pause-btn-resume');
    this.btnAudio = document.getElementById('pause-btn-audio');
    this.btnLeaderboard = document.getElementById('pause-btn-leaderboard');
    this.btnQuit = document.getElementById('pause-btn-quit');

    this.bindButtons();
    this.bindKeyboard();
    this.bindVisibilityChange();
  }

  /**
   * Register a callback for when the game should pause.
   */
  onPause(callback: () => void): void {
    this.onPauseCallback = callback;
  }

  /**
   * Register a callback for when the game should resume.
   */
  onResume(callback: () => void): void {
    this.onResumeCallback = callback;
  }

  /**
   * Whether the game is currently paused.
   */
  get isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Toggle pause state. Called from keyboard handler in GameScene.
   */
  toggle(): void {
    if (this._isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Pause the game and show the menu.
   */
  pause(): void {
    if (this._isPaused) return;
    this._isPaused = true;
    this.show();
    this.onPauseCallback?.();
  }

  /**
   * Resume the game and hide the menu.
   */
  resume(): void {
    if (!this._isPaused) return;
    this._isPaused = false;
    this.hide();
    this.onResumeCallback?.();
  }

  // ─── Private ───

  private show(): void {
    this.backdrop?.classList.add('visible');
  }

  private hide(): void {
    this.backdrop?.classList.remove('visible');
  }

  private bindButtons(): void {
    // Using onclick assignment to avoid duplicate listeners on scene restart
    if (this.btnResume) {
      this.btnResume.onclick = () => {
        this.resume();
      };
    }

    // Audio settings (placeholder — future implementation)
    if (this.btnAudio) {
      this.btnAudio.onclick = () => {
        // TODO: Open audio settings panel
      };
    }

    // Leaderboard (placeholder — future implementation)
    if (this.btnLeaderboard) {
      this.btnLeaderboard.onclick = () => {
        // TODO: Open leaderboard panel
      };
    }

    // Quit to main menu (placeholder — future implementation)
    if (this.btnQuit) {
      this.btnQuit.onclick = () => {
        // TODO: Return to main menu
      };
    }
  }

  /**
   * Pause when the browser tab loses visibility (mobile: screen lock,
   * app switch, back gesture, etc.)
   */
  private bindVisibilityChange(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this._isPaused) {
        this.pause();
      }
    });
  }

  /**
   * Listen for ESC and P keys at the document level.
   * This works even when Phaser's update loop is paused.
   */
  private bindKeyboard(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        // Don't toggle if user is typing in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        e.preventDefault();
        this.toggle();
      }
    });
  }
}

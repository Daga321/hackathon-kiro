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
import { getGlobalLeaderboard } from '../../services/leaderboard.service';
import { isAuthenticated } from '../../services/token-manager';
import type { LeaderboardEntry } from '../../services/types';

export class PauseMenu {
  private backdrop: HTMLElement | null;
  private btnResume: HTMLElement | null;
  private btnAudio: HTMLElement | null;
  private btnLeaderboard: HTMLElement | null;
  private btnQuit: HTMLElement | null;
  private leaderboardPanel: HTMLElement | null = null;
  private leaderboardLoading: boolean = false;

  private _isPaused: boolean = false;
  private onResumeCallback: (() => void) | null = null;
  private onPauseCallback: (() => void) | null = null;

  constructor() {
    this.backdrop = document.getElementById('pause-menu-backdrop');
    this.btnResume = document.getElementById('pause-btn-resume');
    this.btnAudio = document.getElementById('pause-btn-audio');
    this.btnLeaderboard = document.getElementById('pause-btn-leaderboard');
    this.btnQuit = document.getElementById('pause-btn-quit');

    this.createLeaderboardPanel();
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
    this.hideLeaderboardPanel();
    this.show();
    this.onPauseCallback?.();
  }

  /**
   * Resume the game and hide the menu.
   */
  resume(): void {
    if (!this._isPaused) return;
    this._isPaused = false;
    this.hideLeaderboardPanel();
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

  private createLeaderboardPanel(): void {
    this.leaderboardPanel = document.createElement('div');
    this.leaderboardPanel.id = 'leaderboard-panel';
    this.leaderboardPanel.style.cssText = `
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 320px;
      max-height: 400px;
      background: #2c1810;
      border: 3px solid #8b5e3c;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Press Start 2P', cursive;
      overflow-y: auto;
      z-index: 700;
    `;
    this.backdrop?.appendChild(this.leaderboardPanel);
  }

  private showLeaderboardPanel(): void {
    if (this.leaderboardPanel) {
      this.leaderboardPanel.style.display = 'block';
    }
  }

  private hideLeaderboardPanel(): void {
    if (this.leaderboardPanel) {
      this.leaderboardPanel.style.display = 'none';
    }
  }

  private renderLeaderboard(entries: LeaderboardEntry[]): void {
    if (!this.leaderboardPanel) return;

    if (entries.length === 0) {
      this.leaderboardPanel.innerHTML = `
        <p style="color: #f0c040; font-size: 0.6rem; text-align: center; margin-bottom: 12px;">Leaderboard</p>
        <p style="color: #aaa; font-size: 0.4rem; text-align: center;">No scores yet.</p>
        <button id="lb-close-btn" style="display: block; margin: 12px auto 0; padding: 6px 12px; font-family: inherit; font-size: 0.4rem; background: #8b5e3c; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Close</button>
      `;
    } else {
      const rows = entries
        .slice(0, 20)
        .map(
          (entry) => `
        <div style="display: flex; justify-content: space-between; padding: 4px 6px; background: rgba(0,0,0,0.25); border-radius: 3px; margin-bottom: 4px;">
          <span style="color: #ccc; font-size: 0.35rem;">#${entry.rank} ${entry.username}</span>
          <span style="color: #f0c040; font-size: 0.35rem;">R${entry.highestRound} | ${entry.totalScore}pts</span>
        </div>`,
        )
        .join('');

      this.leaderboardPanel.innerHTML = `
        <p style="color: #f0c040; font-size: 0.6rem; text-align: center; margin-bottom: 12px;">Leaderboard</p>
        ${rows}
        <button id="lb-close-btn" style="display: block; margin: 12px auto 0; padding: 6px 12px; font-family: inherit; font-size: 0.4rem; background: #8b5e3c; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Close</button>
      `;
    }

    // Bind close button
    const closeBtn = document.getElementById('lb-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => this.hideLeaderboardPanel();
    }
  }

  private async loadLeaderboard(): Promise<void> {
    if (this.leaderboardLoading) return;
    this.leaderboardLoading = true;

    if (!this.leaderboardPanel) return;
    this.leaderboardPanel.innerHTML = `
      <p style="color: #f0c040; font-size: 0.6rem; text-align: center; margin-bottom: 12px;">Leaderboard</p>
      <p style="color: #aaa; font-size: 0.4rem; text-align: center;">Loading...</p>
    `;
    this.showLeaderboardPanel();

    const result = await getGlobalLeaderboard(20);

    if (result.success) {
      this.renderLeaderboard(result.data.leaderboard);
    } else {
      this.leaderboardPanel.innerHTML = `
        <p style="color: #f0c040; font-size: 0.6rem; text-align: center; margin-bottom: 12px;">Leaderboard</p>
        <p style="color: #cc3333; font-size: 0.4rem; text-align: center;">${result.error}</p>
        <button id="lb-close-btn" style="display: block; margin: 12px auto 0; padding: 6px 12px; font-family: inherit; font-size: 0.4rem; background: #8b5e3c; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Close</button>
      `;
      const closeBtn = document.getElementById('lb-close-btn');
      if (closeBtn) {
        closeBtn.onclick = () => this.hideLeaderboardPanel();
      }
    }

    this.leaderboardLoading = false;
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

    // Leaderboard — loads and shows global leaderboard
    if (this.btnLeaderboard) {
      this.btnLeaderboard.onclick = () => {
        this.loadLeaderboard();
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

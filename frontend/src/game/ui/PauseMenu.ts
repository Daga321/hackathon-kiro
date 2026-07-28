import { FriendsPanel } from './FriendsPanel';
import { AuthUI } from './AuthUI';
import { getGlobalLeaderboard, getFriendsLeaderboard } from '../../services/leaderboard.service';
import { isAuthenticated } from '../../services/token-manager';
import type { LeaderboardEntry } from '../../services/types';

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
  private btnControls: HTMLElement | null;
  private btnAudio: HTMLElement | null;
  private btnQuit: HTMLElement | null;

  private controlsBackdrop: HTMLElement | null;
  private controlsDesktop: HTMLElement | null;
  private controlsMobile: HTMLElement | null;
  private btnControlsBack: HTMLElement | null;

  private btnGuide: HTMLElement | null;
  private guideBackdrop: HTMLElement | null;
  private btnGuideBack: HTMLElement | null;

  private hudPauseBtn: HTMLElement | null;
  private btnFriends: HTMLElement | null;
  private friendsPanel: FriendsPanel | null = null;
  private authRef: AuthUI | null = null;
  private btnLeaderboard: HTMLElement | null;
  private leaderboardBackdrop: HTMLElement | null;
  private lbBtnBack: HTMLElement | null;
  private lbTabGlobal: HTMLElement | null;
  private lbTabFriends: HTMLElement | null;

  private _isPaused: boolean = false;
  private onResumeCallback: (() => void) | null = null;
  private onPauseCallback: (() => void) | null = null;

  constructor() {
    this.backdrop = document.getElementById('pause-menu-backdrop');
    this.btnResume = document.getElementById('pause-btn-resume');
    this.btnControls = document.getElementById('pause-btn-controls');
    this.btnAudio = document.getElementById('pause-btn-audio');
    this.btnQuit = document.getElementById('pause-btn-quit');

    this.controlsBackdrop = document.getElementById('controls-backdrop');
    this.controlsDesktop = document.getElementById('controls-desktop');
    this.controlsMobile = document.getElementById('controls-mobile');
    this.btnControlsBack = document.getElementById('controls-btn-back');

    this.btnGuide = document.getElementById('pause-btn-guide');
    this.guideBackdrop = document.getElementById('guide-backdrop');
    this.btnGuideBack = document.getElementById('guide-btn-back');

    this.hudPauseBtn = document.getElementById('hud-pause-btn');
    this.btnFriends = document.getElementById('pause-btn-friends');
    this.btnLeaderboard = document.getElementById('pause-btn-leaderboard');
    this.leaderboardBackdrop = document.getElementById('leaderboard-backdrop');
    this.lbBtnBack = document.getElementById('lb-btn-back');
    this.lbTabGlobal = document.getElementById('lb-tab-global');
    this.lbTabFriends = document.getElementById('lb-tab-friends');

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
   * Set the AuthUI reference for the friends panel.
   */
  setAuthUI(authUI: AuthUI): void {
    this.authRef = authUI;
    this.friendsPanel = new FriendsPanel(authUI);
    this.friendsPanel.onBack(() => {
      this.backdrop?.classList.add('visible');
    });

    // When login succeeds from leaderboard, re-show it with content
    authUI.onLoginSuccess((source) => {
      if (source === 'leaderboard') {
        this.showLeaderboard();
        setTimeout(() => this.lbTabFriends?.click(), 50);
      }
    });
  }

  private getAuthLoggedIn(): boolean {
    return this.authRef?.isLoggedIn ?? false;
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
    this.controlsBackdrop?.classList.remove('visible');
    this.guideBackdrop?.classList.remove('visible');
    this.friendsPanel?.hide();
    this.leaderboardBackdrop?.classList.remove('visible');
  }

  private showControls(): void {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad|ipod|mobile|tablet/.test(ua);
    if (this.controlsDesktop) this.controlsDesktop.style.display = isMobile ? 'none' : 'flex';
    if (this.controlsMobile) this.controlsMobile.style.display = isMobile ? 'flex' : 'none';

    this.backdrop?.classList.remove('visible');
    this.controlsBackdrop?.classList.add('visible');
  }

  private hideControls(): void {
    this.controlsBackdrop?.classList.remove('visible');
    this.backdrop?.classList.add('visible');
  }

  private showGuide(): void {
    this.backdrop?.classList.remove('visible');
    this.guideBackdrop?.classList.add('visible');
  }

  private hideGuide(): void {
    this.guideBackdrop?.classList.remove('visible');
    this.backdrop?.classList.add('visible');
  }

  private showFriends(): void {
    this.backdrop?.classList.remove('visible');
    this.friendsPanel?.show();
  }

  private showLeaderboard(): void {
    this.backdrop?.classList.remove('visible');
    this.leaderboardBackdrop?.classList.add('visible');
    this.loadLeaderboardData('global');
  }

  private hideLeaderboard(): void {
    this.leaderboardBackdrop?.classList.remove('visible');
    this.backdrop?.classList.add('visible');
  }

  private async loadLeaderboardData(tab: 'global' | 'friends'): Promise<void> {
    const container = document.getElementById('lb-list-container');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div class="lb-row" style="justify-content: center;">
        <span class="lb-col-name" style="text-align: center; width: 100%;">Loading...</span>
      </div>`;

    if (tab === 'global') {
      const result = await getGlobalLeaderboard(20);
      if (result.success) {
        this.renderLeaderboardEntries(container, result.data.leaderboard);
      } else {
        container.innerHTML = `
          <div class="lb-row" style="justify-content: center;">
            <span class="lb-col-name" style="text-align: center; width: 100%; color: #cc3333;">${result.error}</span>
          </div>`;
      }
    } else {
      if (!isAuthenticated()) return;
      const result = await getFriendsLeaderboard();
      if (result.success) {
        this.renderLeaderboardEntries(container, result.data.leaderboard);
      } else {
        container.innerHTML = `
          <div class="lb-row" style="justify-content: center;">
            <span class="lb-col-name" style="text-align: center; width: 100%; color: #cc3333;">${result.error}</span>
          </div>`;
      }
    }
  }

  private renderLeaderboardEntries(container: HTMLElement, entries: LeaderboardEntry[]): void {
    if (entries.length === 0) {
      container.innerHTML = `
        <div class="lb-row" style="justify-content: center;">
          <span class="lb-col-name" style="text-align: center; width: 100%;">No scores yet.</span>
        </div>`;
      return;
    }

    container.innerHTML = entries
      .map((entry) => {
        let rowClass = 'lb-row';
        if (entry.rank === 1) rowClass += ' lb-row-gold';
        else if (entry.rank === 2) rowClass += ' lb-row-silver';
        else if (entry.rank === 3) rowClass += ' lb-row-bronze';

        return `
          <div class="${rowClass}">
            <span class="lb-col-rank">${entry.rank}</span>
            <span class="lb-col-name">${entry.username}</span>
            <span class="lb-col-score">${entry.totalScore.toLocaleString()}</span>
            <span class="lb-col-wave">${entry.highestRound}</span>
          </div>`;
      })
      .join('');
  }

  private bindButtons(): void {
    // Using onclick assignment to avoid duplicate listeners on scene restart
    if (this.btnResume) {
      this.btnResume.onclick = () => {
        this.resume();
      };
    }

    // Controls help
    if (this.btnControls) {
      this.btnControls.onclick = () => {
        this.showControls();
      };
    }

    // Controls back button
    if (this.btnControlsBack) {
      this.btnControlsBack.onclick = () => {
        this.hideControls();
      };
    }

    // Game Guide
    if (this.btnGuide) {
      this.btnGuide.onclick = () => {
        this.showGuide();
      };
    }

    // Guide back button
    if (this.btnGuideBack) {
      this.btnGuideBack.onclick = () => {
        this.hideGuide();
      };
    }

    // Friends panel
    if (this.btnFriends) {
      this.btnFriends.onclick = () => {
        this.showFriends();
      };
    }

    // Audio settings (placeholder — future implementation)
    if (this.btnAudio) {
      this.btnAudio.onclick = () => {
        // TODO: Open audio settings panel
      };
    }

    // Leaderboard
    if (this.btnLeaderboard) {
      this.btnLeaderboard.onclick = () => {
        this.showLeaderboard();
      };
    }

    // Leaderboard back button
    if (this.lbBtnBack) {
      this.lbBtnBack.onclick = () => {
        this.hideLeaderboard();
      };
    }

    // Leaderboard tabs
    const lbTabs = [this.lbTabGlobal, this.lbTabFriends];
    const lbListContainer = document.getElementById('lb-list-container');
    const lbHeader = document.querySelector('.lb-header') as HTMLElement | null;
    const lbFriendsNotLogged = document.getElementById('lb-friends-not-logged');
    const lbFriendsLoginBtn = document.getElementById('lb-friends-login-btn');

    lbTabs.forEach((tab) => {
      if (tab) {
        tab.onclick = () => {
          lbTabs.forEach((t) => t?.classList.remove('friends-tab-active'));
          tab.classList.add('friends-tab-active');

          const isFriendsTab = tab === this.lbTabFriends;

          if (isFriendsTab && !this.getAuthLoggedIn()) {
            // Not logged in — show login prompt, hide list
            if (lbListContainer) lbListContainer.style.display = 'none';
            if (lbHeader) lbHeader.style.display = 'none';
            if (lbFriendsNotLogged) lbFriendsNotLogged.style.display = 'flex';
          } else {
            // Show list and load data from API
            if (lbListContainer) lbListContainer.style.display = 'flex';
            if (lbHeader) lbHeader.style.display = 'flex';
            if (lbFriendsNotLogged) lbFriendsNotLogged.style.display = 'none';
            this.loadLeaderboardData(isFriendsTab ? 'friends' : 'global');
          }
        };
      }
    });

    // Leaderboard friends tab login button
    if (lbFriendsLoginBtn) {
      lbFriendsLoginBtn.onclick = () => {
        this.leaderboardBackdrop?.classList.remove('visible');
        this.authRef?.openFrom('leaderboard');
      };
    }

    // Quit to main menu — reload to return to loading/login screen
    if (this.btnQuit) {
      this.btnQuit.onclick = () => {
        window.location.reload();
      };
    }

    // HUD pause button (in the lateral panel)
    if (this.hudPauseBtn) {
      this.hudPauseBtn.onclick = () => {
        this.pause();
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

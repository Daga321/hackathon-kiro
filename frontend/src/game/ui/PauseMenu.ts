import { FriendsPanel } from './FriendsPanel';
import { AuthUI } from './AuthUI';
import { AudioManager } from '../audio/AudioManager';
import {
  getGlobalLeaderboard,
  getFriendsLeaderboard,
  getMyScores,
} from '../../services/leaderboard.service';
import { isAuthenticated } from '../../services/token-manager';
import type { LeaderboardEntry, MyScoreEntry } from '../../services/types';

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
  private lbTabMyBest: HTMLElement | null;

  private audioSettingsBackdrop: HTMLElement | null;
  private audioSettingsBtnBack: HTMLElement | null;
  private audioMusicSlider: HTMLInputElement | null;
  private audioMusicValue: HTMLElement | null;
  private audioSfxSlider: HTMLInputElement | null;
  private audioSfxValue: HTMLElement | null;

  private _isPaused: boolean = false;
  private _disabled: boolean = false;
  private _audioManager: AudioManager | null = null;
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
    this.lbTabMyBest = document.getElementById('lb-tab-my-best');

    this.audioSettingsBackdrop = document.getElementById('audio-settings-backdrop');
    this.audioSettingsBtnBack = document.getElementById('audio-settings-btn-back');
    this.audioMusicSlider = document.getElementById(
      'audio-music-slider',
    ) as HTMLInputElement | null;
    this.audioMusicValue = document.getElementById('audio-music-value');
    this.audioSfxSlider = document.getElementById('audio-sfx-slider') as HTMLInputElement | null;
    this.audioSfxValue = document.getElementById('audio-sfx-value');

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
   * Set the AudioManager reference for the audio settings panel.
   */
  setAudioManager(audioManager: AudioManager): void {
    this._audioManager = audioManager;
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
    if (this._disabled) return;
    if (this._isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Disable or enable the pause menu.
   * When disabled, keyboard, visibility change, and HUD button won't trigger pause.
   */
  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
  }

  /**
   * Pause the game and show the menu.
   */
  pause(): void {
    if (this._isPaused || this._disabled) return;
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
    this.audioSettingsBackdrop?.classList.remove('visible');
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

  private showAudioSettings(): void {
    // Sync sliders with current values from AudioManager
    if (this._audioManager) {
      const musicVal = Math.round(this._audioManager.getMusicVolume() * 100);
      const sfxVal = Math.round(this._audioManager.getSfxVolume() * 100);
      if (this.audioMusicSlider) this.audioMusicSlider.value = `${musicVal}`;
      if (this.audioMusicValue) this.audioMusicValue.textContent = `${musicVal}%`;
      if (this.audioSfxSlider) this.audioSfxSlider.value = `${sfxVal}`;
      if (this.audioSfxValue) this.audioSfxValue.textContent = `${sfxVal}%`;
    }
    this.backdrop?.classList.remove('visible');
    this.audioSettingsBackdrop?.classList.add('visible');
  }

  private hideAudioSettings(): void {
    this.audioSettingsBackdrop?.classList.remove('visible');
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

  private async loadLeaderboardData(tab: 'global' | 'friends' | 'my-best'): Promise<void> {
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
    } else if (tab === 'friends') {
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
    } else {
      // my-best
      if (!isAuthenticated()) return;
      const result = await getMyScores(20);
      if (result.success) {
        this.renderMyScoresEntries(container, result.data.scores);
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

  private renderMyScoresEntries(container: HTMLElement, scores: MyScoreEntry[]): void {
    if (scores.length === 0) {
      container.innerHTML = `
        <div class="lb-row" style="justify-content: center;">
          <span class="lb-col-name" style="text-align: center; width: 100%;">No scores yet. Play a game!</span>
        </div>`;
      return;
    }

    // Get current username from the HUD
    const username = this.getPlayerName();

    container.innerHTML = scores
      .map((entry) => {
        let rowClass = 'lb-row';
        if (entry.rank === 1) rowClass += ' lb-row-gold';
        else if (entry.rank === 2) rowClass += ' lb-row-silver';
        else if (entry.rank === 3) rowClass += ' lb-row-bronze';

        const dateStr = this.formatScoreDate(entry.timestamp);

        return `
          <div class="${rowClass}">
            <span class="lb-col-rank">${entry.rank}</span>
            <span class="lb-col-name">${username}</span>
            <span class="lb-col-score">${entry.score.toLocaleString()}</span>
            <span class="lb-col-wave">${entry.round}</span>
            <span class="lb-col-date">${dateStr}</span>
          </div>`;
      })
      .join('');
  }

  private getPlayerName(): string {
    const usernameEl = document.getElementById('auth-username');
    if (usernameEl && usernameEl.textContent && usernameEl.textContent !== '---') {
      return usernameEl.textContent;
    }
    return 'You';
  }

  private formatScoreDate(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
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

    // Audio settings
    if (this.btnAudio) {
      this.btnAudio.onclick = () => {
        this.showAudioSettings();
      };
    }

    // Audio settings back button
    if (this.audioSettingsBtnBack) {
      this.audioSettingsBtnBack.onclick = () => {
        this.hideAudioSettings();
      };
    }

    // Audio sliders
    if (this.audioMusicSlider) {
      this.audioMusicSlider.oninput = () => {
        const val = parseInt(this.audioMusicSlider!.value, 10);
        if (this.audioMusicValue) this.audioMusicValue.textContent = `${val}%`;
        this._audioManager?.setMusicVolume(val / 100);
      };
    }
    if (this.audioSfxSlider) {
      this.audioSfxSlider.oninput = () => {
        const val = parseInt(this.audioSfxSlider!.value, 10);
        if (this.audioSfxValue) this.audioSfxValue.textContent = `${val}%`;
        this._audioManager?.setSfxVolume(val / 100);
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
    const lbTabs = [this.lbTabGlobal, this.lbTabFriends, this.lbTabMyBest];
    const lbListContainer = document.getElementById('lb-list-container');
    const lbHeader = document.querySelector('#lb-panel-header') as HTMLElement | null;
    const lbHeaderDate = lbHeader?.querySelector('.lb-col-date') as HTMLElement | null;
    const lbFriendsNotLogged = document.getElementById('lb-friends-not-logged');
    const lbFriendsLoginBtn = document.getElementById('lb-friends-login-btn');

    lbTabs.forEach((tab) => {
      if (tab) {
        tab.onclick = () => {
          lbTabs.forEach((t) => t?.classList.remove('friends-tab-active'));
          tab.classList.add('friends-tab-active');

          const isFriendsTab = tab === this.lbTabFriends;
          const isMyBestTab = tab === this.lbTabMyBest;
          const needsAuth = isFriendsTab || isMyBestTab;

          // Toggle Date column visibility
          if (lbHeaderDate) {
            lbHeaderDate.style.display = isMyBestTab ? '' : 'none';
          }

          if (needsAuth && !this.getAuthLoggedIn()) {
            // Not logged in — show login prompt, hide list
            if (lbListContainer) lbListContainer.style.display = 'none';
            if (lbHeader) lbHeader.style.display = 'none';
            if (lbFriendsNotLogged) lbFriendsNotLogged.style.display = 'flex';
          } else {
            // Show list and load data from API
            if (lbListContainer) lbListContainer.style.display = 'flex';
            if (lbHeader) lbHeader.style.display = 'flex';
            if (lbFriendsNotLogged) lbFriendsNotLogged.style.display = 'none';

            let tabKey: 'global' | 'friends' | 'my-best' = 'global';
            if (isFriendsTab) tabKey = 'friends';
            else if (isMyBestTab) tabKey = 'my-best';

            this.loadLeaderboardData(tabKey);
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
    // Prevent duplicate listeners on scene restart
    if (PauseMenu._visibilityBound) return;
    PauseMenu._visibilityBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this._isPaused) {
        this.pause();
      }
    });
  }

  /** Static flag to prevent duplicate document-level event listeners */
  private static _visibilityBound = false;
  private static _keyboardBound = false;
  private static _activeInstance: PauseMenu | null = null;

  /**
   * Listen for ESC and P keys at the document level.
   * This works even when Phaser's update loop is paused.
   */
  private bindKeyboard(): void {
    // Update active instance reference so restarted scenes use the new PauseMenu
    PauseMenu._activeInstance = this;

    // Prevent duplicate listeners on scene restart
    if (PauseMenu._keyboardBound) return;
    PauseMenu._keyboardBound = true;

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        // Don't toggle if user is typing in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        e.preventDefault();
        // Always use the latest active instance
        PauseMenu._activeInstance?.toggle();
      }
    });
  }
}

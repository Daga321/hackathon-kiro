import { AuthUI } from './AuthUI';

/**
 * FriendsPanel — manages the Friends Management Panel overlay.
 *
 * Accessible from Pause Menu. If user is not logged in, shows a prompt
 * to sign in. Otherwise shows tabs: My Friends, Requests, Add Friend.
 *
 * UI-only — actual friend operations will be connected to backend later.
 */
export class FriendsPanel {
  private backdrop: HTMLElement | null;
  private notLoggedSection: HTMLElement | null;
  private contentSection: HTMLElement | null;
  private friendsLoginBtn: HTMLElement | null;
  private backBtn: HTMLElement | null;

  // Tabs
  private tabList: HTMLElement | null;
  private tabRequests: HTMLElement | null;
  private tabAdd: HTMLElement | null;
  private panelList: HTMLElement | null;
  private panelRequests: HTMLElement | null;
  private panelAdd: HTMLElement | null;

  // Add friend
  private addInput: HTMLInputElement | null;
  private addSubmit: HTMLElement | null;
  private addStatus: HTMLElement | null;

  private authUI: AuthUI;
  private onBackCallback: (() => void) | null = null;

  constructor(authUI: AuthUI) {
    this.authUI = authUI;

    this.backdrop = document.getElementById('friends-backdrop');
    this.notLoggedSection = document.getElementById('friends-not-logged');
    this.contentSection = document.getElementById('friends-content');
    this.friendsLoginBtn = document.getElementById('friends-login-btn');
    this.backBtn = document.getElementById('friends-btn-back');

    this.tabList = document.getElementById('friends-tab-list');
    this.tabRequests = document.getElementById('friends-tab-requests');
    this.tabAdd = document.getElementById('friends-tab-add');
    this.panelList = document.getElementById('friends-panel-list');
    this.panelRequests = document.getElementById('friends-panel-requests');
    this.panelAdd = document.getElementById('friends-panel-add');

    this.addInput = document.getElementById('friends-add-input') as HTMLInputElement;
    this.addSubmit = document.getElementById('friends-add-submit');
    this.addStatus = document.getElementById('friends-add-status');

    this.bindEvents();
  }

  /**
   * Register callback for when Back is pressed (returns to pause menu).
   */
  onBack(callback: () => void): void {
    this.onBackCallback = callback;
  }

  /**
   * Show the friends panel overlay.
   */
  show(): void {
    // Update logged-in state
    if (this.authUI.isLoggedIn) {
      if (this.notLoggedSection) this.notLoggedSection.style.display = 'none';
      if (this.contentSection) this.contentSection.style.display = 'block';
    } else {
      if (this.notLoggedSection) this.notLoggedSection.style.display = 'flex';
      if (this.contentSection) this.contentSection.style.display = 'none';
    }

    this.backdrop?.classList.add('visible');
    this.switchTab('list');
  }

  /**
   * Hide the friends panel overlay.
   */
  hide(): void {
    this.backdrop?.classList.remove('visible');
  }

  // ─── Private ───

  private switchTab(tab: 'list' | 'requests' | 'add'): void {
    // Reset all tabs
    [this.tabList, this.tabRequests, this.tabAdd].forEach((t) => {
      t?.classList.remove('friends-tab-active');
    });
    [this.panelList, this.panelRequests, this.panelAdd].forEach((p) => {
      if (p) p.style.display = 'none';
    });

    // Activate selected tab
    if (tab === 'list') {
      this.tabList?.classList.add('friends-tab-active');
      if (this.panelList) this.panelList.style.display = 'block';
    } else if (tab === 'requests') {
      this.tabRequests?.classList.add('friends-tab-active');
      if (this.panelRequests) this.panelRequests.style.display = 'block';
    } else if (tab === 'add') {
      this.tabAdd?.classList.add('friends-tab-active');
      if (this.panelAdd) this.panelAdd.style.display = 'block';
      if (this.addStatus) this.addStatus.textContent = '';
    }
  }

  private bindEvents(): void {
    // Back button
    if (this.backBtn) {
      this.backBtn.onclick = () => {
        this.hide();
        this.onBackCallback?.();
      };
    }

    // Sign In from friends panel — opens auth popup
    if (this.friendsLoginBtn) {
      this.friendsLoginBtn.onclick = () => {
        this.hide();
        this.authUI.openFrom('friends');
      };
    }

    // After successful login, re-show friends panel with content
    this.authUI.onLoginSuccess((source) => {
      if (source === 'friends') {
        this.show();
      }
    });

    // Tabs
    if (this.tabList) {
      this.tabList.onclick = () => this.switchTab('list');
    }
    if (this.tabRequests) {
      this.tabRequests.onclick = () => this.switchTab('requests');
    }
    if (this.tabAdd) {
      this.tabAdd.onclick = () => this.switchTab('add');
    }

    // Add friend submit
    if (this.addSubmit) {
      this.addSubmit.onclick = () => {
        const value = this.addInput?.value?.trim();
        if (!value) {
          if (this.addStatus) {
            this.addStatus.textContent = 'Enter a username or email';
            this.addStatus.style.color = '#ff4444';
          }
          return;
        }

        // TODO: Replace with real friend request API call
        // For now, simulate success
        if (this.addStatus) {
          this.addStatus.textContent = `Request sent to "${value}"`;
          this.addStatus.style.color = '#44ff44';
        }
        if (this.addInput) this.addInput.value = '';
      };
    }

    // Prevent Phaser from capturing keys in the add-friend input
    if (this.addInput) {
      this.addInput.addEventListener('keydown', (e: KeyboardEvent) => {
        e.stopPropagation();
      });
      this.addInput.addEventListener('keyup', (e: KeyboardEvent) => {
        e.stopPropagation();
      });
    }
  }
}

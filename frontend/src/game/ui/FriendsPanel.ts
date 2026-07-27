import { AuthUI } from './AuthUI';
import {
  listFriends,
  sendFriendRequest,
  removeFriend,
} from '../../services/friends.service';

/**
 * FriendsPanel — manages the Friends Management Panel overlay.
 *
 * Accessible from Pause Menu. If user is not logged in, shows a prompt
 * to sign in. Otherwise shows tabs: My Friends, Requests, Add Friend.
 *
 * Connected to friends.service.ts for real API operations via API Gateway.
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

    // Activate selected tab and load data
    if (tab === 'list') {
      this.tabList?.classList.add('friends-tab-active');
      if (this.panelList) this.panelList.style.display = 'block';
      this.loadFriendsList();
    } else if (tab === 'requests') {
      this.tabRequests?.classList.add('friends-tab-active');
      if (this.panelRequests) this.panelRequests.style.display = 'block';
      this.loadPendingRequests();
    } else if (tab === 'add') {
      this.tabAdd?.classList.add('friends-tab-active');
      if (this.panelAdd) this.panelAdd.style.display = 'block';
      if (this.addStatus) this.addStatus.textContent = '';
    }
  }

  private async loadFriendsList(): Promise<void> {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    container.innerHTML = '<p class="friends-empty-text">Loading...</p>';

    const result = await listFriends();

    if (!result.success) {
      container.innerHTML = `<p class="friends-empty-text" style="color: #cc3333;">${result.error}</p>`;
      return;
    }

    const friends = result.data.friends;

    if (friends.length === 0) {
      container.innerHTML = '<p class="friends-empty-text">No friends yet. Add some!</p>';
      return;
    }

    container.innerHTML = friends
      .map(
        (friend) => `
        <div class="friends-row" data-friend-id="${friend.friendId}">
          <span class="friends-row-name">${friend.friendId}</span>
          <button class="friends-row-action friends-remove-btn" data-id="${friend.friendId}">Remove</button>
        </div>`,
      )
      .join('');

    // Bind remove buttons
    container.querySelectorAll('.friends-remove-btn').forEach((btn) => {
      (btn as HTMLElement).onclick = async () => {
        const friendId = btn.getAttribute('data-id');
        if (!friendId) return;

        (btn as HTMLElement).textContent = '...';
        const removeResult = await removeFriend(friendId);

        if (removeResult.success) {
          const row = btn.closest('.friends-row');
          row?.remove();
          if (container.querySelectorAll('.friends-row').length === 0) {
            container.innerHTML = '<p class="friends-empty-text">No friends yet. Add some!</p>';
          }
        } else {
          (btn as HTMLElement).textContent = 'Remove';
        }
      };
    });
  }

  private async loadPendingRequests(): Promise<void> {
    const container = document.getElementById('friends-requests-container');
    if (!container) return;

    // The current backend GET /friends filters by status=confirmed only.
    // Pending requests support requires a backend update to expose
    // entries with status=pending. For now, show empty state.
    container.innerHTML = '<p class="friends-empty-text">No pending requests.</p>';
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

    // Add friend submit — calls friends.service.sendFriendRequest()
    if (this.addSubmit) {
      this.addSubmit.onclick = async () => {
        const value = this.addInput?.value?.trim();
        if (!value) {
          if (this.addStatus) {
            this.addStatus.textContent = 'Enter a username or email';
            this.addStatus.style.color = '#ff4444';
          }
          return;
        }

        if (this.addStatus) {
          this.addStatus.textContent = 'Sending...';
          this.addStatus.style.color = '#aaa';
        }

        const result = await sendFriendRequest(value);

        if (result.success) {
          if (this.addStatus) {
            this.addStatus.textContent = `Request sent to "${value}"`;
            this.addStatus.style.color = '#44ff44';
          }
          if (this.addInput) this.addInput.value = '';
        } else {
          if (this.addStatus) {
            this.addStatus.textContent = result.error;
            this.addStatus.style.color = '#ff4444';
          }
        }
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

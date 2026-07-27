/**
 * AuthUI — manages the Login/Register popup and HUD auth state.
 *
 * Handles UI state transitions between guest/logged-in views,
 * form toggling (login ↔ register), and button interactions.
 *
 * Connected to auth.service.ts for real authentication via API Gateway.
 */
import { login, register, logout, hasActiveSession } from '../../services/auth.service';
import { getUsername, clearTokens } from '../../services/token-manager';
import { retryPendingScores } from '../../services/leaderboard.service';

export class AuthUI {
  // HUD elements
  private guestSection: HTMLElement | null;
  private loggedSection: HTMLElement | null;
  private usernameEl: HTMLElement | null;
  private loginBtn: HTMLElement | null;
  private logoutBtn: HTMLElement | null;

  // Popup elements
  private backdrop: HTMLElement | null;
  private loginView: HTMLElement | null;
  private registerView: HTMLElement | null;
  private showRegisterLink: HTMLElement | null;
  private showLoginLink: HTMLElement | null;
  private closeBtn: HTMLElement | null;

  // Form elements
  private loginSubmit: HTMLElement | null;
  private registerSubmit: HTMLElement | null;
  private loginError: HTMLElement | null;
  private registerError: HTMLElement | null;

  private _isLoggedIn: boolean = false;
  private onOpenCallback: (() => void) | null = null;
  private onCloseCallback: (() => void) | null = null;
  private loginSuccessListeners: ((source: 'hud' | 'friends' | 'leaderboard' | null) => void)[] =
    [];
  private returnTo: 'hud' | 'friends' | 'leaderboard' | null = null;

  constructor() {
    // HUD
    this.guestSection = document.getElementById('auth-guest');
    this.loggedSection = document.getElementById('auth-logged');
    this.usernameEl = document.getElementById('auth-username');
    this.loginBtn = document.getElementById('hud-login-btn');
    this.logoutBtn = document.getElementById('hud-logout-btn');

    // Popup
    this.backdrop = document.getElementById('auth-backdrop');
    this.loginView = document.getElementById('auth-login-view');
    this.registerView = document.getElementById('auth-register-view');
    this.showRegisterLink = document.getElementById('auth-show-register');
    this.showLoginLink = document.getElementById('auth-show-login');
    this.closeBtn = document.getElementById('auth-close-btn');

    // Forms
    this.loginSubmit = document.getElementById('auth-login-submit');
    this.registerSubmit = document.getElementById('auth-register-submit');
    this.loginError = document.getElementById('auth-login-error');
    this.registerError = document.getElementById('auth-register-error');

    this.bindEvents();
    this.restoreSession();
  }

  get isLoggedIn(): boolean {
    return this._isLoggedIn;
  }

  /**
   * Register callback for when the popup opens (to pause the game).
   */
  onOpen(callback: () => void): void {
    this.onOpenCallback = callback;
  }

  /**
   * Register callback for when the popup closes (to resume the game).
   */
  onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  /**
   * Register callback for when login succeeds.
   * Callback receives the source that triggered the login.
   * Multiple listeners supported.
   */
  onLoginSuccess(callback: (source: 'hud' | 'friends' | 'leaderboard' | null) => void): void {
    this.loginSuccessListeners.push(callback);
  }

  /**
   * Open the auth popup indicating where the user came from.
   * After login, the system will return to the appropriate panel.
   */
  openFrom(source: 'hud' | 'friends' | 'leaderboard'): void {
    this.returnTo = source;
    this.backdrop?.classList.add('visible');
    this.showLoginForm();
    // Don't call onOpenCallback for friends/leaderboard — game is already paused
    if (source === 'hud') {
      this.onOpenCallback?.();
    }
  }

  /**
   * Set the UI to logged-in state.
   */
  setLoggedIn(username: string): void {
    this._isLoggedIn = true;
    if (this.usernameEl) this.usernameEl.textContent = username;
    if (this.guestSection) this.guestSection.style.display = 'none';
    if (this.loggedSection) this.loggedSection.style.display = 'flex';

    // Hide the auth popup
    this.backdrop?.classList.remove('visible');
    this.clearErrors();

    const source = this.returnTo;
    this.returnTo = null;

    // Notify listeners about login success (pass source for routing)
    for (const cb of this.loginSuccessListeners) {
      cb(source);
    }

    // If opened from HUD, show a "continue" confirmation instead of auto-resuming
    if (source === 'hud') {
      this.showContinuePrompt();
    }
  }

  /**
   * Log out and return to guest state.
   */
  setLoggedOut(): void {
    this._isLoggedIn = false;
    if (this.usernameEl) this.usernameEl.textContent = '---';
    if (this.guestSection) this.guestSection.style.display = 'flex';
    if (this.loggedSection) this.loggedSection.style.display = 'none';
  }

  // ─── Private ───

  /**
   * Restore session from localStorage on page load.
   * If a valid token exists, set UI to logged-in without requiring credentials.
   */
  private restoreSession(): void {
    if (hasActiveSession()) {
      const username = getUsername() || 'Player';
      this._isLoggedIn = true;
      if (this.usernameEl) this.usernameEl.textContent = username;
      if (this.guestSection) this.guestSection.style.display = 'none';
      if (this.loggedSection) this.loggedSection.style.display = 'flex';

      // Silently retry any pending scores from previous failed submissions
      retryPendingScores();
    }
  }

  private hidePopup(): void {
    this.backdrop?.classList.remove('visible');
    this.clearErrors();
    this.hideContinuePrompt();
    this.onCloseCallback?.();
  }

  /**
   * Show a "login successful, press continue" screen so the player
   * consciously resumes gameplay.
   */
  private showContinuePrompt(): void {
    // Hide forms, show a success + continue message
    if (this.loginView) this.loginView.style.display = 'none';
    if (this.registerView) this.registerView.style.display = 'none';

    let prompt = document.getElementById('auth-continue-prompt');
    if (!prompt) {
      prompt = document.createElement('div');
      prompt.id = 'auth-continue-prompt';
      prompt.style.cssText =
        'display:flex;flex-direction:column;align-items:center;gap:16px;z-index:1;';
      prompt.innerHTML = `
        <p style="font-size:0.55rem;color:#44ff44;text-align:center;line-height:2;">Login successful!</p>
        <p style="font-size:0.4rem;color:#aaa;text-align:center;line-height:2;">The game is paused.<br>Press continue when ready.</p>
        <button id="auth-continue-btn" class="pause-btn pause-btn-primary">Continue</button>
      `;
      // Insert into the auth board
      const board = this.backdrop?.querySelector('.pause-board');
      const closeBtnEl = document.getElementById('auth-close-btn');
      if (board && closeBtnEl) {
        board.insertBefore(prompt, closeBtnEl);
      }
    } else {
      prompt.style.display = 'flex';
    }

    // Hide the close button while showing continue prompt
    const closeBtnEl = document.getElementById('auth-close-btn');
    if (closeBtnEl) closeBtnEl.style.display = 'none';

    // Keep backdrop visible
    this.backdrop?.classList.add('visible');

    // Bind continue button
    const continueBtn = document.getElementById('auth-continue-btn');
    if (continueBtn) {
      continueBtn.onclick = () => {
        this.hideContinuePrompt();
        this.backdrop?.classList.remove('visible');
        this.onCloseCallback?.();
      };
    }
  }

  private hideContinuePrompt(): void {
    const prompt = document.getElementById('auth-continue-prompt');
    if (prompt) prompt.style.display = 'none';
    const closeBtnEl = document.getElementById('auth-close-btn');
    if (closeBtnEl) closeBtnEl.style.display = '';
  }

  private showLoginForm(): void {
    if (this.loginView) this.loginView.style.display = 'block';
    if (this.registerView) this.registerView.style.display = 'none';
    this.clearErrors();
  }

  private showRegisterForm(): void {
    if (this.loginView) this.loginView.style.display = 'none';
    if (this.registerView) this.registerView.style.display = 'block';
    this.clearErrors();
  }

  private clearErrors(): void {
    if (this.loginError) this.loginError.textContent = '';
    if (this.registerError) this.registerError.textContent = '';
  }

  private setSubmitLoading(btn: HTMLElement | null, loading: boolean): void {
    if (!btn) return;
    if (loading) {
      btn.setAttribute('data-original-text', btn.textContent || '');
      btn.textContent = 'Loading...';
      btn.setAttribute('disabled', 'true');
      (btn as HTMLButtonElement).style.opacity = '0.6';
    } else {
      btn.textContent = btn.getAttribute('data-original-text') || 'Submit';
      btn.removeAttribute('disabled');
      (btn as HTMLButtonElement).style.opacity = '1';
    }
  }

  private bindEvents(): void {
    // Open popup from HUD
    if (this.loginBtn) {
      this.loginBtn.onclick = () => this.openFrom('hud');
    }

    // Logout — calls the API to invalidate tokens server-side
    if (this.logoutBtn) {
      this.logoutBtn.onclick = async () => {
        await logout();
        this.setLoggedOut();
      };
    }

    // Close popup
    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.hidePopup();
    }

    // Toggle between login and register
    if (this.showRegisterLink) {
      this.showRegisterLink.onclick = () => this.showRegisterForm();
    }
    if (this.showLoginLink) {
      this.showLoginLink.onclick = () => this.showLoginForm();
    }

    // Login submit — calls auth.service.login()
    if (this.loginSubmit) {
      this.loginSubmit.onclick = async () => {
        const emailInput = document.getElementById('auth-login-email') as HTMLInputElement;
        const passwordInput = document.getElementById('auth-login-password') as HTMLInputElement;
        const username = emailInput?.value?.trim();
        const password = passwordInput?.value;

        if (!username || !password) {
          if (this.loginError) this.loginError.textContent = 'All fields are required';
          return;
        }

        this.setSubmitLoading(this.loginSubmit, true);

        const result = await login(username, password);

        this.setSubmitLoading(this.loginSubmit, false);

        if (result.success) {
          const displayName = getUsername() || username;
          this.setLoggedIn(displayName);
        } else {
          if (this.loginError) this.loginError.textContent = result.error;
        }
      };
    }

    // Register submit — calls auth.service.register() then auto-login
    if (this.registerSubmit) {
      this.registerSubmit.onclick = async () => {
        const usernameInput = document.getElementById('auth-register-username') as HTMLInputElement;
        const emailInput = document.getElementById('auth-register-email') as HTMLInputElement;
        const passwordInput = document.getElementById('auth-register-password') as HTMLInputElement;
        const username = usernameInput?.value?.trim();
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value;

        if (!username || !email || !password) {
          if (this.registerError) this.registerError.textContent = 'All fields are required';
          return;
        }

        if (!this.isValidEmail(email)) {
          if (this.registerError) this.registerError.textContent = 'Invalid email format';
          return;
        }

        this.setSubmitLoading(this.registerSubmit, true);

        const registerResult = await register(username, email, password);

        if (!registerResult.success) {
          this.setSubmitLoading(this.registerSubmit, false);
          if (this.registerError) this.registerError.textContent = registerResult.error;
          return;
        }

        // Auto-login after successful registration
        const loginResult = await login(username, password);

        this.setSubmitLoading(this.registerSubmit, false);

        if (loginResult.success) {
          this.setLoggedIn(username);
        } else {
          // Registration succeeded but auto-login failed — let user try manually
          if (this.registerError) {
            this.registerError.style.color = '#44ff44';
            this.registerError.textContent =
              'Account created! Please log in with your credentials.';
          }
          this.showLoginForm();
        }
      };
    }

    // Password visibility toggles
    const toggleButtons = document.querySelectorAll<HTMLButtonElement>('.auth-toggle-password');
    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;
        const input = document.getElementById(targetId) as HTMLInputElement;
        if (!input) return;

        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = 'Hide';
        } else {
          input.type = 'password';
          btn.textContent = 'Show';
        }
      });
    });

    // Prevent Phaser from capturing keyboard events when auth inputs are focused
    const allInputs = document.querySelectorAll<HTMLInputElement>('.auth-input');
    allInputs.forEach((input) => {
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        e.stopPropagation();
      });
      input.addEventListener('keyup', (e: KeyboardEvent) => {
        e.stopPropagation();
      });
    });
  }

  private isValidEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
}

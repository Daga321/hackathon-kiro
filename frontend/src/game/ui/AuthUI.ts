/**
 * AuthUI — manages the Login/Register popup and HUD auth state.
 *
 * Handles UI state transitions between guest/logged-in views,
 * form toggling (login ↔ register), and button interactions.
 *
 * This is UI-only — actual authentication logic will be connected later.
 */
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
   * Simulate a successful login (UI-only, will be replaced with real auth).
   */
  setLoggedIn(username: string): void {
    this._isLoggedIn = true;
    if (this.usernameEl) this.usernameEl.textContent = username;
    if (this.guestSection) this.guestSection.style.display = 'none';
    if (this.loggedSection) this.loggedSection.style.display = 'flex';
    this.hidePopup();
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

  private showPopup(): void {
    this.backdrop?.classList.add('visible');
    this.showLoginForm();
    this.onOpenCallback?.();
  }

  private hidePopup(): void {
    this.backdrop?.classList.remove('visible');
    this.clearErrors();
    this.onCloseCallback?.();
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

  private bindEvents(): void {
    // Open popup from HUD
    if (this.loginBtn) {
      this.loginBtn.onclick = () => this.showPopup();
    }

    // Logout
    if (this.logoutBtn) {
      this.logoutBtn.onclick = () => this.setLoggedOut();
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

    // Login submit (UI-only mock)
    if (this.loginSubmit) {
      this.loginSubmit.onclick = () => {
        const emailInput = document.getElementById('auth-login-email') as HTMLInputElement;
        const passwordInput = document.getElementById('auth-login-password') as HTMLInputElement;
        const email = emailInput?.value?.trim();
        const password = passwordInput?.value;

        if (!email || !password) {
          if (this.loginError) this.loginError.textContent = 'All fields are required';
          return;
        }

        if (!this.isValidEmail(email)) {
          if (this.loginError) this.loginError.textContent = 'Invalid email format';
          return;
        }

        // TODO: Replace with real auth call
        // For now, simulate success with email as username
        const username = email.split('@')[0];
        this.setLoggedIn(username);
      };
    }

    // Register submit (UI-only mock)
    if (this.registerSubmit) {
      this.registerSubmit.onclick = () => {
        const usernameInput = document.getElementById(
          'auth-register-username',
        ) as HTMLInputElement;
        const emailInput = document.getElementById('auth-register-email') as HTMLInputElement;
        const passwordInput = document.getElementById(
          'auth-register-password',
        ) as HTMLInputElement;
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

        // TODO: Replace with real auth call
        // For now, simulate success
        this.setLoggedIn(username);
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

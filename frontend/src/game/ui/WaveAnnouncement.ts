/**
 * WaveAnnouncement — controls the HTML wave announcement overlay.
 *
 * Displays the current wave number and enemy count with a fade-in/fade-out
 * animation. Auto-dismisses after a configurable duration.
 * Does not block player input (pointer-events: none in CSS).
 */
export class WaveAnnouncement {
  private container: HTMLElement | null;
  private titleEl: HTMLElement | null;
  private subtitleEl: HTMLElement | null;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  /** How long the announcement stays visible (ms) */
  private static readonly DISPLAY_DURATION_MS = 2500;

  constructor() {
    this.container = document.getElementById('wave-announcement');
    this.titleEl = document.getElementById('wave-announcement-title');
    this.subtitleEl = document.getElementById('wave-announcement-subtitle');
  }

  /**
   * Show the wave announcement overlay.
   * @param wave - Current wave number
   * @param enemyCount - Number of enemies in this wave
   */
  show(wave: number, enemyCount: number): void {
    if (!this.container || !this.titleEl || !this.subtitleEl) return;

    // Clear any pending hide timeout from a previous announcement
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Update content
    this.titleEl.textContent = `Wave ${wave}`;
    this.subtitleEl.textContent =
      enemyCount === 1 ? '1 Enemy Approaching' : `${enemyCount} Enemies Approaching`;

    // Fade in
    this.container.classList.add('visible');

    // Auto-dismiss after duration
    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, WaveAnnouncement.DISPLAY_DURATION_MS);
  }

  /**
   * Hide the wave announcement overlay (fade out).
   */
  hide(): void {
    if (!this.container) return;
    this.container.classList.remove('visible');
    this.hideTimeout = null;
  }
}

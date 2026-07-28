import { LocalScoreStore, LocalScoreEntry } from './LocalScoreStore';

/**
 * ResultsScreen — populates the Game Over overlay with final stats
 * and a local leaderboard.
 *
 * The Game Over screen now directly shows:
 * - GAME OVER title (handled by HTML)
 * - Wave reached + Final score
 * - Local leaderboard (top 10) with current run highlighted
 *
 * Architecture is prepared for future online leaderboard integration
 * via the existing leaderboard.service.ts.
 */
export class ResultsScreen {
  private waveValue: HTMLElement | null;
  private scoreValue: HTMLElement | null;
  private lbContainer: HTMLElement | null;

  private _isShowing: boolean = false;
  private localStore: LocalScoreStore;

  constructor() {
    this.waveValue = document.getElementById('results-wave-value');
    this.scoreValue = document.getElementById('results-score-value');
    this.lbContainer = document.getElementById('results-lb-list');
    this.localStore = new LocalScoreStore();
  }

  /**
   * Whether the results have been populated.
   */
  get isShowing(): boolean {
    return this._isShowing;
  }

  /**
   * Populate the Game Over overlay with stats and leaderboard.
   * Saves the score locally and renders the leaderboard table.
   */
  show(score: number, wave: number): void {
    if (this._isShowing) return;
    this._isShowing = true;

    // Display stats
    if (this.waveValue) this.waveValue.textContent = `${wave}`;
    if (this.scoreValue) this.scoreValue.textContent = this.formatScore(score);

    // Save to local leaderboard
    const entryId = this.localStore.addEntry(score, wave);

    // Render leaderboard
    this.renderLeaderboard(entryId);
  }

  /**
   * Reset state (for scene restart).
   */
  hide(): void {
    this._isShowing = false;
  }

  // ─── Private ───

  private formatScore(score: number): string {
    return score.toLocaleString('en-US');
  }

  private renderLeaderboard(currentEntryId: string): void {
    if (!this.lbContainer) return;

    const entries = this.localStore.getTopEntries(10);
    this.lbContainer.innerHTML = '';

    entries.forEach((entry: LocalScoreEntry, index: number) => {
      const row = document.createElement('div');
      const rank = index + 1;

      // Determine row styling
      let rowClass = 'lb-row';
      if (rank === 1) rowClass += ' lb-row-gold';
      else if (rank === 2) rowClass += ' lb-row-silver';
      else if (rank === 3) rowClass += ' lb-row-bronze';

      // Highlight current run
      if (entry.id === currentEntryId) {
        rowClass += ' results-lb-current';
      }

      row.className = rowClass;
      row.innerHTML = `
        <span class="lb-col-rank">${rank}</span>
        <span class="lb-col-name">${this.escapeHtml(entry.name)}</span>
        <span class="lb-col-score">${entry.score.toLocaleString('en-US')}</span>
        <span class="lb-col-wave">${entry.wave}</span>
      `;

      this.lbContainer!.appendChild(row);
    });

    // If no entries, show placeholder
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'results-lb-empty';
      empty.textContent = 'No scores yet';
      this.lbContainer.appendChild(empty);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

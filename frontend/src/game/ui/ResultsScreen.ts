import { LocalScoreStore, LocalScoreEntry } from './LocalScoreStore';
import { getMyScores } from '../../services/leaderboard.service';
import { isAuthenticated } from '../../services/token-manager';
import type { MyScoreEntry } from '../../services/types';

/**
 * ResultsScreen — populates the Game Over overlay with final stats
 * and a personal best leaderboard.
 *
 * The Game Over screen shows:
 * - GAME OVER title (handled by HTML)
 * - Wave reached + Final score
 * - Personal best leaderboard (top 10):
 *   - From DynamoDB if authenticated (via GET /leaderboard/my-scores)
 *   - From localStorage as fallback (offline / not logged in)
 *   - Current run highlighted in both modes
 */
export class ResultsScreen {
  private waveValue: HTMLElement | null;
  private scoreValue: HTMLElement | null;
  private lbContainer: HTMLElement | null;
  private lbTitle: HTMLElement | null;

  private _isShowing: boolean = false;
  private localStore: LocalScoreStore;

  constructor() {
    this.waveValue = document.getElementById('results-wave-value');
    this.scoreValue = document.getElementById('results-score-value');
    this.lbContainer = document.getElementById('results-lb-list');
    this.lbTitle = document.getElementById('results-lb-title');
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
   * Saves the score locally, then attempts to load from DB if authenticated.
   */
  show(score: number, wave: number): void {
    if (this._isShowing) return;
    this._isShowing = true;

    // Display stats
    if (this.waveValue) this.waveValue.textContent = `${wave}`;
    if (this.scoreValue) this.scoreValue.textContent = this.formatScore(score);

    // Always save to local leaderboard (offline backup)
    const entryId = this.localStore.addEntry(score, wave);

    // Try to load from DB if authenticated, otherwise use local
    if (isAuthenticated()) {
      this.loadFromDatabase(score, wave);
    } else {
      this.setTitle('My Best (Local)');
      this.renderLocalLeaderboard(entryId);
    }
  }

  /**
   * Reset state (for scene restart).
   */
  hide(): void {
    this._isShowing = false;
  }

  // ─── Private ───

  private async loadFromDatabase(currentScore: number, currentWave: number): Promise<void> {
    this.setTitle('My Best');
    this.renderLoading();

    const result = await getMyScores(10);

    if (result.success && result.data.scores.length > 0) {
      this.renderDbLeaderboard(result.data.scores, currentScore, currentWave);
    } else {
      // Fallback to local if DB call fails or returns empty
      const entryId = this.findLocalEntryId(currentScore, currentWave);
      this.setTitle('My Best (Local)');
      this.renderLocalLeaderboard(entryId);
    }
  }

  private setTitle(text: string): void {
    if (this.lbTitle) this.lbTitle.textContent = text;
  }

  private renderLoading(): void {
    if (!this.lbContainer) return;
    this.lbContainer.innerHTML = '';
    const loader = document.createElement('p');
    loader.className = 'results-lb-empty';
    loader.textContent = 'Loading...';
    this.lbContainer.appendChild(loader);
  }

  private renderDbLeaderboard(
    scores: MyScoreEntry[],
    currentScore: number,
    currentWave: number,
  ): void {
    if (!this.lbContainer) return;
    this.lbContainer.innerHTML = '';

    const username = this.getPlayerName();

    scores.forEach((entry: MyScoreEntry) => {
      const row = document.createElement('div');
      const rank = entry.rank;

      // Determine row styling
      let rowClass = 'lb-row';
      if (rank === 1) rowClass += ' lb-row-gold';
      else if (rank === 2) rowClass += ' lb-row-silver';
      else if (rank === 3) rowClass += ' lb-row-bronze';

      // Highlight if this entry matches the current run
      if (entry.score === currentScore && entry.round === currentWave) {
        rowClass += ' results-lb-current';
      }

      row.className = rowClass;
      row.innerHTML = `
        <span class="lb-col-rank">${rank}</span>
        <span class="lb-col-name">${this.escapeHtml(username)}</span>
        <span class="lb-col-score">${entry.score.toLocaleString('en-US')}</span>
        <span class="lb-col-wave">${entry.round}</span>
      `;

      this.lbContainer!.appendChild(row);
    });
  }

  private renderLocalLeaderboard(currentEntryId: string): void {
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

  private findLocalEntryId(score: number, wave: number): string {
    // Find the most recent local entry matching this score/wave
    const entries = this.localStore.getAllEntries();
    const match = entries.find((e) => e.score === score && e.wave === wave);
    return match?.id || '';
  }

  private formatScore(score: number): string {
    return score.toLocaleString('en-US');
  }

  private getPlayerName(): string {
    const usernameEl = document.getElementById('auth-username');
    if (usernameEl && usernameEl.textContent && usernameEl.textContent !== '---') {
      return usernameEl.textContent;
    }
    return 'You';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

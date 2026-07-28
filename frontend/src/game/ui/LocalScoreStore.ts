/**
 * LocalScoreStore — manages a local leaderboard persisted in localStorage.
 *
 * Stores up to MAX_ENTRIES scores sorted by score descending.
 * Each entry has a unique ID to allow highlighting the current run.
 *
 * Architecture is ready for future online integration:
 * - The interface (LocalScoreEntry) mirrors LeaderboardEntry from services/types.ts
 * - When online leaderboard is connected, this store can serve as offline fallback
 * - The ResultsScreen can switch between local and online data sources
 */

const STORAGE_KEY = 'horde_local_leaderboard';
const MAX_ENTRIES = 50;

export interface LocalScoreEntry {
  id: string;
  name: string;
  score: number;
  wave: number;
  timestamp: string;
}

export class LocalScoreStore {
  /**
   * Add a new score entry to the local leaderboard.
   * Returns the unique ID of the new entry (for highlighting).
   */
  addEntry(score: number, wave: number): string {
    const entries = this.getAllEntries();
    const id = this.generateId();
    const name = this.getPlayerName();

    const newEntry: LocalScoreEntry = {
      id,
      name,
      score,
      wave,
      timestamp: new Date().toISOString(),
    };

    entries.push(newEntry);

    // Sort by score descending, then by wave descending as tiebreaker
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.wave - a.wave;
    });

    // Keep only top MAX_ENTRIES
    const trimmed = entries.slice(0, MAX_ENTRIES);
    this.saveEntries(trimmed);

    return id;
  }

  /**
   * Get the top N entries from the local leaderboard.
   */
  getTopEntries(count: number = 10): LocalScoreEntry[] {
    const entries = this.getAllEntries();
    return entries.slice(0, count);
  }

  /**
   * Get all stored entries.
   */
  getAllEntries(): LocalScoreEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as LocalScoreEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Clear all local scores (useful for dev/testing).
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ─── Private ───

  private saveEntries(entries: LocalScoreEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Get the player display name.
   * Uses the authenticated username if available, otherwise "You".
   */
  private getPlayerName(): string {
    // Check if user is logged in (auth username shown in HUD)
    const usernameEl = document.getElementById('auth-username');
    if (usernameEl && usernameEl.textContent && usernameEl.textContent !== '---') {
      return usernameEl.textContent;
    }
    return 'You';
  }
}

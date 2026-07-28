import { get, post } from './http-client';
import { isAuthenticated } from './token-manager';
import type {
  ServiceResult,
  LeaderboardEntry,
  MyScoreEntry,
  SubmitScoreResponse,
  PendingScore,
} from './types';

const PENDING_SCORES_KEY = 'horde_pending_scores';
const MAX_RETRIES = 3;

const IS_DEV = import.meta.env.VITE_DEV_TOOLS === 'true';

/**
 * Get the global leaderboard (top players).
 * Public endpoint — no token required.
 */
export async function getGlobalLeaderboard(
  limit = 100,
): Promise<ServiceResult<{ leaderboard: LeaderboardEntry[] }>> {
  return get<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard/global?limit=${limit}`, false);
}

/**
 * Submit a score after a game session.
 * Protected endpoint — requires valid token.
 * If the request fails, the score is saved to localStorage for silent retry.
 */
export async function submitScore(
  round: number,
  score: number,
  enemiesKilled: number,
  sessionDuration: number,
): Promise<ServiceResult<SubmitScoreResponse>> {
  const result = await post<SubmitScoreResponse>('/leaderboard/scores', {
    round,
    score,
    enemiesKilled,
    sessionDuration,
  });

  if (!result.success) {
    savePendingScore({
      round,
      score,
      enemiesKilled,
      sessionDuration,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

/**
 * Get the friends leaderboard (only confirmed friends + self).
 * Protected endpoint — requires valid token.
 */
export async function getFriendsLeaderboard(): Promise<
  ServiceResult<{ leaderboard: LeaderboardEntry[] }>
> {
  return get<{ leaderboard: LeaderboardEntry[] }>('/leaderboard/friends');
}

/**
 * Get the authenticated user's personal best scores (highest first).
 * Protected endpoint — requires valid token.
 */
export async function getMyScores(limit = 10): Promise<ServiceResult<{ scores: MyScoreEntry[] }>> {
  return get<{ scores: MyScoreEntry[] }>(`/leaderboard/my-scores?limit=${limit}`);
}

// ─── Pending Scores Retry Logic ──────────────────────────────────────────────

/**
 * Save a failed score to localStorage for later retry.
 */
function savePendingScore(score: PendingScore): void {
  const pending = getPendingScores();
  pending.push(score);
  localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(pending));
}

/**
 * Get all pending scores from localStorage.
 */
function getPendingScores(): PendingScore[] {
  const raw = localStorage.getItem(PENDING_SCORES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Silently retry submitting any pending scores.
 * Called automatically after a successful login or when the game starts
 * with a valid session. The player never sees this happening.
 *
 * Each score gets up to MAX_RETRIES attempts. If all attempts fail,
 * the score is discarded to prevent infinite accumulation.
 */
export async function retryPendingScores(): Promise<void> {
  if (!isAuthenticated()) return;

  const pending = getPendingScores();
  if (pending.length === 0) return;

  const stillPending: PendingScore[] = [];

  for (const score of pending) {
    const result = await post<SubmitScoreResponse>('/leaderboard/scores', {
      round: score.round,
      score: score.score,
      enemiesKilled: score.enemiesKilled,
      sessionDuration: score.sessionDuration,
    });

    if (!result.success) {
      // Track retry count via a hidden property
      const retryCount = ((score as { _retries?: number })._retries || 0) + 1;
      if (retryCount < MAX_RETRIES) {
        stillPending.push({ ...score, _retries: retryCount } as PendingScore & {
          _retries: number;
        });
      } else if (IS_DEV) {
        console.error('[Leaderboard] Discarding score after max retries:', score);
      }
    }
  }

  if (stillPending.length > 0) {
    localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(stillPending));
  } else {
    localStorage.removeItem(PENDING_SCORES_KEY);
  }
}

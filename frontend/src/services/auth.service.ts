import { post } from './http-client';
import { saveTokens, clearTokens, isAuthenticated, getAccessToken } from './token-manager';
import type { ServiceResult, AuthTokens, RegisterResponse } from './types';
import { retryPendingScores } from './leaderboard.service';

/**
 * Register a new user account.
 * Public endpoint — no token required.
 */
export async function register(
  username: string,
  email: string,
  password: string,
): Promise<ServiceResult<RegisterResponse>> {
  return post<RegisterResponse>('/auth/register', { username, email, password }, false);
}

/**
 * Log in with username and password.
 * On success, stores tokens in localStorage and retries any pending scores.
 * Public endpoint — no token required.
 */
export async function login(
  username: string,
  password: string,
): Promise<ServiceResult<AuthTokens>> {
  const result = await post<AuthTokens>('/auth/login', { username, password }, false);

  if (result.success) {
    saveTokens(result.data.accessToken, result.data.idToken, result.data.refreshToken);

    // Silently retry any scores that failed to submit previously
    retryPendingScores();
  }

  return result;
}

/**
 * Log out the current user.
 * Invalidates all tokens server-side and clears localStorage.
 * Protected endpoint — requires valid token.
 */
export async function logout(): Promise<ServiceResult<{ message: string }>> {
  const result = await post<{ message: string }>('/auth/logout');

  // Clear tokens regardless of server response (even if server is down,
  // the local session should be ended)
  clearTokens();

  return result;
}

/**
 * Check if the user currently has a valid session.
 * Does not make a network call — only checks token expiration locally.
 */
export function hasActiveSession(): boolean {
  return isAuthenticated();
}

/**
 * Check if a token exists (may be expired).
 * Useful to decide whether to show login or attempt silent refresh.
 */
export function hasStoredSession(): boolean {
  return getAccessToken() !== null;
}

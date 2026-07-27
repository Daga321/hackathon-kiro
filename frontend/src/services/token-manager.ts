const STORAGE_KEYS = {
  ACCESS_TOKEN: 'horde_access_token',
  ID_TOKEN: 'horde_id_token',
  REFRESH_TOKEN: 'horde_refresh_token',
};

/**
 * Saves authentication tokens to localStorage.
 */
export function saveTokens(
  accessToken: string,
  idToken: string,
  refreshToken: string,
): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
}

/**
 * Returns the current access token, or null if not authenticated.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Returns the current refresh token, or null if not available.
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Decodes the ID token payload and extracts the user ID (Cognito sub).
 * Returns null if no token is stored or if decoding fails.
 */
export function getUserId(): string | null {
  const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  if (!idToken) return null;

  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Decodes the ID token and extracts the username.
 */
export function getUsername(): string | null {
  const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  if (!idToken) return null;

  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    return payload['cognito:username'] || payload.username || null;
  } catch {
    return null;
  }
}

/**
 * Checks if the user is currently authenticated.
 * Verifies that an access token exists and has not expired.
 */
export function isAuthenticated(): boolean {
  const accessToken = getAccessToken();
  if (!accessToken) return false;

  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const expiresAt = payload.exp * 1000; // Convert to ms
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

/**
 * Clears all stored tokens (used on logout).
 */
export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ID_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
}

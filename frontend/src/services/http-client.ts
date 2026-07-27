import { getAccessToken } from './token-manager';
import type { ServiceResult } from './types';

const BASE_URL = import.meta.env.VITE_API_URL || '';
const IS_DEV = import.meta.env.VITE_DEV_TOOLS === 'true';

/**
 * Maps HTTP error status codes to player-friendly messages.
 * The player should never see technical details like "500 Internal Server Error".
 */
function getErrorMessage(status: number, body: { error?: string } | null): string {
  switch (status) {
    case 400:
      return body?.error || 'Invalid request.';
    case 401:
      return 'Session expired. Please log in again.';
    case 403:
      return 'Access denied.';
    case 404:
      return 'Not found.';
    case 409:
      return body?.error || 'Conflict.';
    default:
      if (status >= 500) {
        return 'Something went wrong. Please try again later.';
      }
      return 'An unexpected error occurred.';
  }
}

/**
 * Internal fetch wrapper. Handles JSON serialization, token injection,
 * error mapping, and conditional debug logging.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<ServiceResult<T>> {
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authenticated) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = getErrorMessage(response.status, responseBody);

      if (IS_DEV) {
        console.error(`[HTTP] ${method} ${path} → ${response.status}`, responseBody);
      }

      return { success: false, error: errorMessage };
    }

    return { success: true, data: responseBody as T };
  } catch (error) {
    if (IS_DEV) {
      console.error(`[HTTP] ${method} ${path} → Network error`, error);
    }

    return { success: false, error: 'Could not connect to server. Check your connection.' };
  }
}

/**
 * GET request (authenticated by default).
 */
export function get<T>(path: string, authenticated = true): Promise<ServiceResult<T>> {
  return request<T>('GET', path, undefined, authenticated);
}

/**
 * POST request (authenticated by default).
 */
export function post<T>(
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<ServiceResult<T>> {
  return request<T>('POST', path, body, authenticated);
}

/**
 * DELETE request (authenticated by default).
 */
export function del<T>(path: string, authenticated = true): Promise<ServiceResult<T>> {
  return request<T>('DELETE', path, undefined, authenticated);
}

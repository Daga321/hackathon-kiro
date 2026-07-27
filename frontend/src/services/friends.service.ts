import { get, post, del } from './http-client';
import type { ServiceResult, FriendEntry } from './types';

/**
 * Get the list of confirmed friends for the authenticated user.
 * Protected endpoint — requires valid token.
 */
export async function listFriends(): Promise<ServiceResult<{ friends: FriendEntry[] }>> {
  return get<{ friends: FriendEntry[] }>('/friends');
}

/**
 * Send a friend request to another player.
 * Protected endpoint — requires valid token.
 */
export async function sendFriendRequest(
  friendId: string,
): Promise<ServiceResult<{ message: string }>> {
  return post<{ message: string }>('/friends/request', { friendId });
}

/**
 * Accept a pending friend request.
 * Protected endpoint — requires valid token.
 */
export async function acceptFriendRequest(
  friendId: string,
): Promise<ServiceResult<{ message: string }>> {
  return post<{ message: string }>('/friends/accept', { friendId });
}

/**
 * Reject a pending friend request.
 * Protected endpoint — requires valid token.
 */
export async function rejectFriendRequest(
  friendId: string,
): Promise<ServiceResult<{ message: string }>> {
  return post<{ message: string }>('/friends/reject', { friendId });
}

/**
 * Remove an existing friendship.
 * Protected endpoint — requires valid token.
 */
export async function removeFriend(friendId: string): Promise<ServiceResult<{ message: string }>> {
  return del<{ message: string }>(`/friends/${friendId}`);
}

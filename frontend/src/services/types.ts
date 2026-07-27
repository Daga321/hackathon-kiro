/**
 * Standard result type for all service calls.
 * Services never throw — they always return a ServiceResult.
 */
export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/** Tokens returned by the login endpoint */
export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** User registration response */
export interface RegisterResponse {
  message: string;
  userId: string;
}

/** Leaderboard entry */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  highestRound: number;
  totalScore: number;
}

/** Submit score response */
export interface SubmitScoreResponse {
  message: string;
  highestRound: number;
  totalScore: number;
}

/** Friend entry */
export interface FriendEntry {
  userId: string;
  friendId: string;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

/** Pending score saved in localStorage for retry */
export interface PendingScore {
  round: number;
  score: number;
  enemiesKilled: number;
  sessionDuration: number;
  timestamp: string;
}

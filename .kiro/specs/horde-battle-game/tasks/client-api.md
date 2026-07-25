# Tasks: Client API Layer

> **Related:** [Design](../design/backend-api.md)

---

- [ ] 8. Implement client-side API layer
  - [ ] 8.1 Implement `AuthApi`
    - Create `src/api/AuthApi.ts`
    - Method `register(username, email, password)`: `POST /auth/register`; return `{ accessToken, refreshToken }`
    - Method `login(email, password)`: `POST /auth/login`
    - Method `logout()`: `POST /auth/logout` with Bearer token
    - Method `refreshToken()`: attempt automatic renewal; if fails, clear localStorage and redirect to AuthScene
    - Save/read tokens from `localStorage`; include `Authorization: Bearer <token>` in protected requests
    - _Requirements: 9.4, 9.6, 9.9_
  - [ ] 8.2 Implement `LeaderboardApi`
    - Create `src/api/LeaderboardApi.ts`
    - Method `getGlobal()`: `GET /leaderboard/global`
    - Method `getFriends()`: `GET /leaderboard/friends` (authenticated)
    - Method `submitScore(data: ScoreSubmission)`: `POST /leaderboard/scores` (authenticated); return `{ success }` or throw typed error
    - _Requirements: 8.4, 10.1, 10.2, 10.5, 11.5_
  - [ ] 8.3 Implement `FriendsApi`
    - Create `src/api/FriendsApi.ts`
    - Method `getList()`: `GET /friends`
    - Method `sendRequest(targetUsername)`: `POST /friends/request`
    - Method `accept(requesterId)`: `POST /friends/accept`
    - Method `reject(requesterId)`: `POST /friends/reject`
    - Method `remove(friendId)`: `DELETE /friends/{friendId}`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7_

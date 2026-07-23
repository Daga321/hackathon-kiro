# Tasks: Backend — Leaderboard

> **Related:** [Requirements](../requirements/social-leaderboards.md) | [Design](../design/backend-api.md)

---

> ⚠️ **Note:** Task 11 (Backend Leaderboard) is referenced in the dependency graph but has not yet been fully detailed in the implementation plan. The following structure is reserved for when the task is expanded.

- [ ] 11. Implement LeaderboardLambda
  - [ ] 11.1 Implement `POST /leaderboard/scores` handler
    - Validate JWT via API Gateway Cognito authorizer
    - Validate body schema: `{ round, score, enemiesKilled, sessionDuration }`
    - Anti-cheat check: reject if `round > MAX_PLAUSIBLE_ROUND(sessionDuration)`
    - Write to `scores` table; update `users` table (highestRound, totalScore)
    - _Requirements: 8.4, 10.3, 10.6, 16.3_
  - [ ] 11.2 Implement `GET /leaderboard/global` handler
    - Query GSI `leaderboard-gsi` PK="GLOBAL", ScanIndexForward=false, LIMIT 100
    - If authenticated user not in top-100, append their entry
    - Return `{ entries: LeaderboardEntry[], userEntry?: LeaderboardEntry }`
    - _Requirements: 10.1, 10.2, 10.4, 10.5_
  - [ ] 11.3 Implement `GET /leaderboard/friends` handler
    - Query user's confirmed friends from `friends` table
    - Batch-get friend scores from `users` table
    - Sort by highestRound DESC, totalScore DESC
    - _Requirements: 11.5, 11.6_
  - [ ] 11.4 Write property tests for LeaderboardLambda
    - **Property 18: The leaderboard is sorted by (highestRound DESC, totalScore DESC)**
    - **Property 19: The global leaderboard returns at most 100 entries**
    - **Property 20: Each leaderboard entry contains the four required fields**
    - **Property 23: Anti-cheat rejects impossible rounds given the session duration**
    - _Requirements: 10.1, 10.2, 10.4, 11.5, 16.3_
  - [ ] 11.5 Implement rankKey generation
    - `rankKey = padStart(6,'0')(highestRound) + '#' + padStart(10,'0')(totalScore)`
    - Ensure consistent generation on score submit and user update
    - _Requirements: 10.1_
  - [ ] 11.6 Implement user entry highlight logic
    - If user not in top-100 results, query their individual entry and append
    - _Requirements: 10.5_
  - [ ] 11.7 Implement error handling
    - Log errors to CloudWatch; return HTTP 500 on failure
    - _Requirements: 10.3, 13.6_

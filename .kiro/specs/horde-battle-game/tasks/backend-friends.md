# Tasks: Backend — Friends

> **Related:** [Requirements](../requirements/social-leaderboards.md) | [Design](../design/backend-api.md)

---

> ⚠️ **Note:** Task 12 (Backend Friends) is referenced in the dependency graph but has not yet been fully detailed in the implementation plan. The following structure is reserved for when the task is expanded.

- [ ] 12. Implement FriendsLambda
  - [ ] 12.1 Implement `POST /friends/request` handler
    - Validate JWT; extract userId from token claims
    - Look up targetUsername in `users` table to get targetUserId
    - Write pending relationship to `friends` table: `{ PK: userId, SK: targetUserId, status: 'pending' }`
    - _Requirements: 11.1_
  - [ ] 12.2 Implement `POST /friends/accept` handler
    - Validate JWT; extract userId
    - Update both friendship directions to `status: 'confirmed'`
    - _Requirements: 11.2_
  - [ ] 12.3 Implement `POST /friends/reject` handler
    - Delete pending relationship from `friends` table
    - _Requirements: 11.3_
  - [ ] 12.4 Implement `GET /friends` handler
    - Query `friends` table PK=userId, filter status='confirmed'
    - Batch-get usernames and highestRound for each friend
    - _Requirements: 11.4_
  - [ ] 12.5 Implement `DELETE /friends/{friendId}` handler
    - Delete both directions of friendship relationship
    - Immediately exclude from both parties' friend leaderboards
    - _Requirements: 11.7_
  - [ ] 12.6 Write property test for friendship deletion
    - **Property 22: Deleting a friendship removes it from both lists immediately**
    - _Requirements: 11.7_

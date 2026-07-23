# Tasks: Integration Tests

> **Related:** [Design](../design/testing-strategy.md)

---

> ⚠️ **Note:** Task 15 (Integration Tests) is referenced in the dependency graph but has not yet been fully detailed in the implementation plan. The following structure is reserved for when the task is expanded.

- [ ] 15. Implement integration tests
  - [ ] 15.1 Setup integration test environment
    - Configure DynamoDB Local for test environment
    - Configure Supertest for Lambda endpoint testing
    - _Requirements: 13.3, 13.5_
  - [ ] 15.2 Test score submission flow
    - Submit score → verify it appears in DynamoDB `scores` table
    - Verify `users` table updated with new highestRound/totalScore
    - _Requirements: 8.4, 10.3_
  - [ ] 15.3 Test registration flow
    - Register user → verify Cognito user created + DynamoDB profile written
    - Verify retry logic on DynamoDB failure
    - _Requirements: 9.1, 9.2, 9.8_
  - [ ] 15.4 Test authentication flow
    - Login + token → verify access to protected endpoint
    - _Requirements: 9.4, 16.1_
  - [ ] 15.5 Test logout flow
    - Logout → verify token invalidated and subsequent requests rejected
    - _Requirements: 9.9_
  - [ ] 15.6 Test anti-cheat validation
    - Submit score with impossible round → verify rejection
    - _Requirements: 16.3_
  - [ ] 15.7 Test friendship lifecycle
    - Send request → accept → verify in friend list → delete → verify removed from both lists
    - _Requirements: 11.1, 11.2, 11.7_

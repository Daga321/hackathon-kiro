# Tasks: Backend — Authentication

> **Related:** [Requirements](../requirements/user-authentication.md) | [Design](../design/backend-api.md)

---

> ⚠️ **Note:** Task 10 (Backend Auth) is referenced in the dependency graph but has not yet been fully detailed in the implementation plan. The following structure is reserved for when the task is expanded.

- [ ] 10. Implement AuthLambda
  - [ ] 10.1 Implement `POST /auth/register` handler
    - Validate input schema: username (string, unique), email (regex), password (8–72 chars)
    - Call Cognito `signUp` with username, email, password
    - Write User_Profile to DynamoDB `users` table
    - Return `{ accessToken, refreshToken, expiresIn }`
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ] 10.2 Implement DynamoDB retry logic for registration
    - If DynamoDB write fails: return valid token, retry up to 3 times at 5-min intervals
    - If all retries fail: mark profile as `permanently_failed`
    - _Requirements: 9.8_
  - [ ] 10.3 Implement `POST /auth/login` handler
    - Call Cognito `initiateAuth` with email and password
    - Return `{ accessToken, refreshToken, expiresIn }`
    - On failure: generic error message (do not reveal email vs password)
    - _Requirements: 9.4, 9.5_
  - [ ] 10.4 Implement `POST /auth/logout` handler
    - Call Cognito `globalSignOut` with access token
    - Invalidate all user tokens server-side
    - _Requirements: 9.9_
  - [ ] 10.5 Write property tests for AuthLambda
    - **Property 16: Password validation accepts exactly lengths between 8 and 72 characters**
    - **Property 17: Registration retry logic respects the 3-attempt limit**
    - **Property 21: Protected endpoints reject any invalid token with HTTP 401**
    - _Requirements: 9.1, 9.3, 9.8, 16.1_

# Requirements: User Authentication

> **Related:** [Design](../design/backend-api.md) | [Tasks](../tasks/backend-auth.md)

---

### Requirement 9: User Registration and Login

**User Story:** As a player, I want to create an account and log in, so that my scores are saved and I can compete on the leaderboards.

#### Acceptance Criteria

1. THE Auth_Service SHALL allow a User to register with a unique username, an email address in the format local-part@domain.tld, and a password between 8 and 72 characters inclusive.
2. WHEN a User submits valid registration credentials, THE Auth_Service SHALL create a User_Profile in DynamoDB and return a session token within 3 seconds.
3. WHEN a User submits invalid registration credentials (duplicate username, invalid email format, or password outside the 8–72 character range), THE Auth_Service SHALL return a descriptive error message identifying the specific field that failed validation.
4. WHEN a User submits their registered email and password to authenticate, THE Auth_Service SHALL return a session token within 3 seconds.
5. WHEN a User provides incorrect authentication credentials, THE Auth_Service SHALL return an error message without specifying whether the email or the password was incorrect.
6. THE Auth_Service SHALL invalidate a session token when 24 hours have elapsed since the last authenticated request made using that token.
7. THE Game SHALL allow unauthenticated Users to play without an account, without their scores being persisted in any leaderboard.
8. IF the User_Profile write to DynamoDB fails after a successful Cognito registration, THEN THE Auth_Service SHALL return a valid session token and retry the DynamoDB write up to 3 times at 5-minute intervals; IF all retries fail, THE Auth_Service SHALL mark the profile as permanently failed and return HTTP 500 on subsequent requests that require profile data.
9. WHEN a User logs out, THE Auth_Service SHALL immediately invalidate the session token on the server, preventing its further use.

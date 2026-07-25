# Requirements: Infrastructure & Security

> **Related:** [Design](../design/infrastructure.md) | [Tasks](../tasks/infrastructure.md) | [Tasks](../tasks/security.md)

---

### Requirement 13: AWS Infrastructure and Deployment

**User Story:** As a developer, I want the game deployed on AWS with a scalable architecture, so that it can handle variable player load reliably and at low cost.

#### Acceptance Criteria

1. THE CDN SHALL serve all frontend static assets (HTML, JavaScript, CSS, and Assets) from an S3 bucket through CloudFront with a cache TTL of at least 86400 seconds for versioned assets.
2. THE API_Gateway SHALL expose all backend endpoints exclusively over HTTPS, rejecting HTTP requests with a 301 redirect.
3. THE Lambda SHALL process each API request at a p99 latency of 2000 milliseconds under normal load.
4. THE Auth_Service SHALL use Amazon Cognito User Pools as the identity provider and return JWT tokens compliant with the OAuth 2.0 standard.
5. THE Leaderboard_Service and THE Friends_Service SHALL store all persistent data in DynamoDB tables with on-demand capacity mode.
6. WHEN a Lambda function encounters an unhandled exception, THE Lambda SHALL log the full stack trace to Amazon CloudWatch Logs.
7. THE API_Gateway SHALL enforce CORS, accepting requests only from the registered CloudFront distribution domain.

---

### Requirement 16: Backend Security and Validation

**User Story:** As a system operator, I want the backend to validate all inputs and protect player data, so that the game is resistant to abuse and unauthorized access.

#### Acceptance Criteria

1. THE API_Gateway SHALL reject any request that lacks a valid JWT session token on protected endpoints, returning HTTP 401.
2. THE Lambda SHALL validate all input parameters against a defined schema before processing them, returning HTTP 400 with a descriptive error for invalid inputs.
3. THE Leaderboard_Service SHALL reject score submissions where the submitted Round number exceeds a server-calculated maximum plausible value based on session duration.
4. THE Auth_Service SHALL rate-limit login attempts to a maximum of 10 attempts per minute per IP address, returning HTTP 429 when the limit is exceeded.
5. THE Auth_Service SHALL store all passwords using a cryptographic hash function (bcrypt or Argon2) and SHALL NOT store passwords in plaintext.

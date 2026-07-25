# Tasks: Infrastructure (CDK)

> **Related:** [Requirements](../requirements/infrastructure-security.md) | [Design](../design/infrastructure.md)

---

> ⚠️ **Note:** Task 9 (Infrastructure CDK) is referenced in the dependency graph but has not yet been fully detailed in the implementation plan. The following structure is reserved for when the task is expanded.

- [ ] 9. Implement AWS CDK infrastructure
  - [ ] 9.1 Create CDK project structure
    - Initialize `infra/` directory with CDK TypeScript app
    - Create stack files: `StaticHostingStack`, `ApiStack`, `DatabaseStack`, `AuthStack`
    - _Requirements: 13.1, 13.2, 13.5_
  - [ ] 9.2 Implement `DatabaseStack`
    - DynamoDB tables: `users`, `scores`, `friends` with on-demand billing
    - GSI `leaderboard-gsi` on `users` table with PK=`leaderboardPartition`, SK=`rankKey`
    - _Requirements: 13.5_
  - [ ] 9.3 Implement `StaticHostingStack`
    - S3 bucket for frontend assets + CloudFront distribution
    - Cache TTL ≥ 86400s for versioned assets
    - CORS configuration for API domain
    - _Requirements: 13.1, 13.7_
  - [ ] 9.4 Implement `AuthStack`
    - Cognito User Pool with password policy (8–72 chars)
    - App client configuration for JWT tokens
    - _Requirements: 13.4_
  - [ ] 9.5 Implement `ApiStack`
    - API Gateway REST API with HTTPS-only
    - Lambda functions: AuthLambda, LeaderboardLambda, FriendsLambda
    - Cognito authorizer on protected routes
    - WAF rate-limiting rule on `/auth/login`
    - _Requirements: 13.2, 13.3, 13.6, 13.7_
  - [ ] 9.6 CDK snapshot tests
    - Verify DynamoDB table properties (BillingMode: PAY_PER_REQUEST)
    - Verify CloudFront distribution configuration
    - Verify Lambda function configurations
    - _Requirements: 13.1–13.7_
  - [ ] 9.7 Deploy to development environment
    - `cdk deploy --all` to dev account
    - Verify endpoints respond with expected status codes
    - _Requirements: 13.1–13.7_

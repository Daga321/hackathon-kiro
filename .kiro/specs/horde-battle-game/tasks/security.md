# Tasks: Security

> **Related:** [Requirements](../requirements/infrastructure-security.md) | [Design](../design/error-handling.md)

---

> ⚠️ **Note:** Task 13 (Security) is referenced in the dependency graph but has not yet been fully detailed in the implementation plan. The following structure is reserved for when the task is expanded.

- [ ] 13. Implement security measures
  - [ ] 13.1 Implement JWT validation middleware
    - Validate JWT signature, expiration, and audience on all protected endpoints
    - Return HTTP 401 for absent, expired, or malformed tokens
    - _Requirements: 16.1_
  - [ ] 13.2 Implement input schema validation
    - Validate all Lambda input parameters against defined schemas
    - Return HTTP 400 with descriptive field-level errors for invalid inputs
    - _Requirements: 16.2_
  - [ ] 13.3 Implement rate limiting
    - WAF rule: 10 login attempts per minute per IP on `/auth/login`
    - Return HTTP 429 when limit exceeded
    - _Requirements: 16.4_

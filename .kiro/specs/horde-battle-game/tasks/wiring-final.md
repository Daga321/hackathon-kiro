# Tasks: Final Wiring & Checkpoints

> **Related:** All design documents

---

> ⚠️ **Note:** Tasks 18-19 (Final Wiring & Checkpoints) are referenced in the dependency graph but have not yet been fully detailed in the implementation plan. The following structure is reserved for when the tasks are expanded.

- [ ] 18. Final wiring and end-to-end validation
  - [ ] 18.1 Wire client API to deployed backend
    - Configure API base URL from environment variables
    - Test full auth flow: register → login → play → submit score → leaderboard
    - _Requirements: 9.1–9.9, 10.1–10.6_
  - [ ] 18.2 Wire leaderboard scene to live data
    - Verify global leaderboard fetches and renders correctly
    - Verify friends leaderboard shows only confirmed friends
    - _Requirements: 10.4, 10.5, 11.5, 11.6_
  - [ ] 18.3 Performance validation
    - Verify 60 fps on desktop with 30 enemies
    - Verify 30 fps on mobile with 20 enemies
    - Verify initial load < 5 seconds on 10 Mbps
    - _Requirements: 14.1, 14.2, 14.3_
  - [ ] 18.4 Cross-browser testing
    - Test on Chrome 120+, Firefox 120+, Safari 17+
    - Test on Chrome for Android 120+, Safari for iOS 17+
    - _Requirements: 14.1, 14.2_

- [ ] 19. Final checkpoint — Full system validation
  - Ensure all property tests P1–P24 pass.
  - Ensure all integration tests pass.
  - Ensure CDK snapshot tests pass.
  - Verify deployed system handles: registration, login, gameplay, score submission, leaderboard, friends.
  - Run performance benchmarks and confirm requirements met.
  - Review security: JWT validation, rate limiting, anti-cheat, CORS, HTTPS-only.

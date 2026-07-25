# Design: Error Handling

> **Related:** [Requirements](../requirements/infrastructure-security.md) | [Tasks](../tasks/security.md)

---

## Client Errors (Phaser)

| Situation | Behavior |
|---|---|
| Asset not found | Log to console + placeholder sprite (Req 15.2) |
| Network failure on score submit | Display error message + retain "Submit Score" button (Req 8.6) |
| Non-network error on score submit | Hide button + generic message, silent log (Req 8.7) |
| Browser without WebGL | Message + link to compatible browser (Req 14.5) |
| Token expired during request | Attempt automatic refresh with refreshToken; if fails → redirect to AuthScene |
| Device orientation changes | Pause → recalculate layout → resume in ≤200 ms (Req 12.6) |

---

## Backend Errors (Lambda)

| Situation | HTTP | Behavior |
|---|---|---|
| JWT absent or invalid | 401 | Reject without processing; do not reveal details |
| Invalid body schema | 400 | Descriptive message with failed field (Req 16.2) |
| Incorrect login credentials | 401 | Generic message; do not specify email vs. password (Req 9.5) |
| Rate limit exceeded on login | 429 | Req 16.4 |
| Unhandled exception in Lambda | 500 | Log full stack trace to CloudWatch (Req 13.6) |
| DynamoDB unreachable during registration | 500 → retries | 3 retries at 5 min (Req 9.8) |
| Score submit with impossible round | 400 | Anti-cheat (Req 16.3) |
| Leaderboard update fails | 500 | Log error, return 500 (Req 10.3) |

---

## Game State Invariants

- `player.hp ∈ [0, 100]` at all times
- `enemy.hp > 0` while the Enemy is active in the Arena (destroyed when it reaches 0)
- `projectile.traveled ≤ 400` at all times (destroyed if exceeded)
- No GameObject outside the Arena bounds

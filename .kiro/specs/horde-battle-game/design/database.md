# Design: Database

> **Related:** [Requirements](../requirements/infrastructure-security.md) | [Tasks](../tasks/infrastructure.md)

---

## DynamoDB Tables

### Table: `users`

```
PK: userId (string — Cognito sub)
SK: "profile"

Attributes:
  username:      string   (unique, GSI index)
  email:         string
  highestRound:  number   (default 0)
  totalScore:    number   (default 0)
  createdAt:     string   (ISO 8601)
  profileStatus: string   ("active" | "failed")  ← Req 9.8
```

### Table: `scores`

```
PK: userId (string)
SK: timestamp (string — ISO 8601, ms precision)

Attributes:
  round:         number
  score:         number
  enemiesKilled: number
  sessionDuration: number  (seconds — for anti-cheat Req 16.3)
```

### Table: `friends`

```
PK: userId (string)
SK: friendId (string)

Attributes:
  status:    string   ("pending" | "confirmed")
  createdAt: string   (ISO 8601)

Note: Confirmed relationship is stored in both directions:
  { PK: A, SK: B, status: "confirmed" }
  { PK: B, SK: A, status: "confirmed" }
To delete a friendship, both items are removed (Req 11.7).
```

---

## GSI: `leaderboard-gsi` (on `users` table)

```
PK:   highestRound (number)  ← logically inverted: uses negative score or sort in Lambda
SK:   totalScore   (number)

Projection: ALL

Query pattern: Scan/Query top-100 by highestRound DESC, totalScore DESC
Implementation: DynamoDB does not natively support ORDER BY DESC on numeric GSI;
a composite field `rankKey = ZFILL(maxRound, 6) + ZFILL(score, 10)` is used as the GSI SK.
```

---

## rankKey — Composite Key for Descending Sort

```typescript
// rankKey = `${String(highestRound).padStart(6,'0')}#${String(totalScore).padStart(10,'0')}`
// Query: begins_with(rankKey, ...) does not apply; Scan with Limit=100 + in-memory sort is used
// More efficient alternative: fixed PK "GLOBAL", SK = rankKey → allows ordered Query
```

**Final GSI design:**

```
GSI: leaderboard-gsi
  PK: leaderboardPartition = "GLOBAL"  (string, fixed value)
  SK: rankKey = padded(highestRound) + "#" + padded(totalScore)

  → Query PK="GLOBAL" ScanIndexForward=false LIMIT 100
  → O(1) in DynamoDB, no full Scan
```

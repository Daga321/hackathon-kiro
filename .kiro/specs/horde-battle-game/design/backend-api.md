# Design: Backend API

> **Related:** [Requirements](../requirements/user-authentication.md) | [Requirements](../requirements/social-leaderboards.md) | [Tasks](../tasks/backend-auth.md)

---

## REST Endpoints

All endpoints over HTTPS. Those marked with 🔒 require a JWT Bearer token in the `Authorization` header.

| Method | Route | Lambda | Req |
|---|---|---|---|
| POST | `/auth/register` | AuthLambda | 9.1–9.3, 9.8 |
| POST | `/auth/login` | AuthLambda | 9.4–9.5 |
| POST | `/auth/logout` | AuthLambda 🔒 | 9.9 |
| GET | `/leaderboard/global` | LeaderboardLambda | 10.1–10.5 |
| POST | `/leaderboard/scores` | LeaderboardLambda 🔒 | 8.4, 10.3, 10.6 |
| GET | `/leaderboard/friends` | LeaderboardLambda 🔒 | 11.5–11.6 |
| GET | `/friends` | FriendsLambda 🔒 | 11.4 |
| POST | `/friends/request` | FriendsLambda 🔒 | 11.1 |
| POST | `/friends/accept` | FriendsLambda 🔒 | 11.2 |
| POST | `/friends/reject` | FriendsLambda 🔒 | 11.3 |
| DELETE | `/friends/{friendId}` | FriendsLambda 🔒 | 11.7 |

---

## AuthLambda

```typescript
// Delegates to Amazon Cognito User Pools
// POST /auth/register
//   → cognitoClient.signUp(username, email, password)
//   → dynamodb.put({ PK: userId, SK: 'profile', username, email, createdAt })
//   → retry up to 3 times if DynamoDB fails (Req 9.8)
//   → returns { accessToken, refreshToken, expiresIn }

// POST /auth/login
//   → cognitoClient.initiateAuth(email, password)
//   → returns { accessToken, refreshToken, expiresIn }

// POST /auth/logout
//   → cognitoClient.globalSignOut(accessToken)
//   → returns { success: true }
```

---

## LeaderboardLambda

```typescript
// POST /leaderboard/scores
//   1. Validates JWT (API Gateway Authorizer → Cognito)
//   2. Validates schema: { round: number, score: number, enemiesKilled: number, sessionDuration: number }
//   3. Verifies anti-cheat: round ≤ MAX_PLAUSIBLE_ROUND(sessionDuration) (Req 16.3)
//   4. dynamodb.put scores table
//   5. dynamodb.update users table (highestRound, totalScore if improvement)
//   → returns { success: true } or HTTP 400/401/500

// GET /leaderboard/global
//   → Query GSI 'leaderboard-gsi' ordered by highestRound DESC, score DESC, LIMIT 100
//   → If authenticated userId does not appear in top-100, append their entry at the end
//   → returns { entries: LeaderboardEntry[], userEntry?: LeaderboardEntry }
```

---

## FriendsLambda

```typescript
// POST /friends/request  { targetUsername: string }
//   → Looks up userId from targetUsername in users table
//   → dynamodb.put friends table { PK: userId, SK: friendId, status: 'pending' }

// POST /friends/accept   { requesterId: string }
//   → dynamodb.update friends { status: 'confirmed' } (both directions)

// GET /friends
//   → Query friends table PK=userId, filter status='confirmed'
//   → Batch-get usernames and highestRound for each friendId
```

---

## Security Model

```
API Gateway → Cognito JWT Authorizer → Lambda

- Cognito Authorizer: validates JWT signature, expiration, audience
- Lambda: validates body schema (Req 16.2), anti-cheat logic (Req 16.3)
- Rate-limiting on /auth/login: WAF rule 10 req/min per IP (Req 16.4)
- CORS: CloudFront distribution origin only (Req 13.7)
```

---

## Authentication Flow with Cognito

```
Client                    API Gateway          Cognito            DynamoDB
  │                             │                   │                  │
  │── POST /auth/register ─────►│                   │                  │
  │   {username,email,password} │                   │                  │
  │                             │── signUp ─────────►│                  │
  │                             │◄── userSub ────────│                  │
  │                             │                   │                  │
  │                             │── put(profile) ───────────────────────►│
  │                             │◄── ok ────────────────────────────────│
  │◄── {accessToken,            │                   │                  │
  │     refreshToken} ─────────│                   │                  │
  │                             │                   │                  │
  │── POST /auth/login ─────────►│                   │                  │
  │   {email, password}         │── initiateAuth ───►│                  │
  │                             │◄── tokens ─────────│                  │
  │◄── {accessToken} ──────────│                   │                  │
  │                             │                   │                  │
  │── GET /leaderboard/global ──►│                   │                  │
  │   Authorization: Bearer JWT │── validateJWT ────►│                  │
  │                             │◄── claims ─────────│                  │
  │                             │── Query GSI ──────────────────────────►│
  │                             │◄── entries ───────────────────────────│
  │◄── {entries} ──────────────│                   │                  │
```

**Token lifecycle:**
- `accessToken`: valid for 1 hour (configurable in Cognito)
- `refreshToken`: valid for 30 days; the client refreshes automatically
- Logout → `GlobalSignOut` invalidates all user tokens (Req 9.9)
- Session "24 hours since last request" (Req 9.6): implemented by configuring `accessToken` TTL in Cognito + automatic refresh on each authenticated request

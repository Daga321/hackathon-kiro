# Architecture

> Technical design of the system: how services connect, why each technology was chosen, and how data flows.

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  Phaser 3 Game (TypeScript)                                         │
│  ┌─────────────┐  ┌──────────────────────┐                         │
│  │ Game Engine  │  │ Services Layer        │                         │
│  │ (Scenes, AI, │  │ (http-client,         │                         │
│  │  Entities)   │  │  token-manager,       │                         │
│  │             │  │  auth, leaderboard,   │                         │
│  │             │  │  friends)             │                         │
│  └─────────────┘  └──────────┬───────────┘                         │
│                               │ fetch()                              │
└───────────────────────────────┼──────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    CloudFront CDN      │
                    │  (S3 Origin + OAC)     │
                    └───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   API Gateway (REST)   │
                    │   /v1/*               │
                    │   CORS enabled         │
                    │   Cognito Authorizer   │
                    └───────┬───────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
    ┌─────────▼──┐  ┌──────▼─────┐  ┌───▼──────────┐
    │ Auth        │  │ Leaderboard│  │ Friends      │
    │ Lambdas     │  │ Lambdas    │  │ Lambdas      │
    │ (register,  │  │ (global,   │  │ (list,       │
    │  login,     │  │  submit,   │  │  request,    │
    │  logout)    │  │  friends)  │  │  accept,     │
    └──────┬──────┘  └─────┬──────┘  │  reject,     │
           │               │         │  remove)     │
           │               │         └──────┬───────┘
           ▼               ▼                ▼
    ┌─────────────┐  ┌──────────┐   ┌──────────┐
    │  Cognito    │  │ DynamoDB │   │ DynamoDB │
    │  User Pool  │  │  users   │   │  friends │
    │             │  │  scores  │   │          │
    └─────────────┘  └──────────┘   └──────────┘
```

---

## 2. Frontend

### Hosting: S3 + CloudFront

| Component | Configuration |
|-----------|---------------|
| S3 Bucket | Block all public access, OAC only |
| CloudFront | HTTPS redirect, CACHING_OPTIMIZED |
| Error handling | 403/404 → `/index.html` (SPA behavior) |
| Cache | Hashed assets: immutable. index.html: 60s |

The frontend is a static Phaser 3 game built with Vite. It produces:
- `index.html` — entry point
- `assets/` — hashed JS bundles, sprites, audio

### Services Layer (`frontend/src/services/`)

A thin abstraction over `fetch()` that provides:
- **Token injection:** automatically adds `Authorization: Bearer <token>` to protected requests
- **Error mapping:** HTTP status codes → player-friendly messages (never exposes 5xx details)
- **No exceptions:** all functions return `ServiceResult<T>` — the game never crashes from a network error
- **Conditional logging:** errors only log to console when `VITE_DEV_TOOLS=true`

### Token Management

JWT tokens from Cognito are stored in `localStorage`:
- `accessToken` — sent in every authenticated request
- `idToken` — decoded client-side for username/userId
- `refreshToken` — for future silent renewal

On page load, `AuthUI` checks if a valid token exists and auto-restores the session. The player doesn't need to re-login unless the token expires (Cognito default: 1 hour for access, 30 days for refresh).

---

## 3. Backend

### API Gateway

- **Type:** REST API (regional)
- **Stage:** `/v1`
- **CORS:** All origins, all methods (game can be hosted on any domain)
- **Authorization:** Cognito User Pools Authorizer on protected routes
- **Custom domain:** Ready via `CustomDomain` construct (not active yet)

### Lambda Functions

All Lambdas share:
- Runtime: Node.js 22.x
- Timeout: 10s
- Memory: 128MB
- Bundled with esbuild via CDK `NodejsFunction`
- Environment variables injected by CDK (table names, client IDs)

| Lambda | Route | Auth | DynamoDB Access |
|--------|-------|:----:|-----------------|
| register | POST /auth/register | - | users: write |
| login | POST /auth/login | - | - (Cognito only) |
| logout | POST /auth/logout | JWT | - (Cognito only) |
| list friends | GET /friends | JWT | friends: read |
| request friend | POST /friends/request | JWT | friends: read/write, users: read |
| accept friend | POST /friends/accept | JWT | friends: read/write |
| reject friend | POST /friends/reject | JWT | friends: read/write |
| remove friend | DELETE /friends/{id} | JWT | friends: read/write |
| global leaderboard | GET /leaderboard/global | - | users: read (GSI) |
| submit score | POST /leaderboard/scores | JWT | users: read/write, scores: write |
| friends leaderboard | GET /leaderboard/friends | JWT | users: read, friends: read |
| health | GET /health | - | - |

---

## 4. Database (DynamoDB)

### Tables

| Table | PK | SK | Billing | Purpose |
|-------|----|----|---------|---------|
| `users` | userId | — | On-demand | Player profiles + stats |
| `scores` | userId | timestamp | On-demand | Game session history |
| `friends` | userId | friendId | On-demand | Bidirectional relationships |

### Global Secondary Index

**`leaderboard-gsi`** on `users` table:
- PK: `leaderboardPartition` (always `"GLOBAL"`)
- SK: `rankKey` (zero-padded: `"000034#0000012450"` → round 34, score 12450)
- Projection: ALL

Query pattern:
```
PK = "GLOBAL", ScanIndexForward = false, Limit = 100
→ Top 100 players sorted by highest round, then total score
```

This avoids table scans entirely — O(1) read cost regardless of table size.

### Friends Data Model

Bidirectional: when A sends a request to B, two items are created:
```
{ userId: A, friendId: B, status: "pending" }
{ userId: B, friendId: A, status: "pending" }
```

On accept, both are updated to `"confirmed"`. On reject/remove, both are deleted.

Query patterns:
- `GET /friends?status=confirmed` → confirmed friends list
- `GET /friends?status=pending` → incoming friend requests
- `GET /friends?status=all` → all relationships

---

## 5. Authentication and Security

### Cognito User Pool

| Setting | Value |
|---------|-------|
| Sign-in | Email or username |
| Password | 8+ chars, upper/lower/digits required |
| Verification | Email auto-verify |
| Social login | Disabled (not needed for a game) |
| Account recovery | Email only |

### Auth Flow

```
Player → POST /auth/login (username, password)
  → Lambda → Cognito InitiateAuth (USER_PASSWORD_AUTH)
  → Returns: accessToken, idToken, refreshToken
  → Frontend stores in localStorage
  → Subsequent requests: Authorization: Bearer <accessToken>
  → API Gateway: Cognito Authorizer validates token
  → Lambda receives userId from event.requestContext.authorizer.claims.sub
```

### Security Measures

- S3 bucket: block all public access, only CloudFront via OAC can read
- API Gateway: HTTPS only (no HTTP)
- Lambda permissions: least privilege (each Lambda only gets access to the tables it needs)
- Cognito: `preventUserExistenceErrors` enabled (login errors don't reveal if user exists)
- Frontend: error messages never expose server internals to the player

---

## 6. Infrastructure as Code (CDK)

### Stack Separation

| Stack | Resources | Independent? |
|-------|-----------|:---:|
| `StaticSiteStack` | S3 + CloudFront + OAC | Yes |
| `AuthStack` | Cognito User Pool + App Client | Yes |
| `DatabaseStack` | 3 DynamoDB tables + GSI | Yes |
| `ApiStack` | API Gateway + Lambdas + Authorizer | Depends on Auth + Database |

### Why Separate Stacks?

- Deploy a single service without touching others
- Isolated blast radius — a bad deploy to ApiStack doesn't affect the frontend
- Faster deployments — only changed stacks are updated
- Clear ownership — each stack has a single responsibility

### CustomDomain Construct

The only shared construct — reusable by both CloudFront and API Gateway:
- Creates ACM certificate (cross-region for CloudFront, regional for API GW)
- Resolves Route53 hosted zone
- Configures DNS validation

Currently not active — ready to enable by uncommenting props in `app.ts` and adding domain env vars.

---

## 7. Deployment Architecture

```
GitHub Repository
    │
    ├── Push to develop ─────────────────────────┐
    │                                            │
    ├── Push to main ────────────────────────────┤
    │                                            ▼
    │                                   ┌─────────────────┐
    │                                   │ GitHub Actions   │
    │                                   │                 │
    │                                   │ 1. Path filter  │
    │                                   │ 2. cdk diff     │
    │                                   │ 3. cdk deploy   │
    │                                   │    OR           │
    │                                   │ 1. Path filter  │
    │                                   │ 2. pnpm build   │
    │                                   │ 3. s3 sync      │
    │                                   │ 4. CF invalidate│
    │                                   └────────┬────────┘
    │                                            │
    │                                            ▼
    │                                   ┌─────────────────┐
    │                                   │ AWS Account      │
    │                                   │                 │
    │                                   │ StaticSite-dev  │
    │                                   │ StaticSite-prod │
    │                                   │ Auth-dev/prod   │
    │                                   │ Database-dev/prod│
    │                                   │ Api-dev/prod    │
    │                                   └─────────────────┘
```

Both environments live in the same AWS account, differentiated by the stack name suffix (`-dev`, `-prod`). This simplifies credential management while maintaining environment isolation at the resource level.

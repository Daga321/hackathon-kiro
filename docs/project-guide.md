# Project Guide

> Quick reference for developers joining or returning to the project.
> Read this first to understand what this is, how it's structured, and how to start working.

---

## What is this?

**Horde Battle: Graveyard Guard** is a browser-based survival game built with Phaser 3 (TypeScript), backed by a fully serverless AWS infrastructure. Players fight waves of enemies, compete on global leaderboards, and manage friend relationships — all deployed and maintained through Infrastructure as Code.

---

## Monorepo Structure

```
hackathon-kiro/
├── frontend/                → Phaser game (Vite + TypeScript)
│   ├── src/game/            → Scenes, entities, AI, UI, audio
│   ├── src/services/        → API consumption layer (auth, leaderboard, friends)
│   └── public/              → Static assets (sprites, tilesets, audio)
├── backend/
│   ├── cdk/                 → AWS CDK infrastructure (TypeScript)
│   │   ├── bin/app.ts       → Entry point — instantiates all stacks
│   │   └── lib/stacks/      → StaticSite, Auth, Database, API stacks
│   └── lambdas/             → API endpoint handlers
│       ├── auth/            → register, login, logout
│       ├── friends/         → list, request, accept, reject, remove
│       ├── leaderboard/     → get-global, submit-score, get-friends
│       ├── health/          → Health check endpoint
│       └── shared/          → Response helper, shared utilities
├── .github/workflows/       → CI/CD pipelines
├── .kiro/                   → Specs, steering files, hooks (AI context)
├── docs/                    → This documentation
├── .env.example             → Environment variables template
└── package.json             → Root monorepo config (pnpm workspaces)
```

---

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9 (defined in `packageManager` field)
- **AWS CLI** configured with credentials (for CDK deployments)
- **AWS CDK CLI** (`npm install -g aws-cdk`)

---

## Local Development Setup

```bash
# 1. Clone the repo
git clone https://github.com/Daga321/hackathon-kiro.git
cd hackathon-kiro

# 2. Install all dependencies (monorepo-wide)
pnpm install

# 3. Create your .env file from the template
cp .env.example .env
# Fill in: ENVIRONMENT=dev, VITE_API_URL=<your API Gateway URL>, AWS credentials

# 4. Run the frontend locally
pnpm dev
# Opens at http://localhost:5173
```

---

## How to Deploy

### First time (bootstrap CDK):
```bash
pnpm cdk:bootstrap
```

### Deploy infrastructure:
```bash
pnpm cdk:deploy
# Or via GitHub Actions: push to develop/main triggers deploy-infra.yml
```

### Deploy frontend:
Push to `develop` or `main` — the `deploy-frontend.yml` workflow handles:
1. `pnpm build` in frontend/
2. `aws s3 sync` to the bucket
3. CloudFront cache invalidation

### Verify deployment:
- CloudFront URL → game loads
- `GET <API_URL>/v1/health` → `{ "status": "ok" }`

---

## Feature Map

| Feature | Status | Key Files |
|---------|:------:|-----------|
| Wave survival gameplay | ✅ | `GameScene.ts`, `WaveManager.ts`, `EnemySpawner.ts` |
| Pathfinding AI | ✅ | `Pathfinder.ts`, `Enemy.ts` |
| Tilemap generation | ✅ | `MapGenerator.ts` |
| Health pickups | ✅ | `HealthPickup.ts`, `HealthPickupManager.ts` |
| Touch controls (mobile) | ✅ | `TouchControls.ts` |
| Auth (register/login/logout) | ✅ | `AuthUI.ts` → `auth.service.ts` → Lambda |
| Global leaderboard | ✅ | `PauseMenu.ts` → `leaderboard.service.ts` → Lambda + GSI |
| Score submission + retry | ✅ | `GameOverScreen.ts` → `leaderboard.service.ts` |
| Friends management | ✅ | `FriendsPanel.ts` → `friends.service.ts` → Lambda |
| Session persistence | ✅ | `token-manager.ts` (localStorage) |
| CI quality gates | ✅ | `prettier-check.yml`, `eslint-check.yml`, `frontend-build-check.yml` |
| Automated deployment | ✅ | `deploy-infra.yml`, `deploy-frontend.yml` |

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|:----:|-------------|
| GET | `/health` | - | Health check |
| POST | `/auth/register` | - | Create account (Cognito + DynamoDB profile) |
| POST | `/auth/login` | - | Authenticate, returns JWT tokens |
| POST | `/auth/logout` | JWT | Invalidate all tokens |
| GET | `/friends?status=confirmed\|pending\|all` | JWT | List friend relationships |
| POST | `/friends/request` | JWT | Send friend request |
| POST | `/friends/accept` | JWT | Accept pending request |
| POST | `/friends/reject` | JWT | Reject pending request |
| DELETE | `/friends/{friendId}` | JWT | Remove friendship |
| GET | `/leaderboard/global?limit=N` | - | Top N players (default 100) |
| POST | `/leaderboard/scores` | JWT | Submit game score |
| GET | `/leaderboard/friends` | JWT | Friends-only leaderboard |

---

## Key Technical Decisions

| Decision | Why |
|----------|-----|
| DynamoDB over SQL | On-demand billing, serverless-native, no connection pooling needed |
| Fetch native over Axios | Zero dependencies, smaller bundle, sufficient for our use case |
| localStorage over cookies | No custom domain yet, Phaser canvas has low XSS risk |
| Separate CDK stacks | Independent deployment, isolated blast radius |
| No construct-per-stack | Avoids useless indirection when logic isn't shared |
| CustomDomain as construct | Only reusable piece (used by both CloudFront and API Gateway) |
| ServiceResult pattern | No exceptions thrown — game never crashes from network errors |
| Prettier + ESLint per project | Backend allows console.log (CloudWatch), frontend warns on it |

---

## Environment Variables

```env
# AWS (for CDK deployments)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=
AWS_ACCOUNT_ID=
ENVIRONMENT=dev|prod

# Frontend (exposed to browser via Vite)
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/v1
VITE_DEV_TOOLS=true|false
```

---

## Useful Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start frontend dev server |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run ESLint recursively |
| `pnpm format` | Run Prettier recursively |
| `pnpm cdk:diff` | Show pending infra changes |
| `pnpm cdk:deploy` | Deploy all CDK stacks |
| `pnpm cdk:synth` | Generate CloudFormation templates |

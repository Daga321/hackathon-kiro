---
inclusion: auto
---

# Project Overview: Horde Battle Game

## Project Description

**Horde Battle Game** is a top-down action game for browsers set in a **nighttime cemetery**. The player embodies a **cemetery guard** who must defend his territory from waves of **undead** (zombies and skeletons) using first his melee weapon (staff/shovel). Inspired by Boxhead and Brotato.

**Key domain characteristics:**
- The character is a cemetery guard with melee-only attack in the MVP
- Enemies are Undead: zombies, skeletons, and post-MVP variants
- The arena is a cemetery with tombstones, fences, and gates in pixel art
- Ranged attack (projectiles) is a post-MVP feature

The game runs in desktop and mobile web browsers without installation or plugins. It features an AWS backend for user authentication, global rankings, friend lists, and friend leaderboards.

### Main Objectives

- Fully functional game in browser (desktop and mobile)
- Scalable and low-cost serverless architecture on AWS
- Secure authentication system with Cognito
- Global and friend rankings persisted in DynamoDB
- Minimum performance of 60 FPS on desktop and 30 FPS on mobile

---

## Technology Stack

### Frontend

| Technology | Version | Role |
|------------|---------|------|
| TypeScript | 5.x | Main language |
| Phaser 3 | 3.60+ | Game engine |
| Vite | 5.x | Bundler and dev server |
| Vitest | 1.x | Unit testing |
| fast-check | 3.x | Property-Based Testing |

### Backend (AWS Serverless)

| Service | Role |
|---------|------|
| AWS Lambda (Node.js 20) | API business logic |
| Amazon API Gateway (HTTP API) | REST/HTTPS endpoint exposure |
| Amazon DynamoDB | Persistence of profiles, scores, and friends |
| Amazon Cognito User Pools | Authentication and session management (JWT/OAuth 2.0) |

### Infrastructure and Deployment

| Service | Role |
|---------|------|
| Amazon S3 | Static frontend asset storage |
| Amazon CloudFront | CDN to serve the frontend with TTL ≥ 86400s |
| AWS CDK (TypeScript) | Infrastructure as code |
| AWS WAF | API and CDN protection |
| Amazon Route 53 | DNS management |
| AWS Certificate Manager | TLS/SSL certificates |
| Amazon CloudWatch | Logging, metrics, and alarms |

### Tooling

- **Package manager**: npm
- **Linting**: ESLint + typescript-eslint
- **Formatting**: Prettier
- **CI/CD**: GitHub Actions

---

## Project Structure

```
hackathon-kiro/
├── .kiro/
│   ├── specs/
│   │   └── horde-battle-game/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       └── tasks.md
│   └── steering/
│       ├── project-overview.md   ← this file
│       ├── code-standards.md
│       └── aws-guidelines.md
├── frontend/
│   ├── public/
│   │   └── assets/
│   │       ├── sprites/
│   │       │   ├── player/
│   │       │   ├── enemies/
│   │       │   └── projectiles/
│   │       ├── tilemaps/
│   │       └── audio/
│   ├── src/
│   │   ├── main.ts                 # Vite + Phaser config entry point
│   │   ├── config/
│   │   │   ├── game-config.ts      # Global Phaser configuration
│   │   │   ├── asset-manifest.ts   # Key → path map of all assets
│   │   │   └── constants.ts        # PLAYER_SPEED, PROJECTILE_RANGE, etc.
│   │   ├── scenes/
│   │   │   ├── BootScene.ts        # Minimal preload + transition to Preload
│   │   │   ├── PreloadScene.ts     # Load all assets with progress bar
│   │   │   ├── MenuScene.ts        # Main menu, login/register UI
│   │   │   ├── GameScene.ts        # Main game scene
│   │   │   ├── HUDScene.ts         # HUD overlay (health, round, score, controls)
│   │   │   ├── GameOverScene.ts    # Game over screen and submit score
│   │   │   └── LeaderboardScene.ts # Global and friends rankings
│   │   ├── game-objects/
│   │   │   ├── Player.ts
│   │   │   ├── Enemy.ts
│   │   │   ├── Projectile.ts
│   │   │   └── HealthBar.ts
│   │   ├── systems/
│   │   │   ├── CombatSystem.ts     # Damage calculation and application
│   │   │   ├── WaveManager.ts      # Round generation and control
│   │   │   ├── PathfindingSystem.ts# Enemy navigation toward the player
│   │   │   ├── InputHandler.ts     # Keyboard, mouse, and touch controls
│   │   │   └── ScoreSystem.ts      # In-session score tracking
│   │   ├── ui/
│   │   │   ├── VirtualJoystick.ts  # On-screen joystick for mobile
│   │   │   ├── FireButton.ts       # Fire button for mobile
│   │   │   └── RoundNotification.ts
│   │   ├── services/
│   │   │   ├── AuthService.ts      # Cognito wrapper (login, register, logout)
│   │   │   ├── LeaderboardService.ts
│   │   │   ├── FriendsService.ts
│   │   │   └── ApiClient.ts        # Base HTTP client with JWT interceptor
│   │   └── types/
│   │       ├── game.types.ts
│   │       ├── api.types.ts
│   │       └── aws.types.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── auth/
│   │   │   │   ├── register.ts
│   │   │   │   └── logout.ts
│   │   │   ├── leaderboard/
│   │   │   │   ├── submit-score.ts
│   │   │   │   ├── get-global.ts
│   │   │   │   └── get-friends.ts
│   │   │   └── friends/
│   │   │       ├── send-request.ts
│   │   │       ├── accept-request.ts
│   │   │       ├── reject-request.ts
│   │   │       ├── remove-friend.ts
│   │   │       └── list-friends.ts
│   │   ├── services/
│   │   │   ├── UserProfileService.ts
│   │   │   ├── LeaderboardService.ts
│   │   │   └── FriendsService.ts
│   │   ├── repositories/
│   │   │   ├── UserRepository.ts
│   │   │   ├── ScoreRepository.ts
│   │   │   └── FriendshipRepository.ts
│   │   ├── middleware/
│   │   │   ├── validateInput.ts    # Zod schema validation
│   │   │   └── errorHandler.ts
│   │   └── types/
│   │       ├── lambda.types.ts
│   │       └── domain.types.ts
│   ├── tsconfig.json
│   └── package.json
├── infra/
│   ├── bin/
│   │   └── app.ts                  # CDK App entry point
│   ├── lib/
│   │   ├── stacks/
│   │   │   ├── AuthStack.ts        # Cognito User Pool
│   │   │   ├── ApiStack.ts         # Lambda + API Gateway
│   │   │   ├── DatabaseStack.ts    # DynamoDB tables
│   │   │   └── FrontendStack.ts    # S3 + CloudFront
│   │   └── constructs/
│   │       ├── LambdaFunction.ts   # Reusable construct
│   │       └── DynamoTable.ts
│   ├── cdk.json
│   └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
└── README.md
```

---

## Key Architecture Patterns

### Frontend: Scene-based Architecture (Phaser 3)

Each game state is an independent `Phaser.Scene`. Scenes communicate through Phaser's global EventEmitter or data passed in `scene.start()`. The HUD runs as a parallel scene (`scene.launch()`) on top of the GameScene.

```
BootScene → PreloadScene → MenuScene ⇄ GameScene + HUDScene → GameOverScene
                                     ↕
                               LeaderboardScene
```

### Backend: Handler → Service → Repository

Each Lambda handler is limited to parsing the input and delegating to a Service. Services contain the business logic. Repositories abstract DynamoDB operations.

```
API Gateway → Lambda Handler → Service → Repository → DynamoDB
                    ↓
              Cognito Authorizer (protected endpoints)
```

### Frontend ↔ Backend Communication

- `ApiClient.ts` is the single HTTP exit point from the frontend
- All requests include the Cognito JWT in the `Authorization: Bearer <token>` header
- API Gateway validates the JWT with the Cognito Authorizer before invoking the Lambda

### Game Systems Separation

Game systems (`CombatSystem`, `WaveManager`, `PathfindingSystem`) are independent classes without global state. They receive references to the objects they need to operate on and emit events through Phaser EventEmitter. This facilitates unit testing.

---

## Game Domain Context

### Main Mechanics (MVP)

| Mechanic | Description |
|----------|-------------|
| **Character** | Cemetery guard — pixel art sprite with idle, walk, attack, hurt, death animations. |
| **Movement** | WASD/arrow keys on desktop, virtual joystick on mobile. Speed 200px/s, diagonal normalized. |
| **Melee attack** | Click/tap/spacebar → staff/shovel swing in 64px radius. 30 HP damage to all Undead in range. 600ms cooldown. |
| **Undead** | Zombies and skeletons chase the guard at 80px/s. Pathfinding 10 times/sec. Melee damage if within ≤48px. |
| **Damage received** | 10 HP/s per each Undead within ≤48px of the guard (independent ticks). |
| **Waves** | Round 1: 5 undead. Each round adds 3 more. 3s pause between rounds. |
| **Score** | 10 points per undead killed. Persisted on game over if the user is authenticated. |
| **Game Over** | Guard dies → overlay with stats → option to submit score and play again. |

### Domain Constants

```typescript
// src/config/constants.ts
export const PLAYER_SPEED = 200;              // px/s
export const PLAYER_MELEE_RANGE = 64;         // px — guard's staff/shovel
export const PLAYER_ATTACK_COOLDOWN_MS = 600; // ms
export const PLAYER_MELEE_DAMAGE = 30;        // HP per swing
export const ENEMY_SPEED = 80;                // px/s
export const ENEMY_MELEE_RANGE = 48;          // px — ALWAYS < PLAYER_MELEE_RANGE
export const ENEMY_MELEE_DAMAGE = 10;         // HP per second
export const ENEMY_SEPARATION_DISTANCE = 32;  // px
export const ENEMY_BASE_HP = 100;             // HP standard zombie
export const ENEMY_SCORE_VALUE = 10;          // points
export const PLAYER_MAX_HP = 100;             // HP
export const ROUND_START_ENEMIES = 5;
export const ROUND_ENEMY_INCREMENT = 3;
export const INTER_ROUND_PAUSE_MS = 3000;
export const PATHFINDING_UPDATE_HZ = 10;
export const ENEMY_SPAWN_BORDER_PX = 32;
export const ENEMY_MIN_SPAWN_DISTANCE = 100;

// Post-MVP (Req 19) — available when ranged is enabled
export const PROJECTILE_SPEED = 400;          // px/s
export const PROJECTILE_RANGE = 400;          // px
export const PROJECTILE_DAMAGE = 25;
export const PROJECTILE_COOLDOWN_MS = 500;
```

### Post-MVP Features

- **Undead variety**: Fast skeleton (140px/s) from round 10; bone thrower from round 15
- **Bosses**: Giant zombie or Undead Lord on rounds that are multiples of 10; 1000 HP, 500 pts bonus
- **Ranged attack (Req 19)**: The guard unlocks a ranged weapon (holy water, flare gun, etc.)

### Typical User Flow

1. User opens the game in the browser (served from CloudFront)
2. Can play without an account or register/sign in (Cognito)
3. Plays matches, accumulating score through rounds survived
4. On death, can submit their score to the global leaderboard
5. Can view the global ranking (top 100) and friend ranking
6. Can send/accept friend requests by username

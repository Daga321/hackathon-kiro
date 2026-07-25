# 🎮 HORDE BATTLE: GRAVEYARD GUARD

<!-- [HERO IMAGE PLACEHOLDER - Wide banner showing the graveyard arena with the guard fighting undead] -->
```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                    [ HERO IMAGE PLACEHOLDER ]                        ║
║                                                                      ║
║        Graveyard arena · Pixel art · Guard vs Undead horde           ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

> *Defend the graveyard. Survive the night. Slay the undead horde.*

<p align="center">
  <strong>[ 🎮 Play Demo ]</strong> &nbsp;·&nbsp;
  <strong>[ 🎬 Trailer ]</strong> &nbsp;·&nbsp;
  <strong>[ 📚 Documentation ]</strong> &nbsp;·&nbsp;
  <strong>[ 🐛 Report Bug ]</strong>
</p>

---

## 🖼️ Screenshots & Gameplay

<table>
  <tr>
    <td align="center"><code>[ SCREENSHOT 1 ]</code><br><em>Melee combat against zombie horde</em></td>
    <td align="center"><code>[ SCREENSHOT 2 ]</code><br><em>Wave notification between rounds</em></td>
  </tr>
  <tr>
    <td align="center"><code>[ SCREENSHOT 3 ]</code><br><em>HUD showing health, score, round</em></td>
    <td align="center"><code>[ SCREENSHOT 4 ]</code><br><em>Game over screen with leaderboard</em></td>
  </tr>
</table>

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                    [ GAMEPLAY GIF PLACEHOLDER ]                       ║
║                                                                      ║
║       Guard swinging staff · Zombies collapsing · Health bars        ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 🎮 About the Game

**Horde Battle: Graveyard Guard** is a top-down action survival game set in a nocturnal graveyard. You play as a cemetery guard armed with a staff, defending your territory against endless waves of the undead.

Inspired by classic horde-survival games like **Boxhead** and **Brotato**, the game combines fast-paced melee combat with strategic positioning. Each round brings more zombies and skeletons — survive as long as you can, climb the global leaderboard, and compete with friends.


| | |
|---|---|
| **Genre** | Top-down Action / Horde Survival |
| **Theme** | Dark cemetery, pixel art, undead |
| **Platform** | Web Browser (Desktop & Mobile) |
| **Players** | Single-player (async multiplayer via leaderboards) |
| **Engine** | Phaser 3 (WebGL) |
| **Status** | 🚧 In Development |

---

## ✨ Key Features

🗡️ **Melee-First Combat** — Swing your staff to cleave through undead at close range. The guard's attack range (64px) exceeds enemy reach (48px), rewarding aggressive positioning.

🧟 **Endless Undead Waves** — Each round spawns more zombies and skeletons. Round formula: `5 + (round - 1) × 3`. Survive 50+ rounds if you can.

🏆 **Global & Friend Leaderboards** — Submit your score, compare with players worldwide, and compete directly with friends.

📱 **Play Anywhere** — Full desktop and mobile support with responsive scaling, virtual joystick, and touch attack button.

⚡ **60 FPS Smooth Gameplay** — Optimized for 60fps on desktop and 30fps on mobile with up to 30 simultaneous enemies.

🔐 **Account System** — Optional registration via Amazon Cognito. Play without an account or log in to persist scores and add friends.

🎨 **Pixel Art Graveyard** — Themed cemetery arena with tombstones, fences, and atmospheric undead sprites.

---

## 🕹️ Gameplay

### Core Loop

```
Start Round → Undead spawn at arena edges → Guard fights with melee
    → Kill all undead → 3s pause → Next round (more enemies)
    → Guard dies → Game Over → Submit score / Play Again
```

### The Guard (Player)

- Moves at 200 px/s in 8 directions (WASD/arrows or virtual joystick)
- Attacks with melee staff: 64px range, 30 damage per swing, 600ms cooldown
- 100 HP — loses 10 HP/s per enemy in contact range (48px)
- Diagonal movement is normalized (no speed advantage)

### The Undead (Enemies)

- Zombies and skeletons chase the guard at 80 px/s
- Pathfinding updates 10 times per second
- Separation force prevents overlapping (32px threshold)
- Health bar appears on first hit (100 HP standard)
- Collapse animation on death (≤300ms removal)

### Wave Progression

| Round | Enemies | Cumulative |
|-------|---------|-----------|
| 1 | 5 | 5 |
| 5 | 17 | — |
| 10 | 32 | — |
| 25 | 77 | — |
| 50 | 152 | — |

### Post-MVP Systems (Planned)

- 🦴 **Undead Variety** — Fast skeletons (140px/s) from Round 10, bone throwers from Round 15
- 👹 **Bosses** — Giant zombie or Undead Lord every 10th round (1000 HP)
- 🏹 **Ranged Attack** — Holy water / flare gun unlocked in later rounds

---

## 🛠️ Technology Stack

### Game Client

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.x | Primary language |
| Phaser 3 | 3.80+ | Game engine (WebGL) |
| Vite | 5.x | Bundler & dev server |

### Backend (Serverless)

| Service | Purpose |
|---------|---------|
| AWS Lambda (Node.js 20) | API business logic |
| Amazon API Gateway | REST endpoints (HTTPS) |
| Amazon DynamoDB | User profiles, scores, friends |
| Amazon Cognito | Authentication (JWT/OAuth 2.0) |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Amazon S3 | Static asset hosting |
| Amazon CloudFront | CDN with aggressive caching |
| AWS CDK (TypeScript) | Infrastructure as code |
| AWS WAF | DDoS & abuse protection |
| Amazon CloudWatch | Logging, metrics, alarms |

### Testing

| Tool | Purpose |
|------|---------|
| Vitest | Unit testing |
| fast-check | Property-Based Testing (24 properties) |
| AWS CDK Assertions | Infrastructure snapshot tests |

### DevOps

| Tool | Purpose |
|------|---------|
| GitHub Actions | CI/CD pipelines |
| ESLint + Prettier | Linting & formatting |
| Conventional Commits | Commit standards |

---

## 💻 System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| Browser | Chrome 120+, Firefox 120+, Safari 17+ |
| Graphics | WebGL support required |
| Connection | 10 Mbps (for initial load) |
| Mobile | iOS 17+ / Android (Chrome 120+) |
| Screen | Minimum 360px width |

### Recommended Requirements

| Component | Requirement |
|-----------|-------------|
| Browser | Latest Chrome or Firefox |
| Screen | 1920×1080 desktop |
| Input | Keyboard + Mouse (desktop) or Touch (mobile) |

> No installation required. No plugins. Just open and play.

---

## 🏗️ Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                    [ ARCHITECTURE DIAGRAM ]                           ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────┐
│               BROWSER (Phaser 3 Client)                  │
│                                                          │
│  Scenes: Boot → Preload → Menu → Game → GameOver        │
│  Systems: CombatSystem · WaveManager · Pathfinding       │
│  Objects: GraveyardGuard · Undead · HealthBar · HUD      │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTPS
         ┌───────────────┴───────────────┐
         │      Amazon CloudFront         │ ← S3 (static assets)
         └───────────────┬───────────────┘
         ┌───────────────┴───────────────┐
         │      Amazon API Gateway        │ (CORS, JWT validation)
         └──────┬────────┬────────┬──────┘
                │        │        │
         ┌──────┴──┐ ┌───┴───┐ ┌──┴─────┐
         │  Auth   │ │Leader-│ │Friends │   ← AWS Lambda
         │(Cognito)│ │ board │ │Service │
         └────┬────┘ └───┬───┘ └───┬────┘
              └───────────┼────────┘
                    DynamoDB
              (users · scores · friends)
```

### Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Game Engine | Phaser 3 | Mature, pixel art native, Arcade physics, TS-friendly |
| Build | Vite | Instant HMR, tree-shaking, optimized production |
| Auth | Cognito | JWT out-of-box, no custom auth server needed |
| DB | DynamoDB on-demand | Pay-per-use, auto-scaling, fast reads with GSI |
| IaC | AWS CDK | Same language as backend, type-safe constructs |
| Hosting | S3 + CloudFront | Immutable assets, global CDN, low cost |

---

## 📁 Project Structure

```
hackathon-kiro/
├── frontend/
│   ├── src/
│   │   ├── scenes/          # Phaser scenes (Boot, Menu, Game, etc.)
│   │   ├── game-objects/    # Player, Enemy, Projectile, HealthBar
│   │   ├── systems/         # CombatSystem, WaveManager, Pathfinding
│   │   ├── ui/              # VirtualJoystick, FireButton
│   │   ├── config/          # GameConfig, AssetManifest, constants
│   │   ├── services/        # AuthService, LeaderboardService, ApiClient
│   │   └── types/           # TypeScript type definitions
│   └── public/assets/       # Sprites, tilemaps, audio
│
├── backend/
│   ├── src/
│   │   ├── handlers/        # Lambda handlers (auth, leaderboard, friends)
│   │   ├── services/        # Business logic layer
│   │   ├── repositories/    # DynamoDB data access
│   │   └── middleware/      # Validation, error handling
│   └── package.json
│
├── infra/
│   ├── lib/stacks/          # CDK stacks (Auth, API, Database, Frontend)
│   └── bin/app.ts           # CDK app entry point
│
├── .kiro/
│   ├── specs/               # Requirements, design, tasks
│   ├── steering/            # Code standards, AWS guidelines
│   └── hooks/               # Agent automation hooks
│
└── .github/workflows/       # CI/CD pipelines
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Requirements Index](requirements.md) | All functional requirements (19 total) |
| [Design Index](design.md) | Technical design & architecture |
| [Tasks Index](tasks.md) | Implementation plan with dependencies |
| [Gameplay Core](requirements/gameplay-core.md) | Movement, combat, enemies (Req 1-5) |
| [Wave System](requirements/wave-system.md) | Rounds & HUD (Req 6-7) |
| [Backend API](design/backend-api.md) | Lambda handlers & endpoints |
| [Database](design/database.md) | DynamoDB tables & GSI |
| [Correctness Properties](design/correctness-properties.md) | 24 PBT properties |
| [Testing Strategy](design/testing-strategy.md) | Test approach & tools |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- AWS CLI configured (for backend deployment)
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

```bash
# Clone the repository
git clone https://github.com/[your-username]/hackathon-kiro.git
cd hackathon-kiro

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Install infrastructure dependencies
cd ../infra
npm install
```

### Running Locally

```bash
# Start the frontend dev server
cd frontend
npm run dev

# The game will be available at http://localhost:5173
```

### Running Tests

```bash
# Frontend tests (unit + PBT)
cd frontend
npm run test

# Backend tests
cd backend
npm run test

# CDK snapshot tests
cd infra
npm run test
```

### Deploying to AWS

```bash
cd infra
cdk deploy --all
```

> [TODO: Add environment variables documentation]
> [TODO: Add local DynamoDB setup instructions]

---

## 🗺️ Roadmap

### Phase 1: MVP (Current)
- [x] Project documentation & spec
- [ ] Project setup (Vite + Phaser 3 + TypeScript)
- [ ] Guard movement & melee attack
- [ ] Undead AI & pathfinding
- [ ] Wave system & HUD
- [ ] Game over & score submission
- [ ] User authentication (Cognito)
- [ ] Global & friend leaderboards
- [ ] Mobile responsive support
- [ ] AWS infrastructure (CDK)
- [ ] CI/CD pipelines

### Phase 2: Polish
- [ ] Purchased pixel art assets integration
- [ ] Audio system (SFX + ambient)
- [ ] Performance optimization
- [ ] Cross-browser testing

### Phase 3: Post-MVP
- [ ] Undead variety (fast skeletons, bone throwers)
- [ ] Boss battles every 10 rounds
- [ ] Ranged attack system (holy water, flare gun)
- [ ] Custom pixel art assets (replace purchased ones)

> [TODO: Define target dates and version numbers]

---

## 📊 Project Status

```
🚧 IN DEVELOPMENT — Specification & Architecture Phase
```

| Area | Status |
|------|--------|
| Documentation & Spec | ✅ Complete |
| Project Setup | 🔲 Not started |
| Gameplay Core | 🔲 Not started |
| Backend Services | 🔲 Not started |
| Infrastructure | 🔲 Not started |
| CI/CD | 🔲 Not started |
| Testing | 🔲 Not started |

---

## 🤝 Contributing

### Code Standards

- **TypeScript strict mode** — No `any`, explicit return types, null checks
- **Naming**: PascalCase classes, camelCase functions, UPPER_SNAKE_CASE constants, kebab-case files
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) format
- **Branches**: `main` → production, `develop` → integration, `feat/<name>` → features

### Pull Request Process

1. Create a feature branch from `develop`
2. Write code following the [Code Standards](.kiro/steering/code-standards.md)
3. Add/update tests (80% coverage target)
4. Run `tsc --noEmit` and `npm run test`
5. Submit PR with descriptive title and linked issue

### Testing Requirements

- Unit tests with Vitest
- Property-Based Tests with fast-check for game invariants
- CDK Assertions for infrastructure changes

> See [Code Standards](.kiro/steering/code-standards.md) for full guidelines.

---

## 📄 License

> [TODO: Add project license]

---

<p align="center">
  <strong>Horde Battle: Graveyard Guard</strong><br>
  <em>Built with Phaser 3 · Powered by AWS · Tested with Property-Based Testing</em>
</p>

<p align="center">
  <code>[ FOOTER LOGO PLACEHOLDER ]</code>
</p>

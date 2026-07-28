# 🎮 HORDE BATTLE: GRAVEYARD GUARD

> *Defend the graveyard. Survive the night. Train your mind.*

<p align="center">
  <a href="http://s3hostingstack-prod-frontendbucketefe2e19c-tths0rket46m.s3-website-us-east-1.amazonaws.com/" target="_blank"><strong>🎮 Play Demo</strong></a> &nbsp;·&nbsp;
  <a href="./presentation/video.md" target="_blank"><strong>🎬 Video</strong></a> &nbsp;·&nbsp;
  <a href="./docs/" target="_blank"><strong>📚 Documentation</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/Daga321/hackathon-kiro/issues/new?template=bug_report.yml" target="_blank"><strong>🐛 Report Bug</strong></a> &nbsp;·&nbsp;
  <a href="https://github.com/users/Daga321/projects/5" target="_blank"><strong>📋 Kanban Board</strong></a>
</p>

> **Note:** The demo is hosted on S3 without CloudFront, so it only works over HTTP (not HTTPS). Some browsers may show a security warning — this is expected for the hackathon demo environment.

---

## 🎯 The Challenge

### Problem: Digital Gap & Cognitive Decline in Older Adults

Our project addresses a real and critical need in the social and healthcare space: **the digital gap and cognitive decline in older adults**. The videogame serves as a **neurocognitive stimulation tool and motor skills development platform** adapted for the elderly.

Through accessible survival and horde-based game mechanics, the project provides value in:

- **Hand-eye coordination and fine motor skills:** Stimulates the use and control of technological peripherals (mouse, keyboard, or touch screens).
- **Spatial awareness and mental acuity:** Exercises orientation in two-dimensional environments under controlled conditions.
- **Multi-stimulus processing:** Trains the brain's capacity to react to multiple visual and auditory stimuli in real time.

Technologically, the project demonstrates how interactive entertainment software development can be transformed into a **low-cost, high-accessibility solution for modern occupational therapy**, actively reducing the digital gap in this population.

---

## 💡 Our Solution & Innovation

### Why a Horde Survival Game?

The horde survival genre is **ideal for cognitive stimulation** because:

1. **Simple controls** — Only movement + one action button. No complex combos that frustrate elderly users.
2. **Progressive difficulty** — Waves increase gradually, adapting the cognitive load over time.
3. **Constant stimuli** — Multiple enemies from different directions force spatial awareness and quick reaction.
4. **Clear feedback** — Visual (health bars, damage indicators) and auditory (hit sounds, music) signals reinforce neural pathways.

### Innovation vs Existing Solutions

| Traditional Cognitive Apps | Our Approach |
|---|---|
| Static puzzles, repetitive | Dynamic real-time gameplay |
| Low engagement, quick abandonment | Fun-first design, intrinsic motivation to improve |
| No social component | Global leaderboard + friends system |
| Requires installation | Runs in any browser, zero install |
| Expensive licensing | Open source, serverless (near-zero operational cost) |

### The Graveyard Guard Metaphor

The protagonist — an elderly guard defending a cemetery — metaphorically represents **defending health and vitality against the passage of time**. The undead enemies symbolize cognitive decline, and each wave survived is a small victory for the mind.

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

---

## 🎮 About the Game

**Horde Battle: Graveyard Guard** is a top-down action survival game set in a nocturnal graveyard. You play as an elderly cemetery guard armed with a staff, defending your territory against endless waves of the undead.

Inspired by classic horde-survival games like **Boxhead** and **Brotato**, the game combines fast-paced melee combat with strategic positioning. Each round brings more zombies and skeletons — survive as long as you can, climb the global leaderboard, and compete with friends.

| | |
|---|---|
| **Genre** | Top-down Action / Horde Survival |
| **Theme** | Dark cemetery, pixel art, undead |
| **Platform** | Web Browser (Desktop & Mobile) |
| **Players** | Single-player (async multiplayer via leaderboards) |
| **Engine** | Phaser 3 (WebGL) |
| **Focus** | Neurocognitive stimulation for older adults |

---

## ✨ Key Features

🗡️ **Accessible Melee Combat** — Simple one-button attack with generous range. Designed for users with limited dexterity.

🧟 **Progressive Waves** — Difficulty scales gradually, providing continuous cognitive challenge without overwhelming the player.

🏆 **Global & Friend Leaderboards** — Submit scores, compare progress, and motivate continued play through social competition.

📱 **Play Anywhere** — Full desktop and mobile support with responsive scaling, virtual joystick, and touch attack button. Zero installation required.

⚡ **60 FPS Smooth Gameplay** — Optimized performance ensures fluid visual stimuli processing.

🔐 **Optional Account System** — Play without registration or log in to persist scores and connect with friends.

🎨 **Clear Visual Design** — High-contrast pixel art with distinct enemy types and readable UI elements.

🔊 **Audio Feedback** — Sound effects reinforce actions (hit, miss, damage) for multi-sensory stimulation.

---

## 🏗️ Technical Architecture

Our system is fully serverless, deployed via Infrastructure as Code:

```
Browser (Phaser 3)
    ↕ HTTPS
CloudFront CDN ← S3 (frontend assets)
    ↕
API Gateway (REST)
    ↕ Cognito Authorizer
Lambda Functions (auth, leaderboard, friends)
    ↕
DynamoDB (users, scores, friends) + Cognito (identity)
```

All infrastructure is defined in TypeScript using **AWS CDK**, organized in independent stacks for isolated deployments.

> 📖 Full architecture details: <a href="./docs/architecture.md" target="_blank">docs/architecture.md</a>

---

## ☁️ AWS Services & Kiro

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **S3** | Static frontend hosting |
| **CloudFront** | CDN with OAC (Origin Access Control) |
| **API Gateway** | REST API with CORS and Cognito authorizer |
| **Lambda** | 12 serverless endpoint handlers (Node.js 22) |
| **DynamoDB** | NoSQL database (3 tables + GSI for leaderboard) |
| **Cognito** | User authentication (JWT tokens, password policy) |
| **CloudFormation** | Infrastructure deployment (via CDK) |
| **ACM** | SSL certificates (ready for custom domain) |
| **Route53** | DNS management (ready for custom domain) |

### Kiro's Role in Development

Kiro was instrumental in our development process through:

- **Spec-Driven Development** — Requirements, designs, and tasks defined in `.kiro/specs/`, providing structured context for implementation
- **Steering Files** — Project standards and guidelines in `.kiro/steering/` ensuring consistent code generation
- **Hooks** — Automated validations (CDK diff before deploy, TypeScript lint on save, security reviews)
- **AI-Assisted Architecture** — Infrastructure decisions, CDK stack design, and Lambda implementations developed collaboratively with Kiro

> 📖 Full development process: <a href="./docs/development-process.md" target="_blank">docs/development-process.md</a>

---

## 🔄 Development Process

| Practice | Implementation |
|----------|---------------|
| **Version Control** | GitFlow (main, develop, feature branches) |
| **Task Management** | GitHub Issues + Sub-issues from spec slicing |
| **Project Tracking** | <a href="https://github.com/users/Daga321/projects/5" target="_blank">GitHub Projects Kanban</a> |
| **CI Quality Gates** | Prettier check, ESLint validation, Build validation |
| **CD Pipelines** | Automated deploy to dev/prod on merge |
| **Atomic Commits** | Small checkpoints for safe rollback |
| **Environments** | Development (`develop`) + Production (`main`) |

> 📖 Full details: <a href="./docs/development-process.md" target="_blank">docs/development-process.md</a>

---

## 🕹️ Gameplay

### Core Loop

```
Start Round → Undead spawn at arena edges → Guard fights with melee
    → Kill all undead → 3s pause → Next round (more enemies)
    → Guard dies → Game Over → Submit score / Play Again
```

### Controls

| Input | Desktop | Mobile |
|-------|---------|--------|
| Move | WASD / Arrow keys | Virtual joystick |
| Attack | Space | Attack button |
| Pause | ESC / P | Auto-pause on tab switch |

### Wave Progression

| Round | Enemies | Challenge |
|-------|---------|-----------|
| 1 | 5 | Introduction |
| 5 | 17 | Moderate |
| 10 | 32 | Challenging |
| 25 | 77 | Expert |
| 50 | 152 | Extreme |

---

## 🎬 Presentation

The video and slides are available in the [`presentation/`](./presentation/) directory:

- `video.md` — Link to the presentation video (max 5 min)
- Slides and supporting materials

---

## 👥 Team: D-EXP TEAM

| Member | Role |
|--------|------|
| **Daniel Alejandro Gomez Acero** | Full-stack Development, Architecture, DevOps |
| **Miguel Angel Alfonso Saavedra** | Game Development, Frontend, Design |

---

## 📄 Documentation

For complete technical documentation, see the <a href="./docs/" target="_blank">`docs/`</a> directory:

| Document | Description |
|----------|-------------|
| <a href="./docs/project-guide.md" target="_blank">Project Guide</a> | Quick-start for developers (setup, structure, commands) |
| <a href="./docs/development-process.md" target="_blank">Development Process</a> | Methodology, CI/CD, team workflow |
| <a href="./docs/architecture.md" target="_blank">Architecture</a> | System design, AWS services, database schema |

---

## 🛠️ Quick Start

```bash
# Clone
git clone https://github.com/Daga321/hackathon-kiro.git
cd hackathon-kiro

# Install
pnpm install

# Run locally
pnpm dev
# → http://localhost:5173
```

> See <a href="./docs/project-guide.md" target="_blank">Project Guide</a> for full setup including AWS deployment.

---

<p align="center">
  Built with ❤️ by <strong>D-EXP TEAM</strong> for the AWS + Kiro Hackathon 2025
</p>

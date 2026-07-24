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

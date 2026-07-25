# Design Document — Horde Battle Game

## Overview

Horde Battle Game is a top-down action browser game set in a nocturnal graveyard. The player takes the role of a **graveyard guard** who must defend his territory from waves of **undead** (zombies and skeletons) using initially only his melee weapon (staff/shovel). Inspired by *Boxhead* and *Brotato*.

### Key differences from a classic top-down shooter

- **MVP combat = melee only**: the Graveyard_Guard attacks in a 64 px arc around his position with a staff or shovel. Ranged attacks (projectiles) are a post-MVP feature (Req 19).
- **Positioning mechanic**: the player must approach undead groups to hit them while avoiding being surrounded, generating tactical tension from the first round.
- **Visual theme**: the Arena is a graveyard with tombstones, fences, and gates. Sprites are thematic undead pixel art.

### Design goals

- **Smooth gameplay**: 60 fps on desktop, 30 fps on mobile, input latency < 1 frame.
- **Clear progression**: Each round adds 3 more undead than the previous one; the formula is deterministic and verifiable.
- **Serverless backend**: Lambda + DynamoDB with automatic scaling; cost proportional to actual usage.
- **Security by default**: JWT validated on every protected endpoint, rate-limiting on auth, schema validation in Lambda.
- **Post-MVP extensibility**: Variant undead types, bosses, and ranged system defined in configuration files, not hardcoded in business logic.

### MVP scope

The MVP covers Requirements 1–16: guard movement, melee attack, undead behavior, damage, rounds, HUD, game-over, authentication, global leaderboard, friend list, mobile support, AWS infrastructure, performance, themed assets, and security. Requirements 17–19 (undead variants, bosses, and ranged) are post-MVP.

---

## Design Index

| Domain | File | Content |
|--------|------|---------|
| Gameplay Core | [gameplay-core.md](design/gameplay-core.md) | GameObjects, Systems, Config |
| Wave System & HUD | [wave-system.md](design/wave-system.md) | WaveManager, HUD, Audio |
| Scenes & Flow | [scenes-flow.md](design/scenes-flow.md) | All Phaser scenes |
| Backend API | [backend-api.md](design/backend-api.md) | Lambdas, endpoints, auth flow |
| Database | [database.md](design/database.md) | DynamoDB tables, GSI |
| Infrastructure | [infrastructure.md](design/infrastructure.md) | Architecture, CDK stacks |
| Correctness Properties | [correctness-properties.md](design/correctness-properties.md) | P1-P24 |
| Error Handling | [error-handling.md](design/error-handling.md) | Client + backend errors |
| Testing Strategy | [testing-strategy.md](design/testing-strategy.md) | PBT, unit, integration |

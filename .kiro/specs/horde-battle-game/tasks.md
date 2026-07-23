# Implementation Plan: Horde Battle Game

## Overview

Incremental implementation plan for Horde Battle Game: a top-down wave-based enemy game with a Phaser 3 + TypeScript (Vite) client, AWS serverless backend (Lambda + DynamoDB + Cognito), and infrastructure as code with CDK. Tasks follow the order: setup → game logic → backend → infrastructure → integration → final tests.

---

## Tasks Index

| Domain | File | Tasks |
|--------|------|-------|
| Project Setup | [project-setup.md](tasks/project-setup.md) | Task 1 |
| Gameplay Core | [gameplay-core.md](tasks/gameplay-core.md) | Tasks 3, 4, 6 |
| Scenes | [scenes.md](tasks/scenes.md) | Tasks 2, 5 |
| Client API | [client-api.md](tasks/client-api.md) | Task 8 |
| Infrastructure | [infrastructure.md](tasks/infrastructure.md) | Task 9 |
| Backend Auth | [backend-auth.md](tasks/backend-auth.md) | Task 10 |
| Backend Leaderboard | [backend-leaderboard.md](tasks/backend-leaderboard.md) | Task 11 |
| Backend Friends | [backend-friends.md](tasks/backend-friends.md) | Task 12 |
| Security | [security.md](tasks/security.md) | Task 13 |
| Integration Tests | [integration-tests.md](tasks/integration-tests.md) | Task 15 |
| Mobile & Responsive | [mobile-responsive.md](tasks/mobile-responsive.md) | Tasks 16-17 |
| Final Wiring | [wiring-final.md](tasks/wiring-final.md) | Tasks 18-19 |

---

## Notes

- Tasks marked with `*` are optional (tests) and can be skipped for a quick MVP; implementation logic does not depend on them.
- Each task references specific requirements for full traceability.
- Checkpoints (tasks 7, 14, 19) are synchronization points to validate progress before continuing.
- Property-based tests use `fast-check` with a minimum of 100 iterations per property; each test includes the tag `// Feature: horde-battle-game, Property N`.
- Properties P1–P15 and P24 correspond to client logic; P16–P23 correspond to backend Lambda logic.
- CDK infrastructure tests are snapshot tests, not PBT.
- `ENEMY_MELEE_RANGE < PLAYER_MELEE_RANGE` is verified both in Property 3 (PBT) and via compile-time assertion in `GameConfig.ts`.
- The GSI `rankKey` field (`padStart(6,'0')(round) + '#' + padStart(10,'0')(score)`) enables ordered Query without Scan; changes to this logic require updating both the submit and getGlobal handlers.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "9.1", "10.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "3.1", "3.2", "3.3", "3.4", "3.5", "9.2", "9.3", "10.2", "10.3"] },
    { "id": 3, "tasks": ["4.1", "4.4", "4.9", "4.13", "4.14", "9.4", "9.5", "9.6", "10.4", "10.5"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.5", "4.6", "4.7", "4.8", "4.10", "4.11", "4.12", "9.7", "11.1", "11.3", "12.1", "12.2", "12.3", "12.4", "12.5"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.5", "6.1", "6.3", "6.6", "8.1", "8.2", "8.3", "11.2", "11.7", "12.6", "13.1", "13.2"] },
    { "id": 6, "tasks": ["5.3", "5.4", "6.2", "6.4", "6.5", "6.7", "6.8", "11.4", "11.5", "11.6", "13.3", "16.1", "16.2", "16.3", "17.1"] },
    { "id": 7, "tasks": ["15.1"] },
    { "id": 8, "tasks": ["15.2", "15.3", "15.4", "15.5", "15.6", "15.7", "18.1", "18.2", "18.3", "18.4"] }
  ]
}
```

# Tasks: Project Setup

> **Related:** [Requirements](../requirements/infrastructure-security.md) | [Design](../design/infrastructure.md)

---

- [ ] 1. Project setup and base structure
  - [ ] 1.1 Initialize Vite + TypeScript + Phaser 3 project
    - Create `package.json` with dependencies: `phaser@^3.80`, `vite@^5`, `typescript@^5`, `vitest@^1`, `fast-check@^3`
    - Create `vite.config.ts` with `base: './'`, alias resolution `@/` → `src/`
    - Create `tsconfig.json` with `strict: true`, `target: ES2022`, paths `@/*`
    - Create directory structure: `src/scenes/`, `src/objects/`, `src/systems/`, `src/config/`, `src/api/`, `src/types/`
    - Create `src/main.ts` with minimal Phaser configuration (800×600, Arcade physics)
    - _Requirements: 13.4, 14.1, 14.2_
  - [ ] 1.2 Create central game configuration files
    - Write `src/config/GameConfig.ts` with all constants: `PLAYER_SPEED`, `PLAYER_HP`, `PLAYER_FIRE_COOLDOWN`, `PROJECTILE_SPEED`, `PROJECTILE_RANGE`, `PROJECTILE_DAMAGE`, `ENEMY_BASE_SPEED`, `ENEMY_HP`, `ENEMY_MELEE_RANGE`, `ENEMY_DAMAGE_PER_TICK`, `ENEMY_DAMAGE_INTERVAL`, `ENEMY_SEPARATION_RADIUS`, `ROUND_BASE_ENEMIES`, `ROUND_ENEMY_INCREMENT`, `INTER_ROUND_PAUSE`, `SPAWN_STRIP_WIDTH`, `SPAWN_MIN_DISTANCE`, `WAVE_MANAGER_MAX_ROUNDS`
    - Write `src/config/AssetManifest.ts` with structure `sprites`, `spritesheets`, `audio` with placeholders
    - Write `src/config/EnemyConfig.ts` with interface `EnemyDefinition` and standard enemy configuration
    - _Requirements: 1.1, 2.2, 2.3, 3.2, 5.1, 6.1, 6.4, 15.1, 15.3_
  - [ ] 1.3 Define shared TypeScript types
    - Write `src/types/index.ts` with interfaces: `LeaderboardEntry`, `UserSession`, `GameSessionData`, `ScoreSubmission`, `FriendEntry`, `ApiResponse<T>`, `EnemyDefinition`
    - _Requirements: 10.4, 11.4, 11.6_

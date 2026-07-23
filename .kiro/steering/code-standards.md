---
inclusion: auto
---

# Code Standards: Horde Battle Game

## TypeScript

### Strict Configuration

All modules (frontend and backend) use `strict: true` in `tsconfig.json`. The following rules are mandatory:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

### Fundamental Rules

- **No `any` allowed**: Use `unknown` when the type is uncertain and do explicit type narrowing.
- **Explicit types on public signatures**: Every public function/method must have explicitly declared parameter and return types.
- **No non-null assertion `!`**: Use optional chaining `?.` or type guards instead.
- **Prefer `type` over `interface`** for data types and unions; use `interface` only for extensible object contracts.
- **Enums → `const` objects**: Use `as const` objects instead of `enum` to avoid the extra JS output.

```typescript
// ❌ Avoid
function processEnemy(e: any): any { ... }

// ✅ Correct
function processEnemy(enemy: Enemy): DamageResult { ... }

// ❌ Avoid enum
enum Direction { North, South, East, West }

// ✅ Prefer const object
const Direction = {
  North: 'north',
  South: 'south',
  East: 'east',
  West: 'west',
} as const;
type Direction = typeof Direction[keyof typeof Direction];
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Classes | `PascalCase` | `WaveManager`, `CombatSystem` |
| Interfaces / Types | `PascalCase` | `PlayerState`, `EnemyConfig` |
| Functions and methods | `camelCase` | `spawnEnemy()`, `applyDamage()` |
| Local variables | `camelCase` | `currentRound`, `enemyCount` |
| Module constants | `UPPER_SNAKE_CASE` | `PLAYER_SPEED`, `MAX_ENEMIES` |
| Code files | `kebab-case` | `wave-manager.ts`, `combat-system.ts` |
| Phaser scene files | `PascalCase` (class) + `kebab-case` (file) | `GameScene.ts` → `game-scene.ts` |
| Directories | `kebab-case` | `game-objects/`, `ui/` |
| Private class variables | `_camelCase` | `_healthPoints`, `_speed` |
| Lambda handlers | `kebab-case` | `submit-score.ts`, `get-global.ts` |

### Phaser Event Naming

Phaser EventEmitter events are named in `kebab-case` with a domain prefix:

```typescript
// Prefixes: game:, wave:, player:, enemy:, ui:
this.events.emit('wave:round-started', { round: 1, enemyCount: 5 });
this.events.emit('player:health-changed', { current: 75, max: 100 });
this.events.emit('enemy:killed', { enemyId: 'e-001', scoreValue: 10 });
```

---

## File and Module Structure

### One Responsibility Per File Rule

Each file exports **one** main class or function. Supporting types from the same domain can co-exist in the same file.

### Import Order

```typescript
// 1. Node.js / runtime imports
import { APIGatewayProxyEvent } from 'aws-lambda';

// 2. External dependency imports (Phaser, AWS SDK, etc.)
import Phaser from 'phaser';

// 3. Internal imports (absolute paths with aliases)
import { PLAYER_SPEED } from '@/config/constants';
import type { EnemyConfig } from '@/types/game.types';
```

### Barrel Exports

Important subdirectories can expose an `index.ts` barrel, but only to group related exports. Avoid barrels that re-export from multiple domains.

---

## Phaser 3 Standards

### Scene Organization

Each scene extends `Phaser.Scene` and explicitly declares its key:

```typescript
export class GameScene extends Phaser.Scene {
  static readonly KEY = 'GameScene';

  // Systems injected / initialized in create()
  private _combatSystem!: CombatSystem;
  private _waveManager!: WaveManager;
  private _player!: Player;

  constructor() {
    super({ key: GameScene.KEY });
  }

  preload(): void { /* only if there are scene-specific assets */ }

  create(): void {
    this._combatSystem = new CombatSystem(this);
    this._waveManager = new WaveManager(this);
    this._player = new Player(this, 400, 300);
    this._setupEventListeners();
  }

  update(time: number, delta: number): void {
    this._player.update(time, delta);
    this._waveManager.update(time, delta);
  }

  private _setupEventListeners(): void { ... }
}
```

### Game Objects

Game Objects extend `Phaser.GameObjects.Sprite` or other Phaser base classes:

```typescript
export class Enemy extends Phaser.GameObjects.Sprite {
  private _hitPoints: number;
  private _healthBar: HealthBar | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    super(scene, x, y, config.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this._hitPoints = config.maxHitPoints;
  }

  receiveDamage(amount: number): void {
    this._hitPoints = Math.max(0, this._hitPoints - amount);
    this._showHealthBar();
    if (this._hitPoints === 0) {
      this.scene.events.emit('enemy:killed', { enemyId: this.name });
    }
  }
}
```

### Systems

Systems are plain classes (not Phaser.GameObjects) that receive the scene in the constructor. They do not maintain global state.

```typescript
export class CombatSystem {
  private readonly _scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this._scene = scene;
  }

  applyProjectileDamage(projectile: Projectile, enemy: Enemy): void {
    enemy.receiveDamage(PROJECTILE_DAMAGE);
    projectile.destroy();
  }
}
```

### Asset Loading

All assets are loaded in `PreloadScene` using the asset manifest keys:

```typescript
// src/config/asset-manifest.ts
export const ASSET_MANIFEST = {
  player: {
    idle: { key: 'player-idle', path: 'assets/sprites/player/idle.png', frameWidth: 32, frameHeight: 32 },
    walk: { key: 'player-walk', path: 'assets/sprites/player/walk.png', frameWidth: 32, frameHeight: 32 },
  },
  enemy: {
    standard: { key: 'enemy-standard', path: 'assets/sprites/enemies/standard.png', frameWidth: 32, frameHeight: 32 },
  },
} as const;

// In PreloadScene:
this.load.spritesheet(
  ASSET_MANIFEST.player.idle.key,
  ASSET_MANIFEST.player.idle.path,
  { frameWidth: 32, frameHeight: 32 }
);
```

### Physics

- Use `arcade` physics (lightweight and sufficient for the game).
- Enable physics only in scenes that need it (`physics: { default: 'arcade' }` in config).
- Define collision groups in `create()` and register overlaps/colliders explicitly.

---

## Lambda Standards (Backend)

### Handler Structure

```typescript
// backend/src/handlers/leaderboard/submit-score.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateSubmitScoreInput } from './submit-score.schema';
import { LeaderboardService } from '@/services/LeaderboardService';
import { logger } from '@/utils/logger';

const leaderboardService = new LeaderboardService();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body ?? '{}');
    const input = validateSubmitScoreInput(body); // throws if invalid

    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    const result = await leaderboardService.submitScore(userId, input);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    logger.error('submit-score handler error', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
```

### Lambda Error Handling

- Validation errors return `400` with a descriptive message of the failed field.
- Authentication errors return `401` without internal details.
- Unexpected errors return `500` with a generic message and log the full stack trace to CloudWatch.
- **Never expose** stack trace details or internal information in the HTTP response.

### Environment Variables

- Access only through a centralized configuration module, never directly with `process.env` in handlers.
- Validate the presence of critical variables at startup (cold start).

```typescript
// backend/src/config/env.ts
const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const ENV = {
  DYNAMODB_TABLE_USERS: required('DYNAMODB_TABLE_USERS'),
  DYNAMODB_TABLE_SCORES: required('DYNAMODB_TABLE_SCORES'),
  COGNITO_USER_POOL_ID: required('COGNITO_USER_POOL_ID'),
  AWS_REGION: required('AWS_REGION'),
} as const;
```

### Logging

- Use structured logging (JSON) to facilitate queries in CloudWatch.
- Always include `requestId`, `userId` (if available), and `action` in each log.
- Levels: `info` for normal flow, `warn` for recoverable unexpected conditions, `error` for exceptions.

```typescript
logger.info('Score submitted', { requestId, userId, round, score });
logger.error('DynamoDB write failed', { requestId, error: error.message, stack: error.stack });
```

---

## Testing Conventions

### Testing Stack

- **Vitest** for unit tests in frontend and backend
- **fast-check** for Property-Based Testing (PBT)
- Minimum coverage target: 80% on core game systems and Lambda business logic

### Test File Structure

Tests live alongside the code they test with the `.test.ts` suffix:

```
src/systems/CombatSystem.ts
src/systems/CombatSystem.test.ts
src/systems/WaveManager.ts
src/systems/WaveManager.test.ts
```

### Test Naming

Follow the `describe / it` pattern with declarative language:

```typescript
describe('CombatSystem', () => {
  describe('applyProjectileDamage', () => {
    it('should reduce enemy HP by PROJECTILE_DAMAGE', () => { ... });
    it('should destroy the projectile on impact', () => { ... });
    it('should not reduce HP below 0', () => { ... });
  });
});
```

### Property-Based Tests with fast-check

Use PBT for game domain invariants:

```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';

describe('WaveManager - round invariants', () => {
  it('enemy count should always be positive for any round number', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (round) => {
        const enemyCount = ROUND_START_ENEMIES + (round - 1) * ROUND_ENEMY_INCREMENT;
        return enemyCount > 0;
      })
    );
  });

  it('normalized diagonal movement speed should never exceed PLAYER_SPEED', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1, max: 1 }),
        fc.float({ min: -1, max: 1 }),
        (vx, vy) => {
          const magnitude = Math.sqrt(vx * vx + vy * vy);
          if (magnitude === 0) return true;
          const normalized = { x: (vx / magnitude) * PLAYER_SPEED, y: (vy / magnitude) * PLAYER_SPEED };
          const resultSpeed = Math.sqrt(normalized.x ** 2 + normalized.y ** 2);
          return Math.abs(resultSpeed - PLAYER_SPEED) < 0.001;
        }
      )
    );
  });
});
```

### Mocking

- Use Vitest's `vi.mock()` for external dependencies (AWS SDK, Phaser).
- Create test object factories in `src/__tests__/factories/` for reuse.
- Do not test internal implementations; test observable behavior.

---

## Git Rules (Conventional Commits)

All commits follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <short description>

[optional body]
[optional footer with BREAKING CHANGE or issue refs]
```

### Allowed Types

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation-only changes |
| `test` | Adding or fixing tests |
| `chore` | Maintenance tasks (deps, config) |
| `refactor` | Refactoring without functional change |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |
| `build` | Build system changes |

### Examples

```
feat(wave-manager): add 3-second pause between rounds
fix(combat): fix diagonal speed normalization
test(pathfinding): add PBT for enemy separation
chore(deps): update phaser to 3.61.0
refactor(hud): extract HealthBar to independent component
```

### Branches

- `main` → production
- `develop` → integration
- `feat/<kebab-name>` → features
- `fix/<kebab-name>` → bugfixes
- `chore/<kebab-name>` → maintenance tasks

---

## Security Rules

### Secrets and Credentials

- **Never** include API keys, tokens, ARNs, passwords, or private resource URLs in source code.
- Use environment variables for all sensitive configuration.
- `.env` files are in `.gitignore`; use `.env.example` with dummy values as a template.
- In Lambda, load secrets from AWS Secrets Manager or Parameter Store, not from environment variables for highly sensitive data.

### Input Validation

- All frontend input must be validated in the backend before processing.
- Use [Zod](https://zod.dev/) for schema validation in Lambda handlers.
- The frontend also validates for UX, but backend validation is the source of truth.

```typescript
// submit-score.schema.ts
import { z } from 'zod';

export const SubmitScoreSchema = z.object({
  round: z.number().int().min(1).max(1000),
  score: z.number().int().min(0),
  enemiesKilled: z.number().int().min(0),
  sessionDurationSeconds: z.number().int().min(0),
});

export type SubmitScoreInput = z.infer<typeof SubmitScoreSchema>;

export function validateSubmitScoreInput(data: unknown): SubmitScoreInput {
  return SubmitScoreSchema.parse(data); // throws ZodError if invalid
}
```

### JWT Handling

- Never decode or trust the JWT on the frontend for security decisions.
- On the frontend, the JWT is used solely to include it in the header of each request.
- JWT validation is the exclusive responsibility of the Cognito Authorizer in API Gateway.
- Tokens are stored in memory (not in `localStorage`) when possible to reduce XSS risk.

### Abuse Protection

- The backend validates that the submitted `round` does not exceed a plausible maximum based on session duration (see Req. 16.3).
- Login rate limiting: max 10 attempts/minute/IP (handled by Cognito + WAF).

---

## Accessibility and Performance

### Accessibility (Web UI, not canvas)

- Menu, login, leaderboard, and game-over screens are standard HTML/CSS.
- Minimum WCAG AA contrast (4.5:1) for text on background.
- Minimum font size 12px; HUD readable between 360px and 1920px viewport.
- Touch buttons have a minimum size of 44×44px (HUD) and 48×48px (game controls).
- The HUD does not occlude more than 10% of the game area; touch controls no more than 20%.

### Performance

- Target: 60 FPS desktop (up to 30 simultaneous enemies), 30 FPS mobile (up to 20 enemies).
- Use **object pooling** for projectiles and enemies; avoid frequently creating/destroying objects in the game loop.
- Heavy operations (pathfinding, separation) are distributed using Phaser's delta time; do not block the game loop.
- Pathfinding updates at 10 Hz (every 100ms), not every frame.
- Load the game to interactive state in ≤5 seconds on a 10 Mbps connection.
- Sprite assets use sprite sheets (not individual images) to reduce draw calls.

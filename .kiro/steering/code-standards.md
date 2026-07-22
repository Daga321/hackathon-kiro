---
inclusion: auto
---

# Estándares de Código: Horde Battle Game

## TypeScript

### Configuración Estricta

Todos los módulos (frontend y backend) usan `strict: true` en `tsconfig.json`. Las siguientes reglas son obligatorias:

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

### Reglas Fundamentales

- **Prohibido `any`**: Usar `unknown` cuando el tipo sea incierto y hacer type narrowing explícito.
- **Tipos explícitos en firmas públicas**: Toda función/método público debe tener tipos de parámetros y retorno declarados explícitamente.
- **No non-null assertion `!`**: Usar optional chaining `?.` o guardas de tipo en su lugar.
- **Preferir `type` sobre `interface`** para tipos de datos y uniones; usar `interface` solo para contratos de objetos extensibles.
- **Enums → `const` objects**: Usar objetos `as const` en lugar de `enum` para evitar el output JS extra.

```typescript
// ❌ Evitar
function processEnemy(e: any): any { ... }

// ✅ Correcto
function processEnemy(enemy: Enemy): DamageResult { ... }

// ❌ Evitar enum
enum Direction { North, South, East, West }

// ✅ Preferir const object
const Direction = {
  North: 'north',
  South: 'south',
  East: 'east',
  West: 'west',
} as const;
type Direction = typeof Direction[keyof typeof Direction];
```

---

## Convenciones de Nomenclatura

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Clases | `PascalCase` | `WaveManager`, `CombatSystem` |
| Interfaces / Types | `PascalCase` | `PlayerState`, `EnemyConfig` |
| Funciones y métodos | `camelCase` | `spawnEnemy()`, `applyDamage()` |
| Variables locales | `camelCase` | `currentRound`, `enemyCount` |
| Constantes de módulo | `UPPER_SNAKE_CASE` | `PLAYER_SPEED`, `MAX_ENEMIES` |
| Archivos de código | `kebab-case` | `wave-manager.ts`, `combat-system.ts` |
| Archivos de escena Phaser | `PascalCase` (clase) + `kebab-case` (archivo) | `GameScene.ts` → `game-scene.ts` |
| Directorios | `kebab-case` | `game-objects/`, `ui/` |
| Variables privadas de clase | `_camelCase` | `_healthPoints`, `_speed` |
| Handlers de Lambda | `kebab-case` | `submit-score.ts`, `get-global.ts` |

### Naming de Eventos Phaser

Los eventos de Phaser EventEmitter se nombran en `kebab-case` con un prefijo de dominio:

```typescript
// Prefijos: game:, wave:, player:, enemy:, ui:
this.events.emit('wave:round-started', { round: 1, enemyCount: 5 });
this.events.emit('player:health-changed', { current: 75, max: 100 });
this.events.emit('enemy:killed', { enemyId: 'e-001', scoreValue: 10 });
```

---

## Estructura de Archivos y Módulos

### Regla de Un Responsable por Archivo

Cada archivo exporta **una** clase o función principal. Los tipos de soporte del mismo dominio pueden co-existir en el mismo archivo.

### Orden de Imports

```typescript
// 1. Imports de Node.js / runtime
import { APIGatewayProxyEvent } from 'aws-lambda';

// 2. Imports de dependencias externas (Phaser, AWS SDK, etc.)
import Phaser from 'phaser';

// 3. Imports internos (rutas absolutas con alias)
import { PLAYER_SPEED } from '@/config/constants';
import type { EnemyConfig } from '@/types/game.types';
```

### Barrel Exports

Los subdirectorios importantes pueden exponer un `index.ts` barrel, pero solo para agrupar exports relacionados. Evitar barrels que re-exporten de múltiples dominios.

---

## Estándares de Phaser 3

### Organización de Escenas

Cada escena extiende `Phaser.Scene` y declara explícitamente su key:

```typescript
export class GameScene extends Phaser.Scene {
  static readonly KEY = 'GameScene';

  // Sistemas inyectados / inicializados en create()
  private _combatSystem!: CombatSystem;
  private _waveManager!: WaveManager;
  private _player!: Player;

  constructor() {
    super({ key: GameScene.KEY });
  }

  preload(): void { /* solo si hay assets específicos de esta escena */ }

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

Los Game Objects extienden `Phaser.GameObjects.Sprite` u otras clases base de Phaser:

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

### Sistemas (Systems)

Los sistemas son clases planas (no Phaser.GameObjects) que reciben la escena en el constructor. No mantienen estado global.

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

Todos los assets se cargan en `PreloadScene` usando las llaves del asset manifest:

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

// En PreloadScene:
this.load.spritesheet(
  ASSET_MANIFEST.player.idle.key,
  ASSET_MANIFEST.player.idle.path,
  { frameWidth: 32, frameHeight: 32 }
);
```

### Física

- Usar `arcade` physics (ligero y suficiente para el juego).
- Habilitar physics solo en escenas que lo necesiten (`physics: { default: 'arcade' }` en config).
- Definir los grupos de colisión en `create()` y registrar los overlaps/colliders explícitamente.

---

## Estándares de Lambda (Backend)

### Estructura del Handler

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
    const input = validateSubmitScoreInput(body); // lanza si inválido

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

### Error Handling en Lambda

- Los errores de validación retornan `400` con mensaje descriptivo del campo fallido.
- Los errores de autenticación retornan `401` sin detalles internos.
- Los errores inesperados retornan `500` con mensaje genérico y loguean el stack trace completo a CloudWatch.
- **Nunca exponer** detalles del stack trace o información interna en la respuesta HTTP.

### Variables de Entorno

- Acceder solo a través de un módulo de configuración centralizado, nunca directamente con `process.env` en handlers.
- Validar presencia de variables críticas al inicio (cold start).

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

- Usar structured logging (JSON) para facilitar las queries en CloudWatch.
- Incluir siempre `requestId`, `userId` (si disponible) y `action` en cada log.
- Niveles: `info` para flujo normal, `warn` para condiciones inesperadas recuperables, `error` para excepciones.

```typescript
logger.info('Score submitted', { requestId, userId, round, score });
logger.error('DynamoDB write failed', { requestId, error: error.message, stack: error.stack });
```

---

## Convenciones de Testing

### Stack de Testing

- **Vitest** para unit tests en frontend y backend
- **fast-check** para Property-Based Testing (PBT)
- Cobertura mínima objetivo: 80% en sistemas de juego core y lógica de negocio de Lambda

### Estructura de Archivos de Test

Los tests viven junto al código que testean con el sufijo `.test.ts`:

```
src/systems/CombatSystem.ts
src/systems/CombatSystem.test.ts
src/systems/WaveManager.ts
src/systems/WaveManager.test.ts
```

### Naming de Tests

Seguir el patrón `describe / it` con lenguaje declarativo:

```typescript
describe('CombatSystem', () => {
  describe('applyProjectileDamage', () => {
    it('debería reducir los HP del enemigo en PROJECTILE_DAMAGE', () => { ... });
    it('debería destruir el proyectil al impactar', () => { ... });
    it('no debería reducir los HP por debajo de 0', () => { ... });
  });
});
```

### Property-Based Tests con fast-check

Usar PBT para invariantes del dominio del juego:

```typescript
import { describe, it } from 'vitest';
import * as fc from 'fast-check';

describe('WaveManager - invariantes de ronda', () => {
  it('el conteo de enemigos siempre debe ser positivo para cualquier número de ronda', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (round) => {
        const enemyCount = ROUND_START_ENEMIES + (round - 1) * ROUND_ENEMY_INCREMENT;
        return enemyCount > 0;
      })
    );
  });

  it('la velocidad normalizada de movimiento diagonal nunca debe exceder PLAYER_SPEED', () => {
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

- Usar `vi.mock()` de Vitest para dependencias externas (AWS SDK, Phaser).
- Crear factories de objetos de test en `src/__tests__/factories/` para reutilizar.
- No testear implementaciones internas; testear comportamiento observable.

---

## Reglas de Git (Commits Convencionales)

Todos los commits siguen el formato [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>[alcance opcional]: <descripción corta en español o inglés>

[cuerpo opcional]
[pie opcional con BREAKING CHANGE o refs a issues]
```

### Tipos Permitidos

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo cambios en documentación |
| `test` | Añadir o corregir tests |
| `chore` | Tareas de mantenimiento (deps, config) |
| `refactor` | Refactorización sin cambio funcional |
| `perf` | Mejora de rendimiento |
| `ci` | Cambios en CI/CD |
| `build` | Cambios en sistema de build |

### Ejemplos

```
feat(wave-manager): añadir pausa de 3 segundos entre rondas
fix(combat): corregir normalización de velocidad diagonal
test(pathfinding): agregar PBT para separación de enemigos
chore(deps): actualizar phaser a 3.61.0
refactor(hud): extraer HealthBar a componente independiente
```

### Ramas

- `main` → producción
- `develop` → integración
- `feat/<nombre-kebab>` → features
- `fix/<nombre-kebab>` → bugfixes
- `chore/<nombre-kebab>` → tareas de mantenimiento

---

## Reglas de Seguridad

### Secretos y Credenciales

- **Nunca** incluir API keys, tokens, ARNs, contraseñas ni URLs de recursos privados en el código fuente.
- Usar variables de entorno para toda configuración sensible.
- Los archivos `.env` están en `.gitignore`; usar `.env.example` con valores ficticios como plantilla.
- En Lambda, cargar secretos desde AWS Secrets Manager o Parameter Store, no desde variables de entorno para datos de alta sensibilidad.

### Validación de Inputs

- Todo input del frontend debe ser validado en el backend antes de procesarse.
- Usar [Zod](https://zod.dev/) para schema validation en Lambda handlers.
- El frontend también valida para UX, pero la validación del backend es la fuente de verdad.

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
  return SubmitScoreSchema.parse(data); // lanza ZodError si inválido
}
```

### JWT Handling

- Nunca decodificar o confiar en el JWT en el frontend para decisiones de seguridad.
- En el frontend, el JWT se usa únicamente para incluirlo en el header de cada petición.
- La validación del JWT es responsabilidad exclusiva del Cognito Authorizer en API Gateway.
- Los tokens se almacenan en memoria (no en `localStorage`) cuando sea posible para reducir riesgo XSS.

### Protección contra Abuso

- El backend valida que el `round` enviado no exceda un máximo plausible basado en la duración de la sesión (ver Req. 16.3).
- Rate limiting de login: máx. 10 intentos/minuto/IP (manejado por Cognito + WAF).

---

## Accesibilidad y Rendimiento

### Accesibilidad (UI Web, no canvas)

- Las pantallas de menú, login, leaderboard y game-over son HTML/CSS estándar.
- Contraste mínimo WCAG AA (4.5:1) en texto sobre fondo.
- Font size mínimo 12px; HUD legible entre 360px y 1920px de viewport.
- Los botones táctiles tienen tamaño mínimo de 44×44px (HUD) y 48×48px (controles de juego).
- El HUD no ocluye más del 10% del área de juego; los controles táctiles no más del 20%.

### Rendimiento

- Objetivo: 60 FPS desktop (hasta 30 enemigos simultáneos), 30 FPS móvil (hasta 20 enemigos).
- Usar **object pooling** para proyectiles y enemigos; evitar crear/destruir objetos frecuentemente en el game loop.
- Las operaciones pesadas (pathfinding, separación) se distribuyen usando el delta time de Phaser; no bloquear el game loop.
- El pathfinding actualiza a 10 Hz (cada 100ms), no en cada frame.
- Cargar el juego a estado interactivo en ≤5 segundos en conexión de 10 Mbps.
- Los assets de sprites usan sprite sheets (no imágenes individuales) para reducir draw calls.

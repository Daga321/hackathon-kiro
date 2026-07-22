# Design Document — Horde Battle Game

## Overview

Horde Battle Game es un juego de acción top-down para navegador ambientado en un cementerio nocturno. El jugador asume el rol de un **guardia de cementerio** que debe defender su territorio de oleadas de **muertos vivientes** (zombies y esqueletos) usando inicialmente solo su arma cuerpo a cuerpo (bastón/pala). Inspirado en *Boxhead* y *Brotato*.

### Diferencias clave respecto a un shooter top-down clásico

- **Combate MVP = melee exclusivo**: el Graveyard_Guard ataca en un arco de 64 px alrededor de su posición con un bastón o pala. Los ataques a distancia (proyectiles) son una característica post-MVP (Req 19).
- **Mecánica de posicionamiento**: el jugador debe acercarse a los grupos de no-muertos para golpearlos, al mismo tiempo que evita ser rodeado, generando tensión táctica desde la primera ronda.
- **Temática visual**: la Arena es un cementerio con lápidas, cercas y portones. Los sprites son pixel art de no-muertos temáticos.

### Objetivos de diseño

- **Jugabilidad fluida**: 60 fps en escritorio, 30 fps en móvil, latencia de input < 1 frame.
- **Progresión clara**: Cada ronda suma 3 no-muertos más que la anterior; la fórmula es determinista y verificable.
- **Backend sin servidores**: Lambda + DynamoDB con escalado automático; coste proporcional al uso real.
- **Seguridad por defecto**: JWT validado en cada endpoint protegido, rate-limiting en auth, validación de schema en Lambda.
- **Extensibilidad post-MVP**: Tipos de no-muertos variantes, bosses y sistema ranged definidos en archivos de configuración, no cableados en lógica de negocio.

### Alcance del MVP

El MVP cubre los Requisitos 1–16: movimiento del guardia, ataque melee, comportamiento de no-muertos, daño, rondas, HUD, game-over, autenticación, leaderboard global, lista de amigos, soporte móvil, infraestructura AWS, rendimiento, assets temáticos y seguridad. Los Requisitos 17–19 (variantes de no-muertos, bosses y ranged) son post-MVP.

---

## Architecture

<!-- Sección: Arquitectura -->

### Diagrama de arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                   BROWSER (Client)                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Phaser 3 Game Engine (WebGL)              │  │
│  │                                                      │  │
│  │  Scenes: Boot → Preload → Menu → Auth → Game →       │  │
│  │          GameOver → Leaderboard                       │  │
│  │                                                      │  │
│  │  Systems: WaveManager · CombatSystem · InputSystem   │  │
│  │           PathfindingSystem · AudioSystem            │  │
│  │                                                      │  │
│  │  GameObjects: Player · Enemy · Projectile ·          │  │
│  │               HealthBar · HUD                        │  │
│  └───────────────────────┬──────────────────────────────┘  │
│                          │ HTTPS (fetch / XHR)             │
└──────────────────────────┼──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │        Amazon CloudFront       │  ← Static assets (S3)
           │     (CDN + WAF opcional)       │
           └───────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │       Amazon API Gateway       │
           │   (REST, HTTPS only, CORS)     │
           └──────┬───────────┬────────────┘
                  │           │            │
           ┌──────┴──┐  ┌─────┴───┐  ┌────┴────┐
           │ Lambda  │  │ Lambda  │  │ Lambda  │
           │  Auth/  │  │ Leader- │  │ Friends │
           │Cognito  │  │  board  │  │ Service │
           └──────┬──┘  └─────┬───┘  └────┬────┘
                  │           │            │
           ┌──────┴───────────┴────────────┴──┐
           │           DynamoDB               │
           │  (users · scores · friends)      │
           └──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │       Amazon CloudWatch        │
           │  (Logs · Metrics · Alarms)     │
           └───────────────────────────────┘
```

### Decisiones de arquitectura

| Decisión | Elección | Justificación |
|---|---|---|
| Motor de juego | Phaser 3 (WebGL) | Maduro, soporte pixel art nativo, física Arcade integrada, comunidad activa, TypeScript friendly |
| Build | Vite | HMR instantáneo, tree-shaking, output optimizado para producción |
| Auth | Amazon Cognito User Pools | JWT OAuth 2.0 out-of-the-box, rate-limiting nativo, no requiere servidor de auth propio |
| DB | DynamoDB on-demand | Sin gestión de capacidad, pago por uso, baja latencia de lectura con GSI para leaderboard |
| Hosting | S3 + CloudFront | Assets inmutables con TTL largo, CDN global, bajo coste |
| API | API Gateway REST + Lambda | Escalado automático, sin servidores, coste por invocación |
| IaC | AWS CDK (TypeScript) | Mismo lenguaje que el backend, constructs reutilizables, validación en compilación |
| Score async | Síncrono con reintentos en cliente | Para MVP, SQS/EventBridge no justifica la complejidad adicional; se puede migrar post-MVP |

---

## Components and Interfaces

<!-- Sección: Componentes e Interfaces -->

### 1. Cliente — Phaser 3

#### Scenes

```
BootScene
  └─ Configura parámetros globales del motor (resolución, física Arcade)
  └─ Transiciona a PreloadScene

PreloadScene
  └─ Carga el asset manifest (AssetManifest.ts)
  └─ Carga todos los sprites, spritesheets y audio
  └─ Si un asset falla: log en consola + placeholder sprite (Req 15.2)
  └─ Transiciona a MenuScene

MenuScene
  └─ Muestra logo + opciones: Jugar, Leaderboard, Login/Register
  └─ Detecta si hay sesión activa (token en localStorage) y ajusta UI

AuthScene
  └─ Formulario de registro: username, email, password (validación client-side)
  └─ Formulario de login: email, password
  └─ Llama a Auth API; guarda JWT en localStorage
  └─ Redirige a MenuScene tras éxito

GameScene  [escena principal]
  └─ Inicializa: Player, WaveManager, CombatSystem, InputSystem, HUD
  └─ Loop principal: update() → InputSystem → Player movement → WaveManager → PathfindingSystem → CombatSystem → HUD
  └─ Gestiona transición a GameOverScene

GameOverScene
  └─ Muestra stats finales (ronda, enemigos, score)
  └─ Botón "Submit Score" (solo si autenticado)
  └─ Botón "Play Again" → resetea y vuelve a GameScene

LeaderboardScene
  └─ Fetches /leaderboard/global y /leaderboard/friends
  └─ Renderiza tabla con rank, username, ronda, score
  └─ Resalta la entrada del usuario autenticado
```

#### GameObjects

```typescript
// GraveyardGuard.ts  (anteriormente Player.ts)
class GraveyardGuard extends Phaser.GameObjects.Sprite {
  hp: number;              // [0, 100]
  speed: number;           // 200 px/s (constante)
  meleeRange: number;      // 64 px — rango del bastón/pala
  attackCooldown: number;  // 600 ms
  lastAttackTime: number;
  
  move(velocity: Phaser.Math.Vector2): void  // normaliza a 200 px/s
  meleeAttack(): void                        // ataca en radio PLAYER_MELEE_RANGE; respeta cooldown 600 ms
  takeDamage(amount: number): void           // clamp a 0; no puede ser negativo
  clampToArena(bounds: Phaser.Geom.Rectangle): void
}

// Undead.ts  (anteriormente Enemy.ts)
class Undead extends Phaser.GameObjects.Sprite {
  hp: number;             // > 0 mientras activo
  maxHp: number;          // 100 para zombie estándar
  speed: number;          // 80 px/s base
  meleeRange: number;     // 48 px — SIEMPRE < PLAYER_MELEE_RANGE (64 px)
  damageTick: number;     // 10 pts cada 1000 ms
  undeadType: 'zombie' | 'skeleton';  // extensible para post-MVP
  healthBar: HealthBar;
  
  update(playerPos: Phaser.Math.Vector2, delta: number): void
  takeDamage(amount: number): void
  die(): void             // animación colapso + destrucción en ≤300 ms
}

// Projectile.ts  (post-MVP, Req 19 — scaffolding mínimo en MVP)
class Projectile extends Phaser.GameObjects.Sprite {
  speed: number;          // 400 px/s
  maxRange: number;       // 400 px
  traveled: number;       // distancia acumulada
  damage: number;         // 25 pts
  
  update(delta: number): void
  onHitUndead(enemy: Undead): void
  onHitWall(): void
}

// HealthBar.ts
class HealthBar extends Phaser.GameObjects.Graphics {
  attach(enemy: Undead): void
  update(currentHp: number, maxHp: number): void
  hide(): void
  destroy(): void
}

// HUD.ts
class HUD extends Phaser.GameObjects.Container {
  updateHp(current: number, max: number): void    // rojo si < 30%
  updateRound(round: number): void
  updateEnemiesLeft(count: number): void
  updateScore(score: number): void                // en 1 frame
  showRoundIncoming(nextRound: number): void      // 3 segundos
}
```

#### Systems

```typescript
// WaveManager.ts
class WaveManager {
  currentRound: number;
  enemiesRemaining: number;

  // Fórmula: undead = 5 + (round - 1) * 3
  enemyCountForRound(round: number): number

  startRound(round: number): void
  onEnemyKilled(): void          // si enemiesRemaining === 0 → inter-round pause
  startInterRoundPause(): void   // 3 segundos, luego startRound(round+1)
}

// CombatSystem.ts
class CombatSystem {
  // MVP: solo melee del guardia contra los no-muertos
  applyPlayerMeleeAttack(guard: GraveyardGuard, enemies: Undead[]): void  // daña todos los Undead en PLAYER_MELEE_RANGE
  applyUndeadMeleeDamage(undead: Undead, guard: GraveyardGuard, delta: number): void  // 10 pts/1000 ms si ≤ 48 px
  checkGameOver(guard: GraveyardGuard): boolean

  // Post-MVP (Req 19): ranged attack
  applyProjectileDamage(projectile: Projectile, undead: Undead): void
}

// PathfindingSystem.ts
class PathfindingSystem {
  // Dirección directa al Player con separación de agentes
  // Frecuencia mínima: 10 veces/segundo (cada 100 ms)
  updateEnemyDirection(undead: Undead, playerPos: Phaser.Math.Vector2): void
  applySeparationForce(enemies: Undead[], arenaBounds: Phaser.Geom.Rectangle): void
}

// InputSystem.ts
class InputSystem {
  // Teclado (WASD + flechas) y virtual joystick (móvil)
  getMovementVector(): Phaser.Math.Vector2   // normalizado
  isAttackPressed(): boolean                 // click, tap, spacebar o botón de ataque
  getAttackTarget(): Phaser.Math.Vector2     // cursor o touch point (para post-MVP ranged)
}

// AudioSystem.ts
class AudioSystem {
  playMeleeSwing(): void       // sonido golpe del guardia
  playUndeadGroan(): void      // gemido al recibir daño
  playUndeadDeath(): void      // sonido colapso no-muerto
  playGuardHurt(): void        // sonido guardia al recibir daño
  playRoundStart(): void       // campana/ambiente inicio de ronda
}
```

#### Config

```typescript
// GameConfig.ts
export const GAME_CONFIG = {
  // Guardia de cementerio
  PLAYER_SPEED: 200,              // px/s
  PLAYER_HP: 100,
  PLAYER_MELEE_RANGE: 64,        // px — rango del bastón/pala del guardia
  PLAYER_ATTACK_COOLDOWN: 600,   // ms — tiempo entre ataques melee
  PLAYER_MELEE_DAMAGE: 30,       // HP aplicado a cada Undead en rango

  // No-muertos
  ENEMY_BASE_SPEED: 80,          // px/s
  ENEMY_HP: 100,
  ENEMY_MELEE_RANGE: 48,         // px — SIEMPRE < PLAYER_MELEE_RANGE (64 px)
  ENEMY_DAMAGE_PER_TICK: 10,
  ENEMY_DAMAGE_INTERVAL: 1000,   // ms

  // Colisión y spawn
  ENEMY_SEPARATION_RADIUS: 32,   // px
  ROUND_BASE_ENEMIES: 5,
  ROUND_ENEMY_INCREMENT: 3,
  INTER_ROUND_PAUSE: 3000,       // ms
  SPAWN_STRIP_WIDTH: 32,         // px interior al borde de la Arena
  SPAWN_MIN_DISTANCE: 100,       // px del Player al spawn
  WAVE_MANAGER_MAX_ROUNDS: 50,

  // Post-MVP (Req 19) — valores usados cuando ranged esté habilitado
  PROJECTILE_SPEED: 400,         // px/s
  PROJECTILE_RANGE: 400,         // px — SIEMPRE > ENEMY_MELEE_RANGE
  PROJECTILE_DAMAGE: 25,
  PROJECTILE_COOLDOWN: 500,      // ms
} as const;

// UndeadConfig.ts  (extensible para Req 17-18-19)
export interface UndeadDefinition {
  key: string;
  hp: number;
  speed: number;
  meleeRange: number;
  damagePerTick: number;
  scoreValue: number;
  spriteKey: string;
  animKeys: { idle: string; walk: string; attack: string; die: string };
}

// AssetManifest.ts — organizado por categoría temática
export const ASSET_MANIFEST = {
  guard: {
    idle:   { key: 'guard-idle',   path: 'assets/sprites/guard/idle.png',   frameWidth: 32, frameHeight: 32 },
    walk:   { key: 'guard-walk',   path: 'assets/sprites/guard/walk.png',   frameWidth: 32, frameHeight: 32 },
    attack: { key: 'guard-attack', path: 'assets/sprites/guard/attack.png', frameWidth: 32, frameHeight: 32 },
    hurt:   { key: 'guard-hurt',   path: 'assets/sprites/guard/hurt.png',   frameWidth: 32, frameHeight: 32 },
    death:  { key: 'guard-death',  path: 'assets/sprites/guard/death.png',  frameWidth: 32, frameHeight: 32 },
  },
  undead: {
    zombie:   { key: 'zombie',   path: 'assets/sprites/undead/zombie.png',   frameWidth: 32, frameHeight: 32 },
    skeleton: { key: 'skeleton', path: 'assets/sprites/undead/skeleton.png', frameWidth: 32, frameHeight: 32 },
  },
  arena: {
    ground:    { key: 'cemetery-ground', path: 'assets/tiles/ground.png' },
    gravestone: { key: 'gravestone',     path: 'assets/tiles/gravestone.png' },
    fence:     { key: 'cemetery-fence',  path: 'assets/tiles/fence.png' },
  },
  audio: {
    meleeSwing:   { key: 'sfx-melee-swing',   path: 'assets/audio/melee-swing.mp3' },
    undeadGroan:  { key: 'sfx-undead-groan',  path: 'assets/audio/undead-groan.mp3' },
    undeadDeath:  { key: 'sfx-undead-death',  path: 'assets/audio/undead-death.mp3' },
    guardHurt:    { key: 'sfx-guard-hurt',    path: 'assets/audio/guard-hurt.mp3' },
    roundStart:   { key: 'sfx-round-start',   path: 'assets/audio/round-start.mp3' },
    ambience:     { key: 'music-cemetery',    path: 'assets/audio/cemetery-ambience.mp3' },
  },
} as const;
```

---

### 2. Backend — Lambda + API Gateway

#### Endpoints REST

Todos los endpoints sobre HTTPS. Los marcados con 🔒 requieren JWT Bearer token en header `Authorization`.

| Método | Ruta | Lambda | Req |
|---|---|---|---|
| POST | `/auth/register` | AuthLambda | 9.1–9.3, 9.8 |
| POST | `/auth/login` | AuthLambda | 9.4–9.5 |
| POST | `/auth/logout` | AuthLambda 🔒 | 9.9 |
| GET | `/leaderboard/global` | LeaderboardLambda | 10.1–10.5 |
| POST | `/leaderboard/scores` | LeaderboardLambda 🔒 | 8.4, 10.3, 10.6 |
| GET | `/leaderboard/friends` | LeaderboardLambda 🔒 | 11.5–11.6 |
| GET | `/friends` | FriendsLambda 🔒 | 11.4 |
| POST | `/friends/request` | FriendsLambda 🔒 | 11.1 |
| POST | `/friends/accept` | FriendsLambda 🔒 | 11.2 |
| POST | `/friends/reject` | FriendsLambda 🔒 | 11.3 |
| DELETE | `/friends/{friendId}` | FriendsLambda 🔒 | 11.7 |

#### AuthLambda

```typescript
// Delega a Amazon Cognito User Pools
// POST /auth/register
//   → cognitoClient.signUp(username, email, password)
//   → dynamodb.put({ PK: userId, SK: 'profile', username, email, createdAt })
//   → retry hasta 3 veces si DynamoDB falla (Req 9.8)
//   → retorna { accessToken, refreshToken, expiresIn }

// POST /auth/login
//   → cognitoClient.initiateAuth(email, password)
//   → retorna { accessToken, refreshToken, expiresIn }

// POST /auth/logout
//   → cognitoClient.globalSignOut(accessToken)
//   → retorna { success: true }
```

#### LeaderboardLambda

```typescript
// POST /leaderboard/scores
//   1. Valida JWT (API Gateway Authorizer → Cognito)
//   2. Valida schema: { round: number, score: number, enemiesKilled: number, sessionDuration: number }
//   3. Verifica anti-cheat: round ≤ MAX_PLAUSIBLE_ROUND(sessionDuration) (Req 16.3)
//   4. dynamodb.put scores table
//   5. dynamodb.update users table (highestRound, totalScore si mejora)
//   → retorna { success: true } o HTTP 400/401/500

// GET /leaderboard/global
//   → Query GSI 'leaderboard-gsi' ordenado por highestRound DESC, score DESC, LIMIT 100
//   → Si userId autenticado no aparece en top-100, append su entrada al final
//   → retorna { entries: LeaderboardEntry[], userEntry?: LeaderboardEntry }
```

#### FriendsLambda

```typescript
// POST /friends/request  { targetUsername: string }
//   → Busca userId del targetUsername en users table
//   → dynamodb.put friends table { PK: userId, SK: friendId, status: 'pending' }

// POST /friends/accept   { requesterId: string }
//   → dynamodb.update friends { status: 'confirmed' } (ambas direcciones)

// GET /friends
//   → Query friends table PK=userId, filter status='confirmed'
//   → Batch-get usernames y highestRound de cada friendId
```

#### Modelo de seguridad

```
API Gateway → Cognito JWT Authorizer → Lambda

- Cognito Authorizer: valida firma JWT, expiración, audience
- Lambda: valida schema de body (Req 16.2), lógica anti-cheat (Req 16.3)
- Rate-limiting en /auth/login: WAF rule 10 req/min por IP (Req 16.4)
- CORS: solo origen CloudFront distribution (Req 13.7)
```

---

## Data Models

<!-- Sección: Modelos de Datos -->

### DynamoDB Tables

#### Table: `users`

```
PK: userId (string — Cognito sub)
SK: "profile"

Attributes:
  username:      string   (único, índice GSI)
  email:         string
  highestRound:  number   (default 0)
  totalScore:    number   (default 0)
  createdAt:     string   (ISO 8601)
  profileStatus: string   ("active" | "failed")  ← Req 9.8
```

#### Table: `scores`

```
PK: userId (string)
SK: timestamp (string — ISO 8601, ms precision)

Attributes:
  round:         number
  score:         number
  enemiesKilled: number
  sessionDuration: number  (segundos — para anti-cheat Req 16.3)
```

#### Table: `friends`

```
PK: userId (string)
SK: friendId (string)

Attributes:
  status:    string   ("pending" | "confirmed")
  createdAt: string   (ISO 8601)

Nota: Relación confirmed se almacena en ambas direcciones:
  { PK: A, SK: B, status: "confirmed" }
  { PK: B, SK: A, status: "confirmed" }
Para eliminar amistad se borran ambos ítems (Req 11.7).
```

#### GSI: `leaderboard-gsi` (en tabla `users`)

```
PK:   highestRound (number)  ← invertido lógicamente: se usa score negativo o sort en Lambda
SK:   totalScore   (number)

Proyección: ALL

Query pattern: Scan/Query top-100 por highestRound DESC, totalScore DESC
Implementación: DynamoDB no soporta ORDER BY DESC nativo en GSI numérico;
se usa un campo compuesto `rankKey = ZFILL(maxRound, 6) + ZFILL(score, 10)` como SK del GSI.
```

**rankKey** — clave compuesta para ordenamiento descendente:

```typescript
// rankKey = `${String(highestRound).padStart(6,'0')}#${String(totalScore).padStart(10,'0')}`
// Query: begins_with(rankKey, ...) no aplica; se hace Scan con Limit=100 + sort en memoria
// Alternativa más eficiente: PK fija "GLOBAL", SK = rankKey → permite Query ordenada
```

**Diseño final del GSI:**

```
GSI: leaderboard-gsi
  PK: leaderboardPartition = "GLOBAL"  (string, valor fijo)
  SK: rankKey = padded(highestRound) + "#" + padded(totalScore)

  → Query PK="GLOBAL" ScanIndexForward=false LIMIT 100
  → O(1) en DynamoDB, sin Scan completo
```

### Flujo de autenticación con Cognito

```
Cliente                    API Gateway          Cognito            DynamoDB
  │                             │                   │                  │
  │── POST /auth/register ─────►│                   │                  │
  │   {username,email,password} │                   │                  │
  │                             │── signUp ─────────►│                  │
  │                             │◄── userSub ────────│                  │
  │                             │                   │                  │
  │                             │── put(profile) ───────────────────────►│
  │                             │◄── ok ────────────────────────────────│
  │◄── {accessToken,            │                   │                  │
  │     refreshToken} ─────────│                   │                  │
  │                             │                   │                  │
  │── POST /auth/login ─────────►│                   │                  │
  │   {email, password}         │── initiateAuth ───►│                  │
  │                             │◄── tokens ─────────│                  │
  │◄── {accessToken} ──────────│                   │                  │
  │                             │                   │                  │
  │── GET /leaderboard/global ──►│                   │                  │
  │   Authorization: Bearer JWT │── validateJWT ────►│                  │
  │                             │◄── claims ─────────│                  │
  │                             │── Query GSI ──────────────────────────►│
  │                             │◄── entries ───────────────────────────│
  │◄── {entries} ──────────────│                   │                  │
```

**Token lifecycle:**
- `accessToken`: válido 1 hora (configurable en Cognito)
- `refreshToken`: válido 30 días; el cliente refresca automáticamente
- Logout → `GlobalSignOut` invalida todos los tokens del usuario (Req 9.9)
- Sesión "24 horas desde último request" (Req 9.6): implementado configurando `accessToken` TTL en Cognito + refresh automático en cada request autenticado

---

## Correctness Properties

<!-- Sección: Propiedades de Corrección -->

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema. Las propiedades sirven como puente entre las especificaciones legibles por humanos y las garantías de corrección verificables por máquina.*


### Property 1: Player y Enemy siempre permanecen dentro de los límites de la Arena

*Para cualquier* posición de Player o Enemy y cualquier vector de movimiento o fuerza aplicada, después de procesar el movimiento, la posición resultante SHALL estar dentro de los límites de la Arena (x ∈ [0, arenaWidth], y ∈ [0, arenaHeight]).

Esta propiedad cubre el clamping del Player (Req 1.2), la recalculación de dirección de Enemy en frontera (Req 3.3) y el clamping de la fuerza de separación entre enemigos (Req 3.4).

**Validates: Requirements 1.2, 3.3, 3.4**

---

### Property 2: La velocidad de movimiento siempre es exactamente 200 px/s para el Guardia

*Para cualquier* combinación válida de inputs direccionales (incluyendo diagonales), el módulo del vector de velocidad del Graveyard_Guard SHALL ser exactamente 200 px/s (con tolerancia de ε = 0.001 px/s por aritmética de punto flotante).

**Validates: Requirements 1.1, 1.5**

---

### Property 3: El rango de melee del Guardia siempre excede el rango de melee de los no-muertos

*Para cualquier* configuración válida del juego (incluyendo tipos de no-muertos post-MVP), el valor de `PLAYER_MELEE_RANGE` (64 px) SHALL ser estrictamente mayor que `ENEMY_MELEE_RANGE` (48 px) para todo tipo de Undead definido en UndeadConfig.

**Validates: Requirements 2.3**

---

### Property 4: El ataque melee del guardia aplica exactamente 30 puntos a cada no-muerto en rango

*Para cualquier* conjunto de N Undead (N ≥ 1) dentro de PLAYER_MELEE_RANGE en el momento del ataque, el Combat_System SHALL aplicar exactamente 30 puntos de daño a cada uno de ellos — ni más ni menos — independientemente de su HP actual.

**Validates: Requirements 2.5**

---

### Property 5: El cooldown de ataque garantiza máximo 1 ataque melee cada 600 ms

*Para cualquier* secuencia de inputs de ataque, el CombatSystem SHALL garantizar que no haya dos Melee_Attacks procesados con menos de 600 ms de diferencia entre sí; inputs en cooldown se descartan silenciosamente.

**Validates: Requirements 2.7**

---

### Property 6: Un ataque melee sin enemigos en rango no causa efectos de daño

*Para cualquier* estado de juego en que no hay Undead dentro de PLAYER_MELEE_RANGE cuando el Graveyard_Guard ataca, el Combat_System SHALL ejecutar la animación de swing pero no SHALL aplicar daño a ningún objeto del juego.

**Validates: Requirements 2.6**

---

### Property 7: La fuerza de separación entre enemigos elimina solapamientos sin sacarlos de la Arena

*Para cualquier* cluster de N Enemies (N ≥ 2) cuyos centros estén dentro de 32 px entre sí, después de aplicar la fuerza de separación: (a) ningún par de Enemies tendrá sus centros a menos de 32 px, y (b) ningún Enemy estará fuera de los límites de la Arena.

**Validates: Requirements 3.4**

---

### Property 8: La velocidad base de los Enemies estándar es siempre 80 px/s

*Para cualquier* Enemy estándar y cualquier posición del Player dentro de la Arena, el módulo del vector de velocidad del Enemy SHALL ser exactamente 80 px/s mientras no esté en estado de separación de colisión.

**Validates: Requirements 3.2**

---

### Property 9: El HP del Player nunca cae por debajo de 0

*Para cualquier* secuencia de eventos de daño aplicados al Player (de cualquier fuente, con cualquier magnitud), el HP del Player SHALL permanecer en el rango [0, 100] en todo momento. HP no puede ser negativo.

**Validates: Requirements 5.2**

---

### Property 10: La barra de HP de un Enemy refleja el ratio hp/maxHp con precisión

*Para cualquier* Enemy con HP actual en (0, maxHp), el ancho visual de la HealthBar SHALL ser proporcional a `hp / maxHp` con una tolerancia de ε = 0.01 (1%).

**Validates: Requirements 4.3**

---

### Property 11: Matar un Enemy siempre suma exactamente 10 puntos al score

*Para cualquier* Enemy (independientemente de cuánto daño de overkill reciba), cuando su HP llega a 0 o menos, el score del Player SHALL incrementar en exactamente 10 puntos — ni más ni menos.

**Validates: Requirements 4.5**

---

### Property 12: La fórmula de enemigos por ronda es exactamente 5 + (round − 1) × 3

*Para cualquier* número de ronda r ∈ [1, 50], el WaveManager SHALL calcular `enemyCountForRound(r) = 5 + (r - 1) * 3`, produciendo un entero positivo. Para r=1: 5; para r=50: 152.

**Validates: Requirements 6.1, 6.4, 6.7**

---

### Property 13: Las posiciones de spawn de enemigos respetan la distancia mínima del Player

*Para cualquier* posición del Player dentro de la Arena y cualquier número de ronda, todas las posiciones de spawn generadas por el WaveManager SHALL estar: (a) dentro de la franja de 32 px interior al borde de la Arena, y (b) a una distancia ≥ 100 px del centro del Player.

**Validates: Requirements 6.2**

---

### Property 14: La pantalla de game-over muestra exactamente los datos de la sesión finalizada

*Para cualquier* estado de sesión (ronda alcanzada r, enemigos eliminados k, score s), cuando se dispara el game-over, el overlay SHALL mostrar exactamente los valores r, k y s — sin truncar, redondear ni alterar ninguno de ellos.

**Validates: Requirements 8.2**

---

### Property 15: "Play Again" restablece el estado del juego a valores iniciales exactos

*Para cualquier* estado de juego en curso (HP arbitrario, ronda arbitraria, n enemigos vivos), al activar "Play Again", el sistema SHALL producir un estado nuevo con: HP = 100, round = 1, enemies = [] (vacío), score = 0.

**Validates: Requirements 8.5**

---

### Property 16: La validación de contraseña acepta exactamente longitudes entre 8 y 72 caracteres

*Para cualquier* string candidato a contraseña, el Auth_Service SHALL aceptarlo si y solo si `length ∈ [8, 72]` (inclusive). Cualquier longitud fuera de este rango SHALL ser rechazada con un error que identifica el campo `password`.

**Validates: Requirements 9.1, 9.3**

---

### Property 17: La lógica de reintentos del registro respeta el límite de 3 intentos

*Para cualquier* número n de fallos consecutivos de DynamoDB: si n ≤ 3, el Auth_Service SHALL realizar exactamente n reintentos y eventualmente devolver un token válido; si n > 3, SHALL marcar el perfil como `permanently_failed` y no realizar más reintentos.

**Validates: Requirements 9.8**

---

### Property 18: El leaderboard está ordenado por (highestRound DESC, totalScore DESC) en todos los contextos

*Para cualquier* conjunto de entradas de usuarios (global o de amigos), el servicio SHALL devolver la lista ordenada tal que para todo par de entradas consecutivas (i, i+1): `entry[i].highestRound ≥ entry[i+1].highestRound`; y si son iguales en ronda: `entry[i].totalScore ≥ entry[i+1].totalScore`.

**Validates: Requirements 10.1, 11.5**

---

### Property 19: El leaderboard global retorna como máximo 100 entradas

*Para cualquier* número N de usuarios registrados (N puede ser cualquier entero positivo), la respuesta de `GET /leaderboard/global` SHALL contener a lo sumo 100 entradas.

**Validates: Requirements 10.2**

---

### Property 20: Cada entrada del leaderboard contiene los cuatro campos requeridos

*Para cualquier* entrada de leaderboard (global o de amigos), el objeto retornado SHALL contener todos los campos: `rank`, `username`, `highestRound` y `totalScore` — ninguno puede ser nulo o ausente.

**Validates: Requirements 10.4, 11.4, 11.6**

---

### Property 21: Los endpoints protegidos rechazan con HTTP 401 cualquier token inválido

*Para cualquier* request a un endpoint protegido con un token inválido (ausente, expirado, malformado o de usuario revocado), el sistema SHALL retornar exactamente HTTP 401 — sin procesar la solicitud ni revelar datos.

**Validates: Requirements 10.6, 16.1**

---

### Property 22: Eliminar una amistad la remueve de ambas listas inmediatamente

*Para cualquier* par de usuarios A y B con amistad confirmada, cuando A elimina la amistad: ni A aparece en la lista de amigos de B, ni B aparece en la lista de amigos de A, inmediatamente tras la operación.

**Validates: Requirements 11.7**

---

### Property 23: El anti-cheat rechaza rondas imposibles dado el tiempo de sesión

*Para cualquier* par (sessionDuration, claimedRound), el Leaderboard_Service SHALL rechazar la submisión cuando `claimedRound > MAX_PLAUSIBLE_ROUND(sessionDuration)`, donde `MAX_PLAUSIBLE_ROUND(d) = floor(d / MIN_ROUND_DURATION_SECONDS)`.

**Validates: Requirements 16.3**

---

### Property 24: El HUD muestra la salud en rojo si y solo si HP < 30% del máximo

*Para cualquier* valor de HP del Player: si `hp < 0.30 * maxHp`, el indicador SHALL renderizarse en rojo; si `hp ≥ 0.30 * maxHp`, SHALL renderizarse en el color por defecto. La transición es inmediata y bidireccional.

**Validates: Requirements 7.3, 7.4**

---

## Error Handling

### Errores del cliente (Phaser)

| Situación | Comportamiento |
|---|---|
| Asset no encontrado | Log en consola + sprite placeholder (Req 15.2) |
| Fallo de red en submit score | Mostrar mensaje de error + retener botón "Submit Score" (Req 8.6) |
| Error no-red en submit score | Ocultar botón + mensaje genérico, log silencioso (Req 8.7) |
| Browser sin WebGL | Mensaje + link a browser compatible (Req 14.5) |
| Token expirado en request | Intentar refresh automático con refreshToken; si falla → redirect a AuthScene |
| Orientación de dispositivo cambia | Pause → recalcular layout → resume en ≤200 ms (Req 12.6) |

### Errores del backend (Lambda)

| Situación | HTTP | Comportamiento |
|---|---|---|
| JWT ausente o inválido | 401 | Rechazar sin procesar; no revelar detalles |
| Schema de body inválido | 400 | Mensaje descriptivo con campo fallido (Req 16.2) |
| Credenciales de login incorrectas | 401 | Mensaje genérico; no especificar email vs. password (Req 9.5) |
| Rate limit excedido en login | 429 | Req 16.4 |
| Excepción no manejada en Lambda | 500 | Log full stack trace en CloudWatch (Req 13.6) |
| DynamoDB inaccesible al registrar | 500 → reintentos | 3 reintentos a 5 min (Req 9.8) |
| Submit score con ronda imposible | 400 | Anti-cheat (Req 16.3) |
| Leaderboard update falla | 500 | Log error, retornar 500 (Req 10.3) |

### Invariantes de estado del juego

- `player.hp ∈ [0, 100]` en todo momento
- `enemy.hp > 0` mientras el Enemy está activo en la Arena (se destruye cuando llega a 0)
- `projectile.traveled ≤ 400` en todo momento (si supera, se destruye)
- Ningún GameObject fuera de los límites de la Arena

---

## Testing Strategy

### Enfoque dual: Unit tests + Property-Based Tests

Esta feature involucra lógica de juego con invariantes matemáticos claros (física, fórmulas de rondas, ordenamiento), lo que la hace apta para property-based testing (PBT). El PBT se aplica a la lógica pura del cliente y al backend; **no** se aplica a la infraestructura AWS (IaC, Cognito, DynamoDB) ni al rendering visual.

### Herramientas

| Contexto | Framework PBT | Framework Unit |
|---|---|---|
| Cliente TypeScript (Phaser) | [fast-check](https://github.com/dubzzz/fast-check) | Vitest |
| Backend Lambda (Node.js/TS) | [fast-check](https://github.com/dubzzz/fast-check) | Vitest / Jest |
| IaC (CDK) | N/A — snapshot tests | AWS CDK Assertions |
| Integración | N/A | Supertest + DynamoDB Local |

### Unit Tests — Ejemplos y casos límite

Los unit tests cubren:
- Comportamiento específico de escenas (MenuScene, AuthScene, GameOverScene)
- Eventos de estado exactos: game-over en HP=0, inter-round pause, submit score success/failure
- Seguridad: error genérico en login, 401 en endpoints protegidos
- UI: HealthBar aparece en primer daño, se oculta en death animation
- Mobile: virtual joystick y fire button presentes en touch device

### Property-Based Tests — Configuración

Cada test de propiedad usa fast-check con **mínimo 100 iteraciones**. Cada test referencia su propiedad de diseño mediante un comentario tag:

```typescript
// Feature: horde-battle-game, Property N: <texto de la propiedad>
it('Property N: <título>', () => {
  fc.assert(fc.property(
    fc./* arbitraries */,
    (input) => {
      // verificación de la propiedad
    }
  ), { numRuns: 100 });
});
```

### Cobertura por propiedad

| Property | Tipo PBT | Arbitraries necesarios |
|---|---|---|
| P1: Arena bounds | Invariant | `fc.float(0, W)`, `fc.float(0, H)`, `fc.float(-500, 500)` velocidad |
| P2: Player speed normalization | Invariant | `fc.constantFrom` de combinaciones direccionales |
| P3: Projectile range | Round-trip / Invariant | `fc.float` ángulo, posición origen |
| P4: Proj range > melee range | Structural | `fc.record` EnemyDefinition |
| P5: Projectile damage = 25 | Invariant | `fc.integer(1, 1000)` HP enemigo |
| P6: Fire cooldown ≥ 500 ms | Invariant | `fc.array` de timestamps de disparo |
| P7: Separation force + Arena | Metamorphic | `fc.array(fc.record(pos))` clusters de enemigos |
| P8: Enemy speed = 80 px/s | Invariant | `fc.record` posiciones Player/Enemy |
| P9: Player HP ∈ [0, 100] | Invariant | `fc.array(fc.integer(0, 200))` daños |
| P10: HealthBar ratio | Invariant | `fc.integer(1, 99)` HP fraccional |
| P11: Score += 10 exacto | Invariant | `fc.integer(1, 200)` damage amounts |
| P12: Wave formula | Mathematical | `fc.integer(1, 50)` round number |
| P13: Spawn distance ≥ 100 | Invariant | `fc.record` player pos + arena bounds |
| P14: Game-over overlay data | Round-trip | `fc.record` session state |
| P15: Play Again reset | Invariant | `fc.record` arbitrary game state |
| P16: Password length validation | Boundary | `fc.string` de longitud 1-100 |
| P17: DynamoDB retry logic | State machine | `fc.integer(0, 5)` n failures |
| P18: Leaderboard sort order | Invariant | `fc.array(fc.record(entry))` |
| P19: Leaderboard max 100 | Count invariant | `fc.integer(0, 500)` N users |
| P20: Leaderboard fields complete | Structural | `fc.array(fc.record(entry))` |
| P21: 401 on invalid token | Security invariant | `fc.oneof` token variants |
| P22: Friendship bidirectional delete | Round-trip | `fc.record` user pair |
| P23: Anti-cheat plausibility | Metamorphic | `fc.integer` sessionDuration, round |
| P24: HUD color threshold | Threshold invariant | `fc.integer(0, 100)` HP value |

### Integration Tests

Para los requisitos de infraestructura (DynamoDB, Cognito, Lambda-to-DB wiring), se usan integration tests con 1–3 ejemplos representativos:

- Submit score → verifica que aparece en DynamoDB
- Register → verifica Cognito user + DynamoDB profile
- Login + token → verifica acceso a endpoint protegido
- Logout → verifica token invalidado

### CDK Snapshot Tests

Los recursos de infraestructura se validan mediante:

```typescript
// CDK Assertions
template.hasResourceProperties('AWS::DynamoDB::Table', { BillingMode: 'PAY_PER_REQUEST' });
template.hasResourceProperties('AWS::CloudFront::Distribution', { /* ... */ });
```

### Tests de Rendimiento (no PBT)

- 60 fps con 30 enemigos: medición con Chrome DevTools Performance API
- Carga inicial < 5 segundos: Lighthouse CI en pipeline
- p99 Lambda < 2000 ms: CloudWatch metrics + alarma

---

*Design document generado para horde-battle-game — Requirements-First workflow.*

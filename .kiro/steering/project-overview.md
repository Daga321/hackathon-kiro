---
inclusion: auto
---

# Visión General del Proyecto: Horde Battle Game

## Descripción del Proyecto

**Horde Battle Game** es un juego de acción top-down para navegador ambientado en un **cementerio nocturno**. El jugador encarna a un **guardia de cementerio** que debe defender su territorio de oleadas de **muertos vivientes** (zombies y esqueletos) usando primero su arma cuerpo a cuerpo (bastón/pala). Inspirado en Boxhead y Brotato.

**Características clave del dominio:**
- El personaje es un guardia de cementerio con ataque melee exclusivo en el MVP
- Los enemigos son no-muertos (Undead): zombies, esqueletos y variantes post-MVP
- La arena es un cementerio con lápidas, cercas y portones en pixel art
- El ataque a distancia (proyectiles) es una funcionalidad post-MVP

El juego opera en navegadores web de escritorio y móvil sin necesidad de instalación ni plugins. Cuenta con un backend en AWS para autenticación de usuarios, rankings globales, lista de amigos y clasificaciones entre amigos.

### Objetivos Principales

- Juego completamente funcional en navegador (desktop y móvil)
- Arquitectura serverless escalable y de bajo costo en AWS
- Sistema de autenticación seguro con Cognito
- Rankings globales y entre amigos persistidos en DynamoDB
- Rendimiento mínimo de 60 FPS en desktop y 30 FPS en móvil

---

## Stack Tecnológico

### Frontend

| Tecnología | Versión | Rol |
|------------|---------|-----|
| TypeScript | 5.x | Lenguaje principal |
| Phaser 3 | 3.60+ | Motor de juego |
| Vite | 5.x | Bundler y dev server |
| Vitest | 1.x | Testing unitario |
| fast-check | 3.x | Property-Based Testing |

### Backend (AWS Serverless)

| Servicio | Rol |
|----------|-----|
| AWS Lambda (Node.js 20) | Lógica de negocio de la API |
| Amazon API Gateway (HTTP API) | Exposición de endpoints REST/HTTPS |
| Amazon DynamoDB | Persistencia de perfiles, scores y amigos |
| Amazon Cognito User Pools | Autenticación y gestión de sesiones (JWT/OAuth 2.0) |

### Infraestructura y Despliegue

| Servicio | Rol |
|----------|-----|
| Amazon S3 | Almacenamiento de assets estáticos del frontend |
| Amazon CloudFront | CDN para servir el frontend con TTL ≥ 86400s |
| AWS CDK (TypeScript) | Infraestructura como código |
| AWS WAF | Protección de la API y el CDN |
| Amazon Route 53 | Gestión DNS |
| AWS Certificate Manager | Certificados TLS/SSL |
| Amazon CloudWatch | Logging, métricas y alarmas |

### Tooling

- **Package manager**: npm
- **Linting**: ESLint + typescript-eslint
- **Formatting**: Prettier
- **CI/CD**: GitHub Actions

---

## Estructura del Proyecto

```
hackathon-kiro/
├── .kiro/
│   ├── specs/
│   │   └── horde-battle-game/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       └── tasks.md
│   └── steering/
│       ├── project-overview.md   ← este archivo
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
│   │   ├── main.ts                 # Punto de entrada Vite + Phaser config
│   │   ├── config/
│   │   │   ├── game-config.ts      # Configuración global de Phaser
│   │   │   ├── asset-manifest.ts   # Mapa llave → ruta de todos los assets
│   │   │   └── constants.ts        # PLAYER_SPEED, PROJECTILE_RANGE, etc.
│   │   ├── scenes/
│   │   │   ├── BootScene.ts        # Precarga mínima + transición a Preload
│   │   │   ├── PreloadScene.ts     # Carga de todos los assets con barra de progreso
│   │   │   ├── MenuScene.ts        # Menú principal, login/registro UI
│   │   │   ├── GameScene.ts        # Escena principal de juego
│   │   │   ├── HUDScene.ts         # Overlay HUD (vida, ronda, score, controles)
│   │   │   ├── GameOverScene.ts    # Pantalla de game over y submit score
│   │   │   └── LeaderboardScene.ts # Rankings global y de amigos
│   │   ├── game-objects/
│   │   │   ├── Player.ts
│   │   │   ├── Enemy.ts
│   │   │   ├── Projectile.ts
│   │   │   └── HealthBar.ts
│   │   ├── systems/
│   │   │   ├── CombatSystem.ts     # Cálculo y aplicación de daño
│   │   │   ├── WaveManager.ts      # Generación y control de rondas
│   │   │   ├── PathfindingSystem.ts# Navegación de enemigos hacia el jugador
│   │   │   ├── InputHandler.ts     # Teclado, mouse y controles táctiles
│   │   │   └── ScoreSystem.ts      # Tracking de puntuación en sesión
│   │   ├── ui/
│   │   │   ├── VirtualJoystick.ts  # Joystick on-screen para móvil
│   │   │   ├── FireButton.ts       # Botón de disparo para móvil
│   │   │   └── RoundNotification.ts
│   │   ├── services/
│   │   │   ├── AuthService.ts      # Wrapper de Cognito (login, register, logout)
│   │   │   ├── LeaderboardService.ts
│   │   │   ├── FriendsService.ts
│   │   │   └── ApiClient.ts        # Cliente HTTP base con JWT interceptor
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
│   │       ├── LambdaFunction.ts   # Construct reutilizable
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

## Patrones de Arquitectura Clave

### Frontend: Scene-based Architecture (Phaser 3)

Cada estado del juego es una `Phaser.Scene` independiente. Las escenas se comunican mediante el EventEmitter global de Phaser o datos pasados en `scene.start()`. El HUD corre como una escena paralela (`scene.launch()`) sobre la GameScene.

```
BootScene → PreloadScene → MenuScene ⇄ GameScene + HUDScene → GameOverScene
                                     ↕
                               LeaderboardScene
```

### Backend: Handler → Service → Repository

Cada Lambda handler se limita a parsear el input y delegar en un Service. Los Services contienen la lógica de negocio. Los Repositories abstraen las operaciones de DynamoDB.

```
API Gateway → Lambda Handler → Service → Repository → DynamoDB
                    ↓
              Cognito Authorizer (endpoints protegidos)
```

### Comunicación Frontend ↔ Backend

- `ApiClient.ts` es el único punto de salida HTTP del frontend
- Todas las peticiones incluyen el JWT de Cognito en el header `Authorization: Bearer <token>`
- API Gateway valida el JWT con el Cognito Authorizer antes de invocar la Lambda

### Separación de Sistemas de Juego

Los sistemas de juego (`CombatSystem`, `WaveManager`, `PathfindingSystem`) son clases independientes sin estado global. Reciben referencias a los objetos que necesitan operar y emiten eventos a través de Phaser EventEmitter. Esto facilita el testing unitario.

---

## Contexto del Dominio del Juego

### Mecánicas Principales (MVP)

| Mecánica | Descripción |
|----------|-------------|
| **Personaje** | Guardia de cementerio — sprite pixel art con animaciones idle, walk, attack, hurt, death. |
| **Movimiento** | WASD/flechas en desktop, joystick virtual en móvil. Velocidad 200px/s, diagonal normalizada. |
| **Ataque melee** | Click/tap/spacebar → swing del bastón/pala en radio 64px. Daño 30 HP a todos los Undead en rango. Cooldown 600ms. |
| **No-muertos** | Zombies y esqueletos persiguen al guardia a 80px/s. Pathfinding 10 veces/seg. Daño cuerpo a cuerpo si están a ≤48px. |
| **Daño recibido** | 10 HP/s por cada Undead a ≤48px del guardia (ticks independientes). |
| **Oleadas** | Ronda 1: 5 no-muertos. Cada ronda suma 3 más. Pausa de 3s entre rondas. |
| **Puntuación** | 10 puntos por no-muerto eliminado. Se persiste al finalizar si el usuario está autenticado. |
| **Game Over** | Guardia muere → overlay con stats → opción de submit score y play again. |

### Constantes del Dominio

```typescript
// src/config/constants.ts
export const PLAYER_SPEED = 200;              // px/s
export const PLAYER_MELEE_RANGE = 64;         // px — bastón/pala del guardia
export const PLAYER_ATTACK_COOLDOWN_MS = 600; // ms
export const PLAYER_MELEE_DAMAGE = 30;        // HP por swing
export const ENEMY_SPEED = 80;                // px/s
export const ENEMY_MELEE_RANGE = 48;          // px — SIEMPRE < PLAYER_MELEE_RANGE
export const ENEMY_MELEE_DAMAGE = 10;         // HP por segundo
export const ENEMY_SEPARATION_DISTANCE = 32;  // px
export const ENEMY_BASE_HP = 100;             // HP zombie estándar
export const ENEMY_SCORE_VALUE = 10;          // puntos
export const PLAYER_MAX_HP = 100;             // HP
export const ROUND_START_ENEMIES = 5;
export const ROUND_ENEMY_INCREMENT = 3;
export const INTER_ROUND_PAUSE_MS = 3000;
export const PATHFINDING_UPDATE_HZ = 10;
export const ENEMY_SPAWN_BORDER_PX = 32;
export const ENEMY_MIN_SPAWN_DISTANCE = 100;

// Post-MVP (Req 19) — disponibles cuando ranged esté habilitado
export const PROJECTILE_SPEED = 400;          // px/s
export const PROJECTILE_RANGE = 400;          // px
export const PROJECTILE_DAMAGE = 25;
export const PROJECTILE_COOLDOWN_MS = 500;
```

### Características Post-MVP

- **Variedad de no-muertos**: Esqueleto rápido (140px/s) desde ronda 10; lanzador de huesos desde ronda 15
- **Jefes (Bosses)**: Zombie gigante o Señor no-muerto en rondas múltiplo de 10; 1000 HP, 500 pts bonus
- **Ataque a distancia (Req 19)**: El guardia desbloquea un arma ranged (agua bendita, pistola de bengalas, etc.)

### Flujo de Usuario Típico

1. Usuario abre el juego en el navegador (servido desde CloudFront)
2. Puede jugar sin cuenta o registrarse/iniciar sesión (Cognito)
3. Juega partidas, acumulando puntuación por rondas superadas
4. Al morir, puede enviar su score al leaderboard global
5. Puede consultar el ranking global (top 100) y el ranking de amigos
6. Puede enviar/aceptar solicitudes de amistad por username

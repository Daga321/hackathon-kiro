# Implementation Plan: Horde Battle Game

<!-- Plan de Implementación: Horde Battle Game -->

## Overview

Plan de implementación incremental para Horde Battle Game: un juego top-down de oleadas de enemigos con cliente Phaser 3 + TypeScript (Vite), backend serverless AWS (Lambda + DynamoDB + Cognito) e infraestructura como código con CDK. Las tareas siguen el orden: setup → lógica de juego → backend → infraestructura → integración → tests finales.

## Tasks

- [ ] 1. Setup del proyecto y estructura base
  - [ ] 1.1 Inicializar proyecto Vite + TypeScript + Phaser 3
    - Crear `package.json` con dependencias: `phaser@^3.80`, `vite@^5`, `typescript@^5`, `vitest@^1`, `fast-check@^3`
    - Crear `vite.config.ts` con `base: './'`, resolución de alias `@/` → `src/`
    - Crear `tsconfig.json` con `strict: true`, `target: ES2022`, paths `@/*`
    - Crear estructura de directorios: `src/scenes/`, `src/objects/`, `src/systems/`, `src/config/`, `src/api/`, `src/types/`
    - Crear `src/main.ts` con configuración mínima de Phaser (800×600, physics Arcade)
    - _Requirements: 13.4, 14.1, 14.2_
  - [ ] 1.2 Crear archivos de configuración central del juego
    - Escribir `src/config/GameConfig.ts` con todas las constantes: `PLAYER_SPEED`, `PLAYER_HP`, `PLAYER_FIRE_COOLDOWN`, `PROJECTILE_SPEED`, `PROJECTILE_RANGE`, `PROJECTILE_DAMAGE`, `ENEMY_BASE_SPEED`, `ENEMY_HP`, `ENEMY_MELEE_RANGE`, `ENEMY_DAMAGE_PER_TICK`, `ENEMY_DAMAGE_INTERVAL`, `ENEMY_SEPARATION_RADIUS`, `ROUND_BASE_ENEMIES`, `ROUND_ENEMY_INCREMENT`, `INTER_ROUND_PAUSE`, `SPAWN_STRIP_WIDTH`, `SPAWN_MIN_DISTANCE`, `WAVE_MANAGER_MAX_ROUNDS`
    - Escribir `src/config/AssetManifest.ts` con estructura `sprites`, `spritesheets`, `audio` con placeholders
    - Escribir `src/config/EnemyConfig.ts` con interface `EnemyDefinition` y configuración del enemigo estándar
    - _Requirements: 1.1, 2.2, 2.3, 3.2, 5.1, 6.1, 6.4, 15.1, 15.3_
  - [ ] 1.3 Definir tipos TypeScript compartidos
    - Escribir `src/types/index.ts` con interfaces: `LeaderboardEntry`, `UserSession`, `GameSessionData`, `ScoreSubmission`, `FriendEntry`, `ApiResponse<T>`, `EnemyDefinition`
    - _Requirements: 10.4, 11.4, 11.6_

- [ ] 2. Implementar escenas de Phaser (Boot, Preload, Menu, Auth)
  - [ ] 2.1 Implementar `BootScene`
    - Crear `src/scenes/BootScene.ts` extendiendo `Phaser.Scene`
    - Configurar parámetros globales del motor: resolución 800×600, gravity 0, pixelArt true
    - Transicionar a `PreloadScene` al completar `create()`
    - _Requirements: 14.1_
  - [ ] 2.2 Implementar `PreloadScene`
    - Crear `src/scenes/PreloadScene.ts`
    - Iterar `ASSET_MANIFEST.sprites`, `spritesheets` y `audio` para cargar cada recurso con `this.load`
    - En callback `loaderror`: log en consola + sustituir con placeholder sprite 16×16 magenta
    - Mostrar barra de progreso durante la carga
    - Transicionar a `MenuScene` al finalizar
    - _Requirements: 15.1, 15.2, 15.4_
  - [ ] 2.3 Implementar `MenuScene`
    - Crear `src/scenes/MenuScene.ts`
    - Mostrar logo y botones: "Jugar", "Leaderboard", "Login / Register"
    - Leer token de `localStorage`; si existe, sustituir botón Login por "Logout" y mostrar username
    - Navegar a `GameScene`, `LeaderboardScene` o `AuthScene` según selección
    - _Requirements: 9.7_
  - [ ] 2.4 Implementar `AuthScene`
    - Crear `src/scenes/AuthScene.ts`
    - Formulario de registro: campos username, email (validar regex `local-part@domain.tld`), password (8–72 chars)
    - Formulario de login: campos email, password
    - Llamar a `AuthApi.register()` / `AuthApi.login()`; guardar JWT en `localStorage`
    - Mostrar errores descriptivos de campo en la UI; redirigir a `MenuScene` tras éxito
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 3. Implementar GameObjects: Player, Enemy, Projectile, HealthBar, HUD
  - [ ] 3.1 Implementar `Player`
    - Crear `src/objects/Player.ts` extendiendo `Phaser.GameObjects.Sprite`
    - Propiedades: `hp = PLAYER_HP`, `speed = PLAYER_SPEED`, `fireCooldown = PLAYER_FIRE_COOLDOWN`, `lastFireTime`
    - Método `move(velocity: Vector2)`: normalizar a 200 px/s; animar con walk/idle según dirección
    - Método `clampToArena(bounds: Rectangle)`: limitar posición a límites de Arena
    - Método `takeDamage(amount: number)`: reducir HP, clamp a 0; no puede ser negativo
    - Método `shoot(targetX, targetY)`: respetar cooldown de 500 ms; crear Projectile si cooldown cumplido
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.9, 5.2_
  - [ ] 3.2 Implementar `Enemy`
    - Crear `src/objects/Enemy.ts` extendiendo `Phaser.GameObjects.Sprite`
    - Propiedades: `hp = ENEMY_HP`, `maxHp`, `speed = ENEMY_BASE_SPEED`, `meleeRange`, `damageTick`, `healthBar`
    - Método `takeDamage(amount)`: reducir HP; mostrar HealthBar en primer daño; si HP ≤ 0 llamar `die()`
    - Método `die()`: iniciar animación; ocultar HealthBar; destruir sprite en ≤ 300 ms
    - Método `update(playerPos, delta)`: delegado a PathfindingSystem para dirección
    - _Requirements: 3.2, 4.1, 4.2, 4.4, 4.6_
  - [ ] 3.3 Implementar `Projectile`
    - Crear `src/objects/Projectile.ts` extendiendo `Phaser.GameObjects.Sprite`
    - Propiedades: `speed = PROJECTILE_SPEED`, `maxRange = PROJECTILE_RANGE`, `traveled = 0`, `damage = PROJECTILE_DAMAGE`
    - Método `update(delta)`: mover en dirección, acumular `traveled`; destruir al alcanzar 400 px
    - Método `onHitEnemy(enemy)`: aplicar 25 pts daño; destruir proyectil
    - Método `onHitWall()`: destruir proyectil sin daño
    - _Requirements: 2.2, 2.3, 2.6, 2.7, 2.8_
  - [ ] 3.4 Implementar `HealthBar`
    - Crear `src/objects/HealthBar.ts` extendiendo `Phaser.GameObjects.Graphics`
    - Método `attach(enemy)`: posicionar sobre el sprite del Enemy
    - Método `update(currentHp, maxHp)`: recalcular ancho proporcionalmente (tolerancia 1%)
    - Métodos `hide()` y `destroy()`
    - _Requirements: 4.2, 4.3, 4.4, 4.6_
  - [ ] 3.5 Implementar `HUD`
    - Crear `src/objects/HUD.ts` extendiendo `Phaser.GameObjects.Container`
    - Métodos: `updateHp(current, max)` — rojo si `hp < 0.30 * maxHp`, color default si ≥ 30%
    - Métodos: `updateRound(n)`, `updateEnemiesLeft(n)`, `updateScore(n)` — actualizar en 1 frame
    - Método `showRoundIncoming(nextRound)`: mostrar "Round [N] incoming" durante 3 segundos
    - Asegurar que el HUD no ocluya > 10% del playfield; font ≥ 12 px; contraste ≥ 4.5:1
    - _Requirements: 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 4. Implementar sistemas del juego (WaveManager, CombatSystem, PathfindingSystem, InputSystem, AudioSystem)
  - [ ] 4.1 Implementar `WaveManager`
    - Crear `src/systems/WaveManager.ts`
    - Propiedad `currentRound = 1`, `enemiesRemaining`
    - Método `enemyCountForRound(round)`: retornar `5 + (round - 1) * 3`; soportar hasta round 50 → 152 enemies
    - Método `startRound(round)`: spawn de enemigos en franja de 32 px interior al borde, distancia ≥ 100 px del Player
    - Método `onEnemyKilled()`: decrementar `enemiesRemaining`; si llega a 0 → `startInterRoundPause()`
    - Método `startInterRoundPause()`: esperar 3000 ms, luego `startRound(round + 1)`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_
  - [ ]* 4.2 Escribir property test para WaveManager (fórmula de enemigos)
    - **Property 12: La fórmula de enemigos por ronda es exactamente 5 + (round − 1) × 3**
    - **Validates: Requirements 6.1, 6.4, 6.7**
  - [ ]* 4.3 Escribir property test para WaveManager (posiciones de spawn)
    - **Property 13: Las posiciones de spawn respetan la distancia mínima del Player**
    - **Validates: Requirements 6.2**
  - [ ] 4.4 Implementar `CombatSystem`
    - Crear `src/systems/CombatSystem.ts`
    - Método `applyPlayerMeleeAttack(guard, enemies)`: aplicar daño melee a todos los no-muertos dentro de PLAYER_MELEE_RANGE; solo si ronda activa
    - Método `applyUndeadMeleeDamage(undead, guard, delta)`: infligir 10 pts/1000 ms por no-muerto en rango ≤ 48 px; solo si ronda activa
    - Método `checkGameOver(guard)`: retornar `true` si `guard.hp <= 0`
    - Lógica de cooldown de ataque: rechazar silenciosamente inputs < 600 ms desde último ataque
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 3.5, 3.6, 5.1, 5.2, 5.3_
  - [ ]* 4.5 Escribir property test para CombatSystem (daño de ataque melee)
    - **Propiedad 4: El ataque melee del guardia aplica exactamente 30 puntos a cada no-muerto en rango**
    - **Valida: Requerimiento 2.5**
  - [ ]* 4.6 Escribir property test para CombatSystem (cooldown de ataque)
    - **Propiedad 5: El cooldown de ataque garantiza máximo 1 ataque melee cada 600 ms**
    - **Valida: Requerimiento 2.7**
  - [ ]* 4.7 Escribir property test para CombatSystem (HP del guardia)
    - **Propiedad 9: El HP del guardia nunca cae por debajo de 0**
    - **Valida: Requerimiento 5.2**
  - [ ]* 4.8 Escribir property test para CombatSystem (puntuación por kill)
    - **Propiedad 11: Eliminar un no-muerto siempre suma exactamente 10 puntos**
    - **Valida: Requerimiento 4.5**
  - [ ] 4.9 Implementar `PathfindingSystem`
    - Crear `src/systems/PathfindingSystem.ts`
    - Método `updateEnemyDirection(enemy, playerPos)`: calcular vector dirección normalizado a 80 px/s; frecuencia mínima 10 Hz
    - Método `applySeparationForce(enemies, arenaBounds)`: empujar enemies solapados (< 32 px entre centros); clamp a Arena
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 4.10 Escribir property test para PathfindingSystem (límites de Arena)
    - **Propiedad 1: Guardia y no-muertos siempre permanecen dentro de los límites de la Arena**
    - **Valida: Requerimientos 1.2, 3.3, 3.4**
  - [ ]* 4.11 Escribir property test para PathfindingSystem (velocidad de no-muertos)
    - **Propiedad 8: La velocidad base de los no-muertos estándar es siempre 80 px/s**
    - **Valida: Requerimiento 3.2**
  - [ ]* 4.12 Escribir property test para PathfindingSystem (separación de no-muertos)
    - **Propiedad 7: La fuerza de separación elimina solapamientos sin sacar no-muertos de la Arena**
    - **Valida: Requerimiento 3.4**
  - [ ] 4.13 Implementar `InputSystem`
    - Crear `src/systems/InputSystem.ts`
    - Método `getMovementVector()`: leer WASD + flechas + joystick virtual; retornar vector normalizado
    - Método `isAttackPressed()`: detectar clic, toque, barra espaciadora o botón de ataque en pantalla
    - Método `getAttackTarget()`: retornar posición del cursor o punto de toque
    - Crear joystick virtual (radio ≥ 80 px, zona inferior-izquierda, ≥ 16 px del borde) solo en dispositivos táctiles
    - Crear botón de ataque (≥ 64×64 px, zona inferior-derecha, ≤ 16 px del borde) solo en dispositivos táctiles
    - _Requirements: 1.1, 1.5, 1.6, 2.1, 2.8, 12.3, 12.4, 12.5, 12.7_
  - [ ] 4.14 Implementar `AudioSystem`
    - Crear `src/systems/AudioSystem.ts`
    - Métodos: `playMeleeSwing()`, `playUndeadDeath()`, `playGuardHurt()`, `playRoundStart()`
    - Cargar claves desde `ASSET_MANIFEST.audio`; silenciar si el asset no cargó (no lanzar error)
    - _Requirements: 15.1, 15.2_

- [ ] 5. Implementar GameScene principal y escenas de fin de juego
  - [ ] 5.1 Implementar `GameScene`
    - Crear `src/scenes/GameScene.ts`
    - `create()`: inicializar Arena, Player, WaveManager, CombatSystem, InputSystem, HUD, AudioSystem
    - `update(time, delta)`: InputSystem → `player.move()` → `player.clampToArena()` → WaveManager tick → PathfindingSystem → CombatSystem → HUD update
    - Registrar colisiones Phaser Arcade: Projectile↔Enemy, Player↔ArenaBounds
    - Detectar game-over: si `CombatSystem.checkGameOver()` → transicionar a `GameOverScene` en ≤ 500 ms
    - Soporte orientación: pausar, recalcular layout, redimensionar en ≤ 200 ms
    - _Requirements: 1.1–1.5, 3.1, 5.3, 5.5, 6.5, 12.6_
  - [ ] 5.2 Implementar `GameOverScene`
    - Crear `src/scenes/GameOverScene.ts`
    - Mostrar: ronda final, enemigos eliminados, score total en overlay en ≤ 500 ms
    - Si usuario autenticado: botón "Submit Score" → llamar `LeaderboardApi.submitScore()`
    - Manejo de error de red: mostrar mensaje + retener botón para reintento
    - Manejo de error no-red: ocultar botón + mensaje genérico + log silencioso
    - Tras submit exitoso: deshabilitar botón "Submit Score" + mostrar confirmación
    - Botón "Play Again": resetear HP=100, round=1, enemies=[], score=0 → `GameScene`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [ ]* 5.3 Escribir property test para GameOverScene (datos de sesión en overlay)
    - **Property 14: La pantalla de game-over muestra exactamente los datos de la sesión finalizada**
    - **Validates: Requirements 8.2**
  - [ ]* 5.4 Escribir property test para GameScene (Play Again reset)
    - **Property 15: "Play Again" restablece el estado del juego a valores iniciales exactos**
    - **Validates: Requirements 8.5**
  - [ ] 5.5 Implementar `LeaderboardScene`
    - Crear `src/scenes/LeaderboardScene.ts`
    - Fetch paralelo de `GET /leaderboard/global` y (si autenticado) `GET /leaderboard/friends`
    - Renderizar tabla con columnas: rank, username, highestRound, totalScore
    - Resaltar entrada del usuario autenticado; si fuera del top-100, añadir al final
    - _Requirements: 10.4, 10.5, 11.5, 11.6_

- [ ] 6. Implementar propiedades del guardia y del sistema de combate melee
  - [ ] 6.1 Implementar lógica de normalización de velocidad del guardia
    - En `GraveyardGuard.move()`: aplicar `Vector2.normalize().scale(PLAYER_SPEED)` para todas las combinaciones de direcciones incluyendo diagonales
    - Asegurar que el módulo sea exactamente 200 px/s (±0.001 tolerancia)
    - _Requirements: 1.1, 1.5_
  - [ ]* 6.2 Escribir property test para velocidad del guardia
    - **Propiedad 2: La velocidad de movimiento siempre es exactamente 200 px/s para el guardia**
    - **Valida: Requerimientos 1.1, 1.5**
  - [ ] 6.3 Implementar lógica de rango melee del guardia
    - En `CombatSystem.applyPlayerMeleeAttack()`: afectar todos los no-muertos cuyo centro esté dentro de PLAYER_MELEE_RANGE (64 px)
    - Garantizar que `PLAYER_MELEE_RANGE (64) > ENEMY_MELEE_RANGE (48)` mediante assertion en `GameConfig.ts`
    - _Requirements: 2.2, 2.3, 2.5_
  - [ ]* 6.4 Escribir property test para rango melee del guardia
    - **Propiedad 4: El ataque melee del guardia aplica exactamente 30 puntos a cada no-muerto en rango**
    - **Valida: Requerimiento 2.5**
  - [ ]* 6.5 Escribir property test para rango guardia vs no-muertos
    - **Propiedad 3: El rango de melee del guardia siempre excede el rango de melee de los no-muertos**
    - **Valida: Requerimiento 2.3**
  - [ ]* 6.6 Implementar lógica de HealthBar proporcional
    - En `HealthBar.update()`: `barWidth = Math.round((currentHp / maxHp) * MAX_BAR_WIDTH)`; tolerancia 1%
    - _Requirements: 4.3_
  - [ ]* 6.7 Escribir property test para HealthBar
    - **Propiedad 10: La barra de HP de un no-muerto refleja el ratio hp/maxHp con precisión**
    - **Valida: Requerimiento 4.3**
  - [ ]* 6.8 Escribir property test para umbral de color del HUD
    - **Propiedad 24: El HUD muestra la salud en rojo si y solo si HP < 30% del máximo**
    - **Valida: Requerimientos 7.3, 7.4**

- [ ] 7. Checkpoint — Verificar lógica de juego client-side
  - Asegurar que todos los tests de propiedades P1–P15 y P24 pasen.
  - Asegurar que el juego compila sin errores TypeScript (`tsc --noEmit`).
  - Asegurar que la GameScene renderiza y el ciclo de rondas funciona localmente.
  - Consultar al usuario si hay ajustes de gameplay antes de continuar con el backend.

- [ ] 8. Implementar capa de API client-side
  - [ ] 8.1 Implementar `AuthApi`
    - Crear `src/api/AuthApi.ts`
    - Método `register(username, email, password)`: `POST /auth/register`; retornar `{ accessToken, refreshToken }`
    - Método `login(email, password)`: `POST /auth/login`
    - Método `logout()`: `POST /auth/logout` con Bearer token
    - Método `refreshToken()`: intentar renovación automática; si falla, limpiar localStorage y redirigir a AuthScene
    - Guardar/leer tokens de `localStorage`; incluir `Authorization: Bearer <token>` en requests protegidos
    - _Requirements: 9.4, 9.6, 9.9_
  - [ ] 8.2 Implementar `LeaderboardApi`
    - Crear `src/api/LeaderboardApi.ts`
    - Método `getGlobal()`: `GET /leaderboard/global`
    - Método `getFriends()`: `GET /leaderboard/friends` (autenticado)
    - Método `submitScore(data: ScoreSubmission)`: `POST /leaderboard/scores` (autenticado); retornar `{ success }` o lanzar error tipado
    - _Requirements: 8.4, 10.1, 10.2, 10.5, 11.5_
  - [ ] 8.3 Implementar `FriendsApi`
    - Crear `src/api/FriendsApi.ts`
    - Método `getList()`: `GET /friends`
    - Método `sendRequest(targetUsername)`: `POST /friends/request`
    - Método `accept(requesterId)`: `POST /friends/accept`
    - Método `reject(requesterId)`: `POST /friends/reject`
    - Método `remove(friendId)`: `DELETE /friends/{friendId}`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7_

- [ ] 9. Implementar infraestructura CDK (IaC)
  - [ ] 9.1 Inicializar proyecto CDK
    - Crear directorio `infra/` con `package.json`, `tsconfig.json`, `cdk.json`
    - Instalar dependencias: `aws-cdk-lib@^2`, `constructs@^10`, `@aws-cdk/aws-cognito`, `@aws-cdk/aws-dynamodb`, `@aws-cdk/aws-lambda-nodejs`, `@aws-cdk/aws-apigateway`, `@aws-cdk/aws-s3`, `@aws-cdk/aws-cloudfront`
    - Crear `infra/bin/app.ts` con entry point del CDK App
    - _Requirements: 13.1, 13.2, 13.5_
  - [ ] 9.2 Definir stack de DynamoDB
    - Crear `infra/stacks/DatabaseStack.ts`
    - Tabla `users`: PK `userId`, SK `"profile"`, atributos username, email, highestRound, totalScore, createdAt, profileStatus; billingMode `PAY_PER_REQUEST`
    - Tabla `scores`: PK `userId`, SK `timestamp`; billingMode `PAY_PER_REQUEST`
    - Tabla `friends`: PK `userId`, SK `friendId`, atributo status; billingMode `PAY_PER_REQUEST`
    - GSI `leaderboard-gsi` en tabla `users`: PK `leaderboardPartition = "GLOBAL"`, SK `rankKey`; proyección ALL
    - _Requirements: 13.5_
  - [ ] 9.3 Definir stack de Cognito
    - Crear `infra/stacks/AuthStack.ts`
    - Cognito User Pool: passwordPolicy (min 8, max 72), selfSignUpEnabled true, aliasAttributes email
    - Cognito App Client: authFlows `USER_PASSWORD_AUTH`, tokenValidity accessToken 1h, refreshToken 30 días
    - Exportar `userPoolId` y `userPoolClientId` para uso en Lambdas
    - _Requirements: 9.1, 9.6, 13.4_
  - [ ] 9.4 Definir stack de Lambdas y API Gateway
    - Crear `infra/stacks/ApiStack.ts`
    - NodejsFunction para `AuthLambda`, `LeaderboardLambda`, `FriendsLambda`; runtime Node 20.x; bundling esbuild
    - REST API Gateway: HTTPS only (ningún endpoint HTTP plano), CORS permitiendo solo origen CloudFront
    - Cognito JWT Authorizer para endpoints protegidos (🔒)
    - Definir todos los recursos y métodos: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /leaderboard/global`, `POST /leaderboard/scores`, `GET /leaderboard/friends`, `GET /friends`, `POST /friends/request`, `POST /friends/accept`, `POST /friends/reject`, `DELETE /friends/{friendId}`
    - _Requirements: 13.2, 13.3, 13.7, 16.1_
  - [ ] 9.5 Definir stack de S3 + CloudFront
    - Crear `infra/stacks/FrontendStack.ts`
    - S3 bucket: versioning enabled, blockPublicAccess, serverSideEncryption
    - CloudFront distribution: S3 como origin, cachePolicy TTL ≥ 86400 s para assets versionados, HTTPS redirect
    - Output URL de distribución para uso en CORS de API Gateway
    - _Requirements: 13.1, 13.2_
  - [ ] 9.6 Definir stack de CloudWatch y alarmas
    - Crear `infra/stacks/MonitoringStack.ts`
    - Log groups para cada Lambda con retención 30 días
    - Alarma: Lambda p99 latencia > 2000 ms
    - Alarma: Lambda error rate > 1%
    - _Requirements: 13.3, 13.6_
  - [ ]* 9.7 Escribir CDK snapshot tests
    - Crear `infra/test/stacks.test.ts` usando `aws-cdk-lib/assertions`
    - Verificar: DynamoDB `BillingMode: PAY_PER_REQUEST`, Cognito passwordPolicy, API Gateway HTTPS, S3 serverSideEncryption
    - _Requirements: 13.1, 13.2, 13.4, 13.5_

- [ ] 10. Implementar Lambda: AuthLambda
  - [ ] 10.1 Implementar handler `POST /auth/register`
    - Crear `backend/src/handlers/auth/register.ts`
    - Validar schema de body (username, email regex, password 8–72 chars); retornar HTTP 400 con campo fallido si inválido
    - Llamar `cognitoClient.signUp()`; si falla, retornar HTTP 400/500 según tipo de error
    - `dynamodb.put()` perfil con `profileStatus: "active"`; si falla: retry 3 veces a 5 min con backoff; si todos fallan: `profileStatus: "permanently_failed"` + retornar JWT + HTTP 500 en subsiguientes requests de datos de perfil
    - Retornar `{ accessToken, refreshToken, expiresIn }`
    - _Requirements: 9.1, 9.2, 9.3, 9.8_
  - [ ]* 10.2 Escribir property test para validación de contraseña
    - **Propiedad 16: La validación de contraseña acepta exactamente longitudes entre 8 y 72 caracteres**
    - **Valida: Requerimientos 9.1, 9.3**
  - [ ]* 10.3 Escribir property test para lógica de reintentos DynamoDB
    - **Propiedad 17: La lógica de reintentos del registro respeta el límite de 3 intentos**
    - **Valida: Requerimiento 9.8**
  - [ ] 10.4 Implementar handler `POST /auth/login`
    - Crear `backend/src/handlers/auth/login.ts`
    - Llamar `cognitoClient.initiateAuth(email, password)`
    - Si credenciales incorrectas: HTTP 401 con mensaje genérico (no especificar campo)
    - Retornar `{ accessToken, refreshToken, expiresIn }`
    - _Requirements: 9.4, 9.5_
  - [ ] 10.5 Implementar handler `POST /auth/logout`
    - Crear `backend/src/handlers/auth/logout.ts`
    - Llamar `cognitoClient.globalSignOut(accessToken)`
    - Retornar `{ success: true }`
    - _Requirements: 9.9_

- [ ] 11. Implementar Lambda: LeaderboardLambda
  - [ ] 11.1 Implementar handler `POST /leaderboard/scores`
    - Crear `backend/src/handlers/leaderboard/submitScore.ts`
    - Cognito JWT Authorizer ya valida token; extraer `userId` de claims
    - Validar schema: `{ round: number, score: number, enemiesKilled: number, sessionDuration: number }`; HTTP 400 si inválido
    - Anti-cheat: `if (round > floor(sessionDuration / MIN_ROUND_DURATION_SECONDS)) → HTTP 400`
    - `dynamodb.put()` en tabla `scores`; actualizar `highestRound` y `totalScore` en tabla `users` si mejora
    - Actualizar `rankKey` en GSI: `padStart(6,'0')(highestRound) + '#' + padStart(10,'0')(totalScore)`
    - Retornar `{ success: true }` o HTTP 400/401/500 según caso
    - _Requirements: 8.4, 10.3, 10.6, 16.2, 16.3_
  - [ ]* 11.2 Escribir property test para anti-cheat
    - **Propiedad 23: El anti-cheat rechaza rondas imposibles dado el tiempo de sesión**
    - **Valida: Requerimiento 16.3**
  - [ ] 11.3 Implementar handler `GET /leaderboard/global`
    - Crear `backend/src/handlers/leaderboard/getGlobal.ts`
    - Query GSI `leaderboard-gsi`: PK `"GLOBAL"`, `ScanIndexForward=false`, `Limit=100`
    - Si usuario autenticado no aparece en top-100: append su entrada al final del array
    - Retornar `{ entries: LeaderboardEntry[], userEntry?: LeaderboardEntry }`
    - _Requirements: 10.1, 10.2, 10.4, 10.5_
  - [ ]* 11.4 Escribir property test para ordenamiento del leaderboard
    - **Propiedad 18: El leaderboard está ordenado por (highestRound DESC, totalScore DESC)**
    - **Valida: Requerimientos 10.1, 11.5**
  - [ ]* 11.5 Escribir property test para límite de 100 entradas
    - **Propiedad 19: El leaderboard global retorna como máximo 100 entradas**
    - **Valida: Requerimiento 10.2**
  - [ ]* 11.6 Escribir property test para campos completos de leaderboard
    - **Propiedad 20: Cada entrada del leaderboard contiene los cuatro campos requeridos**
    - **Valida: Requerimientos 10.4, 11.4, 11.6**
  - [ ] 11.7 Implementar handler `GET /leaderboard/friends`
    - Crear `backend/src/handlers/leaderboard/getFriends.ts`
    - Obtener lista de `friendId` confirmados para el `userId` del token
    - Batch-get scores de amigos; ordenar por `highestRound DESC`, `totalScore DESC`
    - Retornar `{ entries: LeaderboardEntry[] }`
    - _Requirements: 11.5, 11.6_

- [ ] 12. Implementar Lambda: FriendsLambda
  - [ ] 12.1 Implementar handler `POST /friends/request`
    - Crear `backend/src/handlers/friends/sendRequest.ts`
    - Buscar `userId` del `targetUsername` en tabla `users` (GSI por username)
    - `dynamodb.put()` `{ PK: userId, SK: friendId, status: "pending", createdAt }`
    - _Requirements: 11.1_
  - [ ] 12.2 Implementar handler `POST /friends/accept`
    - Crear `backend/src/handlers/friends/accept.ts`
    - `dynamodb.update()` status a `"confirmed"` para ambas direcciones: `{PK:A,SK:B}` y `{PK:B,SK:A}`
    - _Requirements: 11.2_
  - [ ] 12.3 Implementar handler `POST /friends/reject`
    - Crear `backend/src/handlers/friends/reject.ts`
    - `dynamodb.delete()` la relación pendiente `{PK: requester, SK: target}`
    - _Requirements: 11.3_
  - [ ] 12.4 Implementar handler `GET /friends`
    - Crear `backend/src/handlers/friends/getList.ts`
    - Query tabla `friends`: PK=userId, filter `status="confirmed"`
    - Batch-get username y `highestRound` de cada `friendId`
    - Retornar `{ friends: FriendEntry[] }`
    - _Requirements: 11.4_
  - [ ] 12.5 Implementar handler `DELETE /friends/{friendId}`
    - Crear `backend/src/handlers/friends/remove.ts`
    - `dynamodb.delete()` ambos ítems: `{PK: userId, SK: friendId}` y `{PK: friendId, SK: userId}` en transacción
    - _Requirements: 11.7_
  - [ ]* 12.6 Escribir property test para eliminación de amistad bidireccional
    - **Propiedad 22: Eliminar una amistad la remueve de ambas listas inmediatamente**
    - **Valida: Requerimiento 11.7**

- [ ] 13. Implementar seguridad transversal y validación
  - [ ] 13.1 Implementar middleware de validación de schema compartido
    - Crear `backend/src/utils/validateSchema.ts` con función genérica `validateBody<T>(event, schema)` usando Zod o `ajv`
    - Retornar HTTP 400 con el nombre del campo fallido si validación falla
    - Usar en todos los handlers (AuthLambda, LeaderboardLambda, FriendsLambda)
    - _Requirements: 16.2_
  - [ ] 13.2 Implementar handler de errores no manejados en Lambdas
    - Crear `backend/src/utils/errorHandler.ts` con wrapper `withErrorHandling(handler)`
    - Capturar excepciones no manejadas: log full stack trace a CloudWatch; retornar HTTP 500
    - _Requirements: 13.6_
  - [ ]* 13.3 Escribir property test para rechazo de tokens inválidos
    - **Propiedad 21: Los endpoints protegidos rechazan con HTTP 401 cualquier token inválido**
    - **Valida: Requerimientos 10.6, 16.1**

- [ ] 14. Checkpoint — Verificar backend y seguridad
  - Asegurar que todos los tests de propiedades P16–P23 pasen.
  - Verificar que `tsc --noEmit` pasa sin errores en `backend/`.
  - Verificar que los CDK snapshot tests pasan.
  - Consultar al usuario si hay ajustes antes de proceder con tests de integración.

- [ ] 15. Implementar tests de integración
  - [ ] 15.1 Configurar DynamoDB Local y entorno de integración
    - Crear `backend/test/setup.ts`: levantar DynamoDB Local (Docker o `dynamodb-local` npm), crear tablas y GSI
    - Configurar variables de entorno para tests: `DYNAMODB_ENDPOINT`, `COGNITO_USER_POOL_ID`, etc.
    - _Requirements: 9.2, 9.8, 10.3_
  - [ ]* 15.2 Escribir test de integración: registro + perfil en DynamoDB
    - `POST /auth/register` con credenciales válidas → verificar Cognito user creado + item en tabla `users`
    - `POST /auth/register` con DynamoDB caído → verificar retorno de JWT + retry marcado
    - _Requirements: 9.2, 9.8_
  - [ ]* 15.3 Escribir test de integración: login + acceso a endpoint protegido
    - `POST /auth/login` → obtener token → `GET /leaderboard/global` con Bearer token → HTTP 200
    - Request sin token a endpoint protegido → HTTP 401
    - _Requirements: 9.4, 16.1_
  - [ ]* 15.4 Escribir test de integración: submit score + aparece en leaderboard
    - `POST /leaderboard/scores` con score válido → verificar item en tabla `scores` → `GET /leaderboard/global` → verificar entrada
    - `POST /leaderboard/scores` con ronda imposible → HTTP 400
    - _Requirements: 8.4, 10.3, 16.3_
  - [ ]* 15.5 Escribir test de integración: logout invalida token
    - `POST /auth/logout` → intentar `GET /leaderboard/friends` con token invalidado → HTTP 401
    - _Requirements: 9.9_
  - [ ]* 15.6 Escribir tests unitarios de scenes (MenuScene, AuthScene, GameOverScene)
    - Crear `src/scenes/__tests__/` con Vitest + mocks de Phaser
    - GameOverScene: game-over en HP=0 muestra overlay con datos exactos; botón Submit Score solo si autenticado
    - GameOverScene: Play Again resetea HP=100, round=1, score=0
    - AuthScene: error descriptivo por campo en credenciales inválidas
    - MenuScene: botón Login vs Logout según estado de sesión
    - _Requirements: 8.1, 8.3, 8.5, 9.3, 9.5_
  - [ ]* 15.7 Escribir tests unitarios de sistemas (WaveManager, CombatSystem, HUD)
    - WaveManager: inter-round pause de 3s dispara siguiente ronda; soporte para 50 rondas consecutivas
    - CombatSystem: game-over si HP=0 tras daño; score +10 por kill; sin daño melee fuera de Round activa
    - HUD: barra de salud roja si HP < 30%; score actualiza en 1 frame; muestra "Round [N] incoming" 3 s
    - InputSystem: virtual joystick y fire button presentes en dispositivo touch
    - _Requirements: 5.3, 5.4, 6.3, 6.5, 6.6, 7.3, 7.4, 7.5_

- [ ] 16. Soporte móvil y responsive
  - [ ] 16.1 Implementar escalado responsive de Arena y HUD
    - En `GameScene.create()` y en listener `resize`: escalar Arena para llenar viewport preservando aspect ratio; pillarbox/letterbox si necesario
    - Asegurar que el HUD escala con el viewport; viewport mínimo 360 px sin scroll horizontal
    - _Requirements: 12.1, 12.2_
  - [ ] 16.2 Implementar manejo de cambio de orientación
    - Escuchar evento `orientationchange` y `resize` de `window`
    - Pausar juego → recalcular layout → redimensionar Arena y HUD en ≤ 200 ms → reanudar
    - _Requirements: 12.6_
  - [ ] 16.3 Garantizar oclusión de controles móviles ≤ 20% del playfield
    - Verificar en tests unitarios que el área combinada del joystick + botón de fuego no supera el 20% del playfield
    - Touch targets mínimos: botones HUD 44×44 px; joystick y fire button 48×48 px
    - _Requirements: 12.7, 12.8_

- [ ] 17. Compatibilidad de navegadores y manejo de WebGL
  - [ ] 17.1 Implementar detección de soporte WebGL
    - En `BootScene.preload()` o `main.ts`: detectar `WebGLRenderingContext`
    - Si no disponible: mostrar mensaje "Se requiere un navegador compatible con WebGL" + link a Chrome/Firefox/Safari
    - No inicializar el motor Phaser si no hay WebGL
    - _Requirements: 14.4, 14.5_

- [ ] 18. Wiring final: conectar todas las capas
  - [ ] 18.1 Integrar AuthApi en AuthScene y MenuScene
    - Verificar que `AuthScene` usa `AuthApi.register()` / `AuthApi.login()` y guarda tokens en localStorage
    - Verificar que `MenuScene` lee token y ajusta UI correctamente
    - _Requirements: 9.2, 9.4, 9.7_
  - [ ] 18.2 Integrar LeaderboardApi en GameOverScene y LeaderboardScene
    - Verificar que `GameOverScene` llama `LeaderboardApi.submitScore()` con `{ round, score, enemiesKilled, sessionDuration }`
    - Verificar que `LeaderboardScene` hace fetch y renderiza ambos leaderboards
    - _Requirements: 8.4, 10.4, 11.5_
  - [ ] 18.3 Integrar FriendsApi con LeaderboardScene
    - Añadir pestaña "Amigos" en `LeaderboardScene` que usa `FriendsApi.getList()` y `LeaderboardApi.getFriends()`
    - _Requirements: 11.4, 11.5, 11.6_
  - [ ] 18.4 Configurar Vite build para producción
    - Configurar `vite.config.ts`: `build.outDir = 'dist'`, code splitting por escena, asset hashing en nombres de archivo (para TTL largo en CloudFront)
    - Verificar que `npm run build` produce bundle sin errores TypeScript
    - _Requirements: 13.1, 14.3_

- [ ] 19. Checkpoint final — Integración completa
  - Ejecutar `vitest --run` en cliente y backend; todos los tests deben pasar (propiedades P1–P24 + unit + integración).
  - Ejecutar `tsc --noEmit` en cliente y backend sin errores.
  - Ejecutar `cdk synth` sin errores; snapshot tests CDK pasan.
  - Verificar `npm run build` produce bundle optimizado.
  - Consultar al usuario si hay ajustes finales antes del despliegue.

## Notes

<!-- Notas -->
- Las tareas marcadas con `*` son opcionales (tests) y pueden omitirse para un MVP rápido; la lógica de implementación no depende de ellas.
- Cada tarea referencia requerimientos específicos para trazabilidad completa.
- Los checkpoints (tareas 7, 14, 19) son puntos de sincronización para validar el avance antes de continuar.
- Los property-based tests usan `fast-check` con mínimo 100 iteraciones por propiedad; cada test incluye el tag `// Feature: horde-battle-game, Propiedad N`.
- Las propiedades P1–P15 y P24 corresponden a lógica de cliente; P16–P23 corresponden a backend Lambda.
- Los tests de infraestructura CDK son snapshot tests, no PBT.
- `ENEMY_MELEE_RANGE < PLAYER_MELEE_RANGE` se verifica tanto en la Propiedad 3 (PBT) como en assertion en tiempo de compilación en `GameConfig.ts`.
- El campo `rankKey` del GSI (`padStart(6,'0')(round) + '#' + padStart(10,'0')(score)`) permite Query ordenada sin Scan; cambios en esta lógica requieren actualizar tanto el handler de submit como el de getGlobal.

## Task Dependency Graph

<!-- Grafo de Dependencias de Tareas -->

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

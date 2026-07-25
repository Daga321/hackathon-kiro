# Design: Scenes & Flow

> **Related:** [Requirements](../requirements/game-session.md) | [Tasks](../tasks/scenes.md)

---

## Phaser Scenes

```
BootScene
  └─ Configures global engine parameters (resolution, Arcade physics)
  └─ Transitions to PreloadScene

PreloadScene
  └─ Loads the asset manifest (AssetManifest.ts)
  └─ Loads all sprites, spritesheets, and audio
  └─ If an asset fails: log to console + placeholder sprite (Req 15.2)
  └─ Transitions to MenuScene

MenuScene
  └─ Displays logo + options: Play, Leaderboard, Login/Register
  └─ Detects if there is an active session (token in localStorage) and adjusts UI

AuthScene
  └─ Registration form: username, email, password (client-side validation)
  └─ Login form: email, password
  └─ Calls Auth API; saves JWT in localStorage
  └─ Redirects to MenuScene on success

GameScene  [main scene]
  └─ Initializes: Player, WaveManager, CombatSystem, InputSystem, HUD
  └─ Main loop: update() → InputSystem → Player movement → WaveManager → PathfindingSystem → CombatSystem → HUD
  └─ Manages transition to GameOverScene

GameOverScene
  └─ Displays final stats (round, enemies, score)
  └─ "Submit Score" button (only if authenticated)
  └─ "Play Again" button → resets and returns to GameScene

LeaderboardScene
  └─ Fetches /leaderboard/global and /leaderboard/friends
  └─ Renders table with rank, username, round, score
  └─ Highlights the authenticated user's entry
```

---

## Scene Transition Flow

```
Boot → Preload → Menu ─┬─→ GameScene → GameOverScene ─┬─→ GameScene (Play Again)
                        │                               └─→ Menu
                        ├─→ AuthScene → Menu
                        └─→ LeaderboardScene → Menu
```

---

## GameScene Main Loop

```
update(time, delta):
  1. InputSystem.getMovementVector()
  2. Player.move(velocity)
  3. Player.clampToArena(bounds)
  4. WaveManager tick (check round transitions)
  5. PathfindingSystem.updateEnemyDirection() for each active enemy
  6. PathfindingSystem.applySeparationForce(enemies, bounds)
  7. CombatSystem.applyUndeadMeleeDamage() for each enemy in range
  8. If InputSystem.isAttackPressed(): CombatSystem.applyPlayerMeleeAttack()
  9. CombatSystem.checkGameOver(guard) → transition to GameOverScene
  10. HUD.update(hp, round, enemiesLeft, score)
```

---

## GameOverScene Behavior

- Display: final round, enemies killed, total score in overlay within ≤ 500 ms
- If user authenticated: "Submit Score" button → call `LeaderboardApi.submitScore()`
- Network error handling: display message + retain button for retry
- Non-network error handling: hide button + generic message + silent log
- After successful submit: disable "Submit Score" button + display confirmation
- "Play Again" button: reset HP=100, round=1, enemies=[], score=0 → `GameScene`

---

## LeaderboardScene Behavior

- Parallel fetch of `GET /leaderboard/global` and (if authenticated) `GET /leaderboard/friends`
- Render table with columns: rank, username, highestRound, totalScore
- Highlight the authenticated user's entry; if outside top-100, append at the end

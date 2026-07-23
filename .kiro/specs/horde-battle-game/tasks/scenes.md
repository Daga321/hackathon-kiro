# Tasks: Scenes

> **Related:** [Requirements](../requirements/game-session.md) | [Design](../design/scenes-flow.md)

---

- [ ] 2. Implement Phaser scenes (Boot, Preload, Menu, Auth)
  - [ ] 2.1 Implement `BootScene`
    - Create `src/scenes/BootScene.ts` extending `Phaser.Scene`
    - Configure global engine parameters: resolution 800×600, gravity 0, pixelArt true
    - Transition to `PreloadScene` on `create()` completion
    - _Requirements: 14.1_
  - [ ] 2.2 Implement `PreloadScene`
    - Create `src/scenes/PreloadScene.ts`
    - Iterate `ASSET_MANIFEST.sprites`, `spritesheets` and `audio` to load each resource with `this.load`
    - On `loaderror` callback: log to console + substitute with 16×16 magenta placeholder sprite
    - Display progress bar during loading
    - Transition to `MenuScene` on completion
    - _Requirements: 15.1, 15.2, 15.4_
  - [ ] 2.3 Implement `MenuScene`
    - Create `src/scenes/MenuScene.ts`
    - Display logo and buttons: "Play", "Leaderboard", "Login / Register"
    - Read token from `localStorage`; if exists, replace Login button with "Logout" and show username
    - Navigate to `GameScene`, `LeaderboardScene` or `AuthScene` based on selection
    - _Requirements: 9.7_
  - [ ] 2.4 Implement `AuthScene`
    - Create `src/scenes/AuthScene.ts`
    - Registration form: username, email (validate regex `local-part@domain.tld`), password (8–72 chars) fields
    - Login form: email, password fields
    - Call `AuthApi.register()` / `AuthApi.login()`; save JWT in `localStorage`
    - Display descriptive field errors in UI; redirect to `MenuScene` on success
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

---

- [ ] 5. Implement main GameScene and game-over scenes
  - [ ] 5.1 Implement `GameScene`
    - Create `src/scenes/GameScene.ts`
    - `create()`: initialize Arena, Player, WaveManager, CombatSystem, InputSystem, HUD, AudioSystem
    - `update(time, delta)`: InputSystem → `player.move()` → `player.clampToArena()` → WaveManager tick → PathfindingSystem → CombatSystem → HUD update
    - Register Phaser Arcade collisions: Projectile↔Enemy, Player↔ArenaBounds
    - Detect game-over: if `CombatSystem.checkGameOver()` → transition to `GameOverScene` within ≤ 500 ms
    - Orientation support: pause, recalculate layout, resize within ≤ 200 ms
    - _Requirements: 1.1–1.5, 3.1, 5.3, 5.5, 6.5, 12.6_
  - [ ] 5.2 Implement `GameOverScene`
    - Create `src/scenes/GameOverScene.ts`
    - Display: final round, enemies killed, total score in overlay within ≤ 500 ms
    - If user authenticated: "Submit Score" button → call `LeaderboardApi.submitScore()`
    - Network error handling: display message + retain button for retry
    - Non-network error handling: hide button + generic message + silent log
    - After successful submit: disable "Submit Score" button + display confirmation
    - "Play Again" button: reset HP=100, round=1, enemies=[], score=0 → `GameScene`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [ ]* 5.3 Write property test for GameOverScene (session data in overlay)
    - **Property 14: The game-over screen displays exactly the finished session data**
    - **Validates: Requirements 8.2**
  - [ ]* 5.4 Write property test for GameScene (Play Again reset)
    - **Property 15: "Play Again" resets the game state to exact initial values**
    - **Validates: Requirements 8.5**
  - [ ] 5.5 Implement `LeaderboardScene`
    - Create `src/scenes/LeaderboardScene.ts`
    - Parallel fetch of `GET /leaderboard/global` and (if authenticated) `GET /leaderboard/friends`
    - Render table with columns: rank, username, highestRound, totalScore
    - Highlight the authenticated user's entry; if outside top-100, append at the end
    - _Requirements: 10.4, 10.5, 11.5, 11.6_

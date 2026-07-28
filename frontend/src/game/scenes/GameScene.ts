import Phaser from 'phaser';
import { MapGenerator } from '../map/MapGenerator';
import { MAP_CONFIG } from '../config/map-config';
import { DEV_TOOLS_ENABLED } from '../config/dev-tools';
import { Player } from '../entities/Player';
import { EnemySpawner } from '../ai/EnemySpawner';
import { WaveManager } from '../ai/WaveManager';
import { TouchControls } from '../ui/TouchControls';
import { HudManager } from '../ui/HudManager';
import { WaveAnnouncement } from '../ui/WaveAnnouncement';
import { PauseMenu } from '../ui/PauseMenu';
import { DamageIndicatorSystem, DamageType } from '../ui/DamageIndicator';
import { getPlayerDamage } from '../config/difficulty-config';
import { AudioManager } from '../audio/AudioManager';
import { HealthPickupManager } from '../entities/HealthPickupManager';
import { ResultsScreen } from '../ui/ResultsScreen';
import { ShareManager } from '../ui/ShareManager';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AuthUI } from '../ui/AuthUI';

/**
 * Main game scene that creates the tilemap-based graveyard world.
 *
 * Camera controls (for map inspection):
 * - Arrow keys: Pan camera
 * - Q/E: Zoom in/out
 * - F: Fit entire map on screen (zoom to see full map)
 * - R: Reset to center at normal zoom
 */
export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyF!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private keyL!: Phaser.Input.Keyboard.Key;
  private keyT!: Phaser.Input.Keyboard.Key;
  private keyBodies!: Phaser.Input.Keyboard.Key;
  private player!: Player;
  private waveManager!: WaveManager;
  private spawner!: EnemySpawner;
  private pathfinder!: import('../ai/Pathfinder').Pathfinder;
  private graveSpawned: boolean = false;
  private touchControls!: TouchControls;
  private hud!: HudManager;
  private waveAnnouncement!: WaveAnnouncement;
  private pauseMenu!: PauseMenu;
  private damageIndicators!: DamageIndicatorSystem;
  private healthPickups!: HealthPickupManager;
  private devHudObjects: Phaser.GameObjects.GameObject[] = [];
  private devPosText?: Phaser.GameObjects.Text;
  private audio!: AudioManager;
  private resultsScreen!: ResultsScreen;
  private shareManager!: ShareManager;
  private missPlayed: boolean = false;
  private swingHitConnected: boolean = false;

  // HTML UI managers — persist across scene restarts (singletons)
  private static _pauseMenu: PauseMenu | null = null;
  private static _authUI: AuthUI | null = null;
  private static _waveAnnouncement: WaveAnnouncement | null = null;
  private static _resultsScreen: ResultsScreen | null = null;
  private static _shareManager: ShareManager | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset per-game state (scene.restart() reuses the same instance)
    this.graveSpawned = false;
    this.missPlayed = false;
    this.swingHitConnected = false;

    // Generate the tilemap layers
    const mapGen = new MapGenerator(this);
    const {
      collisionLayer,
      elevatedLayer,
      fenceLayer,
      graveColliders,
      treeColliders,
      obstacleColliders,
      pathfinder,
    } = mapGen.generate();

    // Set up physics world bounds to match the full map
    this.physics.world.setBounds(0, 0, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);

    // Set up camera bounds and center
    this.cameras.main.setBounds(0, 0, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);

    // Enable collision detection on tilemap layers
    if (collisionLayer) {
      collisionLayer.setCollisionByExclusion([-1]);
    }
    if (elevatedLayer) {
      elevatedLayer.setCollisionByExclusion([-1]);
    }
    if (fenceLayer) {
      fenceLayer.setCollisionByExclusion([-1]);
    }
    // Objects layer: NO tilemap collision — graves and trees use circular physics bodies instead

    // Create player at a random valid position (uses pathfinder for full collision check)
    this.pathfinder = pathfinder;
    this.player = new Player(this, collisionLayer, pathfinder);

    // Add physics colliders between player and all collidable layers
    const playerSprite = this.player.getSprite();
    if (collisionLayer) this.physics.add.collider(playerSprite, collisionLayer);
    if (elevatedLayer) this.physics.add.collider(playerSprite, elevatedLayer);
    if (fenceLayer) this.physics.add.collider(playerSprite, fenceLayer);
    if (graveColliders) this.physics.add.collider(playerSprite, graveColliders);
    if (treeColliders) this.physics.add.collider(playerSprite, treeColliders);
    if (obstacleColliders) this.physics.add.collider(playerSprite, obstacleColliders);

    // Create enemy spawner and wave manager
    this.spawner = new EnemySpawner(
      this,
      pathfinder,
      collisionLayer,
      elevatedLayer,
      fenceLayer,
      graveColliders,
      treeColliders,
      obstacleColliders,
    );
    this.waveManager = new WaveManager(this, this.spawner);

    // Create HTML HUD manager
    this.hud = new HudManager();

    // Wave announcement overlay (register BEFORE waveManager.start so Wave 1 is captured)
    // Singleton to prevent duplicate timeouts on restart
    if (!GameScene._waveAnnouncement) {
      GameScene._waveAnnouncement = new WaveAnnouncement();
    }
    this.waveAnnouncement = GameScene._waveAnnouncement;
    this.events.on('wave-start', (wave: number, enemyCount: number) => {
      this.waveAnnouncement.show(wave, enemyCount);
    });

    this.waveManager.start();

    // Audio system
    this.audio = new AudioManager(this);
    this.audio.startMusic();

    // Camera follows the player
    const sprite = this.player.getSprite();
    this.cameras.main.startFollow(sprite, true, 0.1, 0.1);

    // Set zoom: higher on mobile for better visibility
    const isMobile = this.sys.game.device.input.touch;
    this.cameras.main.setZoom(isMobile ? 2.5 : 2);

    // Camera controls & WASD
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.keyP = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Pause menu (keyboard handled at document level inside PauseMenu)
    // Use singleton to prevent duplicate document-level event listeners on restart
    if (!GameScene._pauseMenu) {
      GameScene._pauseMenu = new PauseMenu();
    }
    this.pauseMenu = GameScene._pauseMenu;
    this.pauseMenu.onPause(() => {
      this.scene.pause();
    });
    this.pauseMenu.onResume(() => {
      this.scene.resume();
    });

    // Game over screen (disabled — will be reimplemented in upcoming phases)
    // this.gameOverScreen = new GameOverScreen();

    // Results screen (shown in Game Over overlay) — singleton to prevent duplicate state
    if (!GameScene._resultsScreen) {
      GameScene._resultsScreen = new ResultsScreen();
    }
    this.resultsScreen = GameScene._resultsScreen;

    // Share manager — singleton
    if (!GameScene._shareManager) {
      GameScene._shareManager = new ShareManager();
    }
    this.shareManager = GameScene._shareManager;

    // Damage indicators
    this.damageIndicators = new DamageIndicatorSystem(this);

    // Health pickup system
    this.healthPickups = new HealthPickupManager(this);

    // Auth UI (login/register) — pauses game while popup is open
    // Singleton to prevent duplicate listeners on restart
    if (!GameScene._authUI) {
      GameScene._authUI = new AuthUI();
    }
    const authUI = GameScene._authUI;
    authUI.onOpen(() => {
      this.scene.pause();
    });
    authUI.onClose(() => {
      this.scene.resume();
    });

    // Connect auth to pause menu for friends panel
    this.pauseMenu.setAuthUI(authUI);

    // Connect audio manager to pause menu for audio settings
    this.pauseMenu.setAudioManager(this.audio);

    // Dev tools: debug keys (only registered when VITE_DEV_TOOLS=true)
    if (DEV_TOOLS_ENABLED) {
      this.keyQ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyF = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.keyL = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);
      this.keyT = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
      this.keyBodies = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);

      // Dev HUD: rendered on a separate camera with fixed zoom=1 so it stays
      // at a constant size regardless of the main camera zoom (like CSS position:fixed).
      if (!isMobile) {
        const shortcutsText = this.add
          .text(
            10,
            10,
            'WASD/Arrows: Move | Space: Attack | Q/E: Zoom | F: Full map | R: Reset | L: Position | T: Tiles | B: Bodies',
            {
              fontSize: '12px',
              color: '#ffffff',
              backgroundColor: '#00000088',
              padding: { x: 4, y: 2 },
            },
          )
          .setScrollFactor(0)
          .setDepth(1000);

        this.devPosText = this.add
          .text(10, 30, '', {
            fontSize: '12px',
            color: '#00ff88',
            backgroundColor: '#00000088',
            padding: { x: 4, y: 2 },
          })
          .setScrollFactor(0)
          .setDepth(1000)
          .setVisible(false);

        this.devHudObjects.push(shortcutsText, this.devPosText);

        // Create a dedicated dev-tools UI camera: zoom is always 1, no scroll
        const devCam = this.cameras.add(
          0,
          0,
          this.scale.width,
          this.scale.height,
          false,
          'devtools',
        );
        devCam.setZoom(1);
        devCam.setScroll(0, 0);

        // Dev camera only renders dev HUD objects
        this.children.list.forEach((child) => {
          if (!this.devHudObjects.includes(child)) {
            devCam.ignore(child);
          }
        });

        // Main camera ignores dev HUD objects (they live on devCam only)
        this.devHudObjects.forEach((obj) => this.cameras.main.ignore(obj));
      }
    }

    // Touch controls (visible only on touch devices) — use a separate UI camera
    this.touchControls = new TouchControls(this);
    if (this.touchControls.isActive()) {
      // Create a dedicated UI camera — no zoom, no scroll, renders only touch controls
      const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
      uiCam.setScroll(0, 0);

      // UI camera only sees touch control objects
      const uiObjects = this.touchControls.getObjects();

      // Main camera ignores touch UI objects
      uiObjects.forEach((obj) => this.cameras.main.ignore(obj));

      // UI camera ignores everything by default — only shows touch UI objects
      uiCam.visible = true;

      // Ignore all current children on UI cam except touch controls
      this.children.list.forEach((child) => {
        if (!uiObjects.includes(child)) {
          uiCam.ignore(child);
        }
      });

      // CRITICAL: Also ignore any future objects added to the scene (Wave 2+ enemies, health bars, etc.) by listening for the 'addedtoscene' event
      this.events.on('addedtoscene', (gameObject: Phaser.GameObjects.GameObject) => {
        if (!uiObjects.includes(gameObject)) {
          uiCam.ignore(gameObject);
        }
      });
    }
  }

  update(): void {
    // Update touch controls
    this.touchControls.update();

    // Build touch input for player
    const touchMove = this.touchControls.isActive()
      ? { x: this.touchControls.moveX, y: this.touchControls.moveY }
      : undefined;
    const touchAttack = this.touchControls.consumeAttack();

    // Player movement + attack (keyboard + touch)
    this.player.handleInput(this.cursors, this.wasd, this.keyP, touchMove, touchAttack);

    // Player step sounds (only when actually moving, not just pressing keys)
    const playerBody = this.player.getSprite().body as Phaser.Physics.Arcade.Body;
    const playerActuallyMoving =
      playerBody &&
      (Math.abs(playerBody.velocity.x) > 5 || Math.abs(playerBody.velocity.y) > 5) &&
      !this.player.getIsDead();
    this.audio.updateSteps(playerActuallyMoving);

    // Update player depth for proper Y-sorting with tree canopies
    this.player.updateDepth();

    // Update wave manager
    this.waveManager.update(this.player.getIsDead());

    // Update HTML HUD
    this.hud.update(
      this.player,
      this.waveManager,
      this.waveManager.getAllEnemies(),
      this.game.loop.delta,
      this.waveManager.getScoreReward(),
    );

    // ─── Game Over detection (placeholder for future phases) ───
    // Player death state is already detected via player.getIsDead() which stops all gameplay

    // Spawn grave once after player death animation completes
    if (this.player.getIsDead() && !this.graveSpawned) {
      this.graveSpawned = true;

      // Disable pause menu during game over
      this.pauseMenu.setDisabled(true);

      // Transition audio: stop battle music, start game over music
      this.audio.transitionToGameOver();

      // Wait for death animation to finish, then place grave and trigger enemy reactions
      this.time.delayedCall(1200, () => {
        this.spawnGraveNearPlayer();
        this.triggerGameOverEnemyReactions();
        // Show game over overlay after a brief pause
        this.time.delayedCall(1500, () => {
          this.showGameOverOverlay();
        });
      });
    }

    // Update enemies (skip if player is dead — enemies stop targeting)
    const enemies = this.waveManager.getAllEnemies();
    const globalAggro = this.hud.getIsAggroActive();
    for (const enemy of enemies) {
      if (!enemy.getIsDead()) {
        enemy.updateDepth();
        if (!this.player.getIsDead()) {
          enemy.update(this.player.getSprite(), globalAggro);
        }
      }
    }

    // ─── Combat damage detection (skip if player dead) ───
    if (!this.player.getIsDead()) {
      let playerHitConnected = false;

      for (const enemy of enemies) {
        if (enemy.getIsDead()) continue;

        // Player attacks enemy
        if (this.player.isHitboxActive()) {
          const hitbox = this.player.getHitbox();
          if (hitbox && !this.player.hasAlreadyHitTarget(enemy)) {
            const enemySprite = enemy.getSprite();
            const dist = Phaser.Math.Distance.Between(
              hitbox.x,
              hitbox.y,
              enemySprite.x,
              enemySprite.y,
            );
            if (dist < 20) {
              this.player.registerHit(enemy);
              const dmg = getPlayerDamage(this.waveManager.getWave());
              enemy.takeDamage(dmg, this.player);
              this.damageIndicators.spawn(enemySprite.x, enemySprite.y - 8, dmg, DamageType.DEALT);
              this.audio.playHit();
              playerHitConnected = true;

              // Spawn health pickup on enemy death
              if (enemy.getIsDead()) {
                this.healthPickups.trySpawn(enemySprite.x, enemySprite.y);
              }
            }
          }
        }

        // Enemy attacks player (disabled while enemy is in knockback from player hit)
        if (enemy.isHitboxActive() && !enemy.getIsInKnockback()) {
          const hitbox = enemy.getHitbox();
          if (hitbox && !enemy.hasAlreadyHitTarget(this.player)) {
            const plSprite = this.player.getSprite();
            const dist = Phaser.Math.Distance.Between(hitbox.x, hitbox.y, plSprite.x, plSprite.y);
            if (dist < 20) {
              enemy.registerHit(this.player);
              const dmg = enemy.getAttackDamage();
              this.player.takeDamage(dmg, enemy);
              this.damageIndicators.spawn(plSprite.x, plSprite.y - 8, dmg, DamageType.RECEIVED);
              this.audio.playPlayerDamage();
            }
          }
        }
      }

      // Track if this swing connected with any enemy
      if (playerHitConnected) {
        this.swingHitConnected = true;
      }
    }

    // Miss attack detection: when hitbox deactivates, check if swing connected
    if (this.player.isHitboxActive()) {
      // Hitbox is active — mark that we're in a swing
      this.missPlayed = true; // reuse as "was swinging" flag
    } else if (this.missPlayed) {
      // Hitbox just deactivated this frame — end of swing
      if (!this.swingHitConnected) {
        this.audio.playMissAttack();
      }
      this.missPlayed = false;
      this.swingHitConnected = false;
    }

    // Update damage indicators
    this.damageIndicators.update(this.game.loop.delta);

    // Update health pickups and check collection
    this.healthPickups.update(this.game.loop.delta);
    if (!this.player.getIsDead()) {
      const playerSprite = this.player.getSprite();
      const heals = this.healthPickups.checkCollection(playerSprite.x, playerSprite.y);
      for (const amount of heals) {
        this.player.heal(amount);
        this.damageIndicators.spawn(playerSprite.x, playerSprite.y - 8, amount, DamageType.HEAL);
        this.audio.playHealthPickup();
      }
    }
    this.hud.setPickupPositions(this.healthPickups.getActivePositions());

    // Debug: press L to toggle position HUD and log to console (dev tools only)
    if (DEV_TOOLS_ENABLED && Phaser.Input.Keyboard.JustDown(this.keyL)) {
      if (this.devPosText) {
        const nowVisible = !this.devPosText.visible;
        this.devPosText.setVisible(nowVisible);
        if (nowVisible) {
          const sprite = this.player.getSprite();
          const tileX = Math.floor(sprite.x / 16);
          const tileY = Math.floor(sprite.y / 16);
          console.log(
            `[POS] Pixel: (${Math.round(sprite.x)}, ${Math.round(sprite.y)}) | Tile: (${tileX}, ${tileY})`,
          );
        }
      }
    }

    // Keep position HUD updated in real-time when visible
    if (DEV_TOOLS_ENABLED && this.devPosText?.visible) {
      const sprite = this.player.getSprite();
      const tileX = Math.floor(sprite.x / 16);
      const tileY = Math.floor(sprite.y / 16);
      this.devPosText.setText(
        `Pixel: (${Math.round(sprite.x)}, ${Math.round(sprite.y)}) | Tile: (${tileX}, ${tileY})`,
      );
    }

    const cam = this.cameras.main;

    // Camera controls (desktop only — disabled on mobile)
    if (DEV_TOOLS_ENABLED && !this.touchControls.isActive()) {
      // Zoom with Q/E
      if (this.keyQ.isDown) cam.zoom = Math.min(4, cam.zoom + 0.02);
      if (this.keyE.isDown) cam.zoom = Math.max(0.15, cam.zoom - 0.02);

      // F: Fit entire map (zoom out to show everything)
      if (Phaser.Input.Keyboard.JustDown(this.keyF)) {
        const zoomX = this.scale.width / MAP_CONFIG.WIDTH;
        const zoomY = this.scale.height / MAP_CONFIG.HEIGHT;
        cam.zoom = Math.min(zoomX, zoomY);
        cam.centerOn(MAP_CONFIG.WIDTH / 2, MAP_CONFIG.HEIGHT / 2);
      }

      // R: Reset to center at normal zoom
      if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
        cam.zoom = 2;
        this.cameras.main.startFollow(this.player.getSprite(), true, 0.1, 0.1);
      }

      // T: Toggle TileDebugScene (pauses game, shows tiles on solid background)
      if (Phaser.Input.Keyboard.JustDown(this.keyT)) {
        if (this.scene.isActive('TileDebugScene')) {
          this.scene.stop('TileDebugScene');
          this.scene.wake('GameScene');
        } else {
          this.scene.sleep('GameScene');
          this.scene.launch('TileDebugScene');
          this.scene.bringToTop('TileDebugScene');
        }
      }

      // B: Toggle physics debug overlay (body outlines + velocity vectors)
      if (Phaser.Input.Keyboard.JustDown(this.keyBodies)) {
        const world = this.physics.world;
        if (!world.debugGraphic) {
          world.createDebugGraphic();
        }
        world.drawDebug = !world.drawDebug;
        world.debugGraphic.setVisible(world.drawDebug);
      }
    }
  }

  /**
   * Spawn a gravestone near the player's death position.
   * Uses pathfinder to find a valid walkable tile nearby.
   */
  private spawnGraveNearPlayer(): void {
    const px = this.player.getSprite().x;
    const py = this.player.getSprite().y;
    const tileSize = 16;

    // Directions to try: 1 tile away + small extra offset to avoid visual overlap
    const offset = tileSize + 4; // 20px — one tile plus a few pixels of separation
    const offsets = [
      { x: offset, y: 0 },
      { x: -offset, y: 0 },
      { x: 0, y: offset },
      { x: 0, y: -offset },
      { x: offset, y: -offset },
      { x: -offset, y: -offset },
      { x: offset, y: offset },
      { x: -offset, y: offset },
      // Extend search if adjacent tiles are blocked
      { x: tileSize * 2, y: 0 },
      { x: -tileSize * 2, y: 0 },
      { x: 0, y: tileSize * 2 },
      { x: 0, y: -tileSize * 2 },
    ];

    let graveX = px + offset;
    let graveY = py;

    for (const offset of offsets) {
      const testX = px + offset.x;
      const testY = py + offset.y;
      const tile = this.pathfinder.worldToTile(testX, testY);
      if (this.pathfinder.isWalkable(tile.x, tile.y)) {
        graveX = testX;
        graveY = testY;
        break;
      }
    }

    // Place grave sprite (frame 6 from objects.png = gravestone)
    const grave = this.add.sprite(graveX, graveY, 'objects', 6);
    grave.setOrigin(0.5, 0.5);
    grave.setDepth(5 + graveY / 10000);
    grave.setAlpha(0);

    // Fade in from transparent to fully visible
    this.tweens.add({
      targets: grave,
      alpha: 1,
      duration: 800,
      ease: 'Sine.easeIn',
    });
  }

  /** Radius within which enemies play their special celebration animation on game over */
  private static readonly GAME_OVER_ENEMY_REACTION_RADIUS = 200;

  /**
   * Show the Game Over overlay with results and leaderboard directly.
   * No continue button — stats and leaderboard appear immediately.
   * Binds Play Again and Main Menu action buttons.
   */
  private showGameOverOverlay(): void {
    // Capture final stats
    const finalWave = this.waveManager.getWave();
    const finalScore = this.hud.getScore();

    // Populate stats and leaderboard
    this.resultsScreen.show(finalScore, finalWave);

    // Show the gameover overlay (which now contains everything)
    const backdrop = document.getElementById('gameover-backdrop');
    if (backdrop) {
      backdrop.classList.add('visible');
    }

    // Bind action buttons (using onclick to prevent duplicate listeners on restart)
    const btnRetry = document.getElementById('gameover-btn-retry');
    const btnMenu = document.getElementById('gameover-btn-menu');
    const btnShare = document.getElementById('gameover-btn-share');

    if (btnRetry) {
      btnRetry.onclick = () => {
        this.handleRetry(backdrop);
      };
    }

    if (btnMenu) {
      btnMenu.onclick = () => {
        this.handleMainMenu(backdrop);
      };
    }

    if (btnShare) {
      btnShare.onclick = () => {
        this.shareManager.share(finalScore, finalWave);
      };
    }
  }

  /**
   * VOLVER A INTENTAR — restart the game from Wave 1.
   * Cleans up all state, hides overlay, and restarts the scene.
   */
  private handleRetry(backdrop: HTMLElement | null): void {
    // Hide overlay
    backdrop?.classList.remove('visible');

    // Reset results screen state
    this.resultsScreen.hide();

    // Re-enable pause menu for next game
    this.pauseMenu.setDisabled(false);

    // Stop all audio to prevent duplicates
    this.audio.stopAll();

    // Restart the scene (Phaser destroys all game objects and calls create() fresh)
    this.scene.restart();
  }

  /**
   * MENÚ — return to main menu (reload the page).
   * Cleans up audio and reloads to return to the loading/login screen.
   */
  private handleMainMenu(backdrop: HTMLElement | null): void {
    // Hide overlay
    backdrop?.classList.remove('visible');

    // Reset results screen state
    this.resultsScreen.hide();

    // Stop all audio
    this.audio.stopAll();

    // Reload page to return to main menu (loading screen)
    window.location.reload();
  }

  /**
   * Stop all enemies and make nearby ones play their special idle animation.
   */
  private triggerGameOverEnemyReactions(): void {
    const px = this.player.getSprite().x;
    const py = this.player.getSprite().y;
    const enemies = this.waveManager.getAllEnemies();

    for (const enemy of enemies) {
      if (enemy.getIsDead()) continue;

      // Stop all enemies
      enemy.getSprite().setVelocity(0, 0);

      // Check distance for special animation
      const ex = enemy.getSprite().x;
      const ey = enemy.getSprite().y;
      const dist = Math.sqrt((ex - px) ** 2 + (ey - py) ** 2);

      if (dist <= GameScene.GAME_OVER_ENEMY_REACTION_RADIUS) {
        // Push enemy away from player before playing special animation
        const minDist = 40; // minimum distance from player corpse
        if (dist < minDist && dist > 0) {
          const pushX = ((ex - px) / dist) * minDist;
          const pushY = ((ey - py) / dist) * minDist;
          enemy.getSprite().setPosition(px + pushX, py + pushY);
        }

        // Near enemies: play special idle animation in loop
        enemy.playSpecialIdleLoop();
      }
    }
  }
}

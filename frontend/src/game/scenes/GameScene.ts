import Phaser from 'phaser';
import { MapGenerator } from '../map/MapGenerator';
import { MAP_CONFIG } from '../config/map-config';
import { Player } from '../entities/Player';
import { TouchControls } from '../ui/TouchControls';

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
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keyF!: Phaser.Input.Keyboard.Key;
  private keyR!: Phaser.Input.Keyboard.Key;
  private keyP!: Phaser.Input.Keyboard.Key;
  private player!: Player;
  private touchControls!: TouchControls;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Generate the tilemap layers
    const mapGen = new MapGenerator(this);
    const { collisionLayer, elevatedLayer, fenceLayer } = mapGen.generate();

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

    // Create player at a random valid position
    this.player = new Player(this, collisionLayer);

    // Add physics colliders between player and all collidable layers
    const playerSprite = this.player.getSprite();
    if (collisionLayer) this.physics.add.collider(playerSprite, collisionLayer);
    if (elevatedLayer) this.physics.add.collider(playerSprite, elevatedLayer);
    if (fenceLayer) this.physics.add.collider(playerSprite, fenceLayer);

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
    this.keyQ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyF = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.keyP = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // HUD text (desktop only)
    if (!isMobile) {
      this.add.text(10, 10, 'WASD/Arrows: Move | Space: Attack | Q/E: Zoom | F: Full map | R: Reset', {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      }).setScrollFactor(0).setDepth(100);
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
      uiObjects.forEach(obj => this.cameras.main.ignore(obj));

      // UI camera ignores everything EXCEPT touch UI objects
      // By default the added camera sees nothing — we need to set it to visible
      uiCam.visible = true;

      // The trick: ignore all existing display list objects on UI cam, then un-ignore UI objects
      this.children.list.forEach(child => {
        if (!uiObjects.includes(child)) {
          uiCam.ignore(child);
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

    const cam = this.cameras.main;

    // Camera controls (desktop only — disabled on mobile)
    if (!this.touchControls.isActive()) {
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
    }
  }
}

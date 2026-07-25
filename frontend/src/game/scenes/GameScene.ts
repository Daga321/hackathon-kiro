import Phaser from 'phaser';
import { MapGenerator } from '../map/MapGenerator';
import { MAP_CONFIG } from '../config/map-config';
import { Player } from '../entities/Player';

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
  private player!: Player;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Generate the tilemap layers
    const mapGen = new MapGenerator(this);
    const { collisionLayer } = mapGen.generate();

    // Set up physics world bounds to match the full map
    this.physics.world.setBounds(0, 0, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);

    // Set up camera bounds and center
    this.cameras.main.setBounds(0, 0, MAP_CONFIG.WIDTH, MAP_CONFIG.HEIGHT);

    // Enable collision detection on the wall/border layer
    if (collisionLayer) {
      collisionLayer.setCollisionByExclusion([-1]);
    }

    // Create player at a random valid position
    this.player = new Player(this, collisionLayer);

    // Debug: log player position
    const sprite = this.player.getSprite();
    console.log(`Player spawned at: (${sprite.x.toFixed(0)}, ${sprite.y.toFixed(0)})`);

    // Camera follows the player
    this.cameras.main.startFollow(sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

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

    // HUD text
    this.add.text(10, 10, 'WASD/Arrows: Look | Q/E: Zoom | F: Full map | R: Reset', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    }).setScrollFactor(0).setDepth(100);
  }

  update(): void {
    // Player orientation (WASD + arrows change facing direction only, no movement)
    this.player.handleInput(this.cursors, this.wasd);

    const cam = this.cameras.main;

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

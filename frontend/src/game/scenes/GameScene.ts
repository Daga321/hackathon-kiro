import Phaser from 'phaser';
import { MapGenerator } from '../map/MapGenerator';
import { MAP_CONFIG } from '../config/map-config';

/**
 * Main game scene that creates the tilemap-based graveyard world.
 */
export class GameScene extends Phaser.Scene {
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
    this.cameras.main.centerOn(MAP_CONFIG.WIDTH / 2, MAP_CONFIG.HEIGHT / 2);

    // Enable collision detection on the wall/border layer
    if (collisionLayer) {
      collisionLayer.setCollisionByExclusion([-1]);
    }
  }
}

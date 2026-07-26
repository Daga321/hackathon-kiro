import Phaser from 'phaser';
import { MAP_CONFIG } from '../config/map-config';
import { Character, CharacterAnimConfig } from './Character';

export type { CharacterDirection as PlayerDirection } from './Character';

/**
 * Player entity — extends Character with keyboard/touch input handling.
 *
 * Spritesheet: player.png (288×480, 6 cols × 10 rows, 48×48 frames)
 *   Row 0 (frames 0-5):   Idle Down
 *   Row 1 (frames 6-11):  Idle Right (flipX for Left)
 *   Row 2 (frames 12-17): Idle Up
 *   Row 3 (frames 18-23): Walk Down
 *   Row 4 (frames 24-29): Walk Right (flipX for Left)
 *   Row 5 (frames 30-35): Walk Up
 *   Row 6 (frames 36-41): Attack Down
 *   Row 7 (frames 42-47): Attack Right (flipX for Left)
 *   Row 8 (frames 48-53): Attack Up
 *   Row 9 (frames 54-59): Death — NOT used yet
 */

/** Player animation configuration */
const PLAYER_ANIM_CONFIG: CharacterAnimConfig = {
  textureKey: 'player',
  prefix: 'player',
  idle: { down: [0, 5], right: [6, 11], up: [12, 17] },
  walk: { down: [18, 23], right: [24, 29], up: [30, 35] },
  attack: { down: [36, 39], right: [42, 45], up: [48, 51] },
  idleFrameRate: 5,
  walkFrameRate: 8,
  attackFrameRate: 12,
};

export class Player extends Character {
  constructor(scene: Phaser.Scene, collisionLayer: Phaser.Tilemaps.TilemapLayer | null) {
    const spawnPos = Character.findValidSpawnPosition(
      collisionLayer,
      MAP_CONFIG.WIDTH / 2,
      MAP_CONFIG.HEIGHT / 2,
      MAP_CONFIG.SPAWN_SAFE_RADIUS
    );

    super(scene, spawnPos.x, spawnPos.y, PLAYER_ANIM_CONFIG, 120, 5, 19, 33);
  }

  /**
   * Called each frame. Handles movement, orientation, animations, and attack.
   * Accepts both keyboard and touch input vectors.
   */
  handleInput(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key },
    attackKey: Phaser.Input.Keyboard.Key,
    touchMove?: { x: number; y: number },
    touchAttack?: boolean
  ): void {
    // ─── Attack (keyboard or touch) ───
    const keyboardAttack = Phaser.Input.Keyboard.JustDown(attackKey);
    if ((keyboardAttack || touchAttack) && !this.isAttacking) {
      this.triggerAttack();
      return;
    }

    // ─── While attacking, block movement ───
    if (this.updateAttackState()) return;

    // ─── Movement (keyboard + touch combined) ───
    let vx = 0;
    let vy = 0;

    const up = cursors.up.isDown || wasd.W.isDown;
    const down = cursors.down.isDown || wasd.S.isDown;
    const left = cursors.left.isDown || wasd.A.isDown;
    const right = cursors.right.isDown || wasd.D.isDown;

    if (up) vy -= 1;
    if (down) vy += 1;
    if (left) vx -= 1;
    if (right) vx += 1;

    // Merge touch joystick input (already normalized -1 to 1)
    if (touchMove && (touchMove.x !== 0 || touchMove.y !== 0)) {
      vx = touchMove.x;
      vy = touchMove.y;
    }

    // Normalize diagonal (only for keyboard; touch is already normalized by joystick)
    const isKeyboard = !touchMove || (touchMove.x === 0 && touchMove.y === 0);
    if (isKeyboard) {
      if (vx !== 0 && vy !== 0) {
        const factor = Math.SQRT1_2;
        vx *= factor;
        vy *= factor;
      }
    }

    // Apply movement with keyboard prioritizing horizontal facing
    this.applyMovement(vx, vy, isKeyboard);
  }
}

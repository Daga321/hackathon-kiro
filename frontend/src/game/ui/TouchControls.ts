import Phaser from 'phaser';

/**
 * Touch controls overlay — virtual joystick (left) + attack button (right).
 * Fixed to camera viewport (scrollFactor 0). Only visible on touch-capable devices.
 * Provides movement vector and attack state for integration with Player input.
 */
export class TouchControls {
  private scene: Phaser.Scene;

  // Joystick
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickThumb!: Phaser.GameObjects.Arc;
  private joystickPointer: Phaser.Input.Pointer | null = null;
  private joystickBaseX: number = 0;
  private joystickBaseY: number = 0;
  private readonly joystickRadius = 50;
  private readonly thumbRadius = 22;
  private readonly deadzone = 10;

  // Attack button
  private attackBtn!: Phaser.GameObjects.Arc;
  private attackLabel!: Phaser.GameObjects.Text;
  private _attackTriggered: boolean = false;

  // Movement output
  private _moveX: number = 0;
  private _moveY: number = 0;

  // Visibility
  private visible: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Only show on mobile/tablet — NOT on desktop
    // Use User-Agent to detect actual mobile devices (works correctly with DevTools emulation too)
    const ua = navigator.userAgent.toLowerCase();
    const isMobileDevice = /android|iphone|ipad|ipod|mobile|tablet/.test(ua);
    if (!isMobileDevice) return;

    this.visible = true;
    this.createJoystick();
    this.createAttackButton();
    this.setupInputHandlers();
  }

  /** Normalized movement X (-1 to 1) */
  get moveX(): number {
    return this._moveX;
  }
  /** Normalized movement Y (-1 to 1) */
  get moveY(): number {
    return this._moveY;
  }

  /**
   * Returns true once per attack tap, then resets.
   * Must be called once per frame from GameScene.update().
   */
  consumeAttack(): boolean {
    if (this._attackTriggered) {
      this._attackTriggered = false;
      return true;
    }
    return false;
  }

  /** Call each frame to update joystick state */
  update(): void {
    if (!this.visible) return;

    // Update joystick position based on active pointer
    if (this.joystickPointer && this.joystickPointer.isDown) {
      const dx = this.joystickPointer.x - this.joystickBaseX;
      const dy = this.joystickPointer.y - this.joystickBaseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.deadzone) {
        const clampedDist = Math.min(dist, this.joystickRadius);
        const angle = Math.atan2(dy, dx);

        this.joystickThumb.x = this.joystickBaseX + Math.cos(angle) * clampedDist;
        this.joystickThumb.y = this.joystickBaseY + Math.sin(angle) * clampedDist;

        this._moveX = (Math.cos(angle) * clampedDist) / this.joystickRadius;
        this._moveY = (Math.sin(angle) * clampedDist) / this.joystickRadius;
      } else {
        this.joystickThumb.x = this.joystickBaseX;
        this.joystickThumb.y = this.joystickBaseY;
        this._moveX = 0;
        this._moveY = 0;
      }
    } else {
      this.joystickThumb.x = this.joystickBaseX;
      this.joystickThumb.y = this.joystickBaseY;
      this._moveX = 0;
      this._moveY = 0;
      this.joystickPointer = null;
    }
  }

  private createJoystick(): void {
    const height = this.scene.scale.height;

    this.joystickBaseX = 90;
    this.joystickBaseY = height - 90;

    this.joystickBase = this.scene.add.circle(
      this.joystickBaseX,
      this.joystickBaseY,
      this.joystickRadius,
      0x000000,
      0.3,
    );
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(200);
    this.joystickBase.setStrokeStyle(2, 0xffffff, 0.5);

    this.joystickThumb = this.scene.add.circle(
      this.joystickBaseX,
      this.joystickBaseY,
      this.thumbRadius,
      0xffffff,
      0.5,
    );
    this.joystickThumb.setScrollFactor(0);
    this.joystickThumb.setDepth(201);
  }

  private createAttackButton(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const btnX = width - 70;
    const btnY = height - 90;
    const btnRadius = 35;

    // Visual only — interaction handled via pointer position in setupInputHandlers
    this.attackBtn = this.scene.add.circle(btnX, btnY, btnRadius, 0xcc3333, 0.5);
    this.attackBtn.setScrollFactor(0);
    this.attackBtn.setDepth(200);
    this.attackBtn.setStrokeStyle(3, 0xff5555, 0.7);

    this.attackLabel = this.scene.add.text(btnX, btnY, '⚔', {
      fontSize: '28px',
      color: '#ffffff',
    });
    this.attackLabel.setOrigin(0.5);
    this.attackLabel.setScrollFactor(0);
    this.attackLabel.setDepth(201);
  }

  private setupInputHandlers(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const attackBtnX = width - 70;
    const attackBtnY = height - 90;
    const attackRadius = 50; // Generous touch area

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Check attack button area first (right side, bottom)
      const dx = pointer.x - attackBtnX;
      const dy = pointer.y - attackBtnY;
      if (dx * dx + dy * dy <= attackRadius * attackRadius) {
        this._attackTriggered = true;
        this.attackBtn.setFillStyle(0xff5555, 0.7);
        return;
      }

      // Left half of screen = joystick
      if (pointer.x < width * 0.5 && !this.joystickPointer) {
        this.joystickPointer = pointer;
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer === pointer) {
        this.joystickPointer = null;
      }
      // Reset attack button visual
      this.attackBtn.setFillStyle(0xcc3333, 0.5);
    });
  }

  /** Whether touch controls are active/visible */
  isActive(): boolean {
    return this.visible;
  }

  /** Get all UI game objects for camera ignore/assignment */
  getObjects(): Phaser.GameObjects.GameObject[] {
    if (!this.visible) return [];
    return [this.joystickBase, this.joystickThumb, this.attackBtn, this.attackLabel];
  }
}

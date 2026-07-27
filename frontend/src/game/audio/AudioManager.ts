import Phaser from 'phaser';

/**
 * AudioManager — centralized audio control for music and SFX.
 */
export class AudioManager {
  private scene: Phaser.Scene;
  private bgMusic: Phaser.Sound.BaseSound | null = null;
  private stepSound: Phaser.Sound.BaseSound | null = null;
  private isStepPlaying: boolean = false;

  /** Volume config (0.0 to 1.0) */
  private static readonly MUSIC_VOLUME = 0.4;
  private static readonly SFX_VOLUME = 0.5;
  private static readonly STEP_VOLUME = 0.3;
  private static readonly ATTACK_VOLUME = 0.5;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Start background music (looped). Call once at game start.
   * Handles browser autoplay policy by resuming the AudioContext if suspended.
   */
  startMusic(): void {
    if (this.bgMusic) return;

    // Ensure the Web Audio context is unlocked
    const soundManager = this.scene.sound;
    if (soundManager instanceof Phaser.Sound.WebAudioSoundManager) {
      const ctx = soundManager.context;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.playBgMusic();
        });
        return;
      }
    }

    this.playBgMusic();
  }

  /**
   * Stop all audio and clean up. Call before scene restart.
   */
  stopAll(): void {
    if (this.bgMusic) {
      this.bgMusic.stop();
      this.bgMusic.destroy();
      this.bgMusic = null;
    }
    if (this.stepSound) {
      this.stepSound.stop();
      this.stepSound.destroy();
      this.stepSound = null;
      this.isStepPlaying = false;
    }
    // Remove all sounds managed by this scene to prevent duplicates
    this.scene.sound.removeAll();
  }

  private playBgMusic(): void {
    if (this.bgMusic) return;
    this.bgMusic = this.scene.sound.add('bgm_battle', {
      loop: true,
      volume: AudioManager.MUSIC_VOLUME,
    });
    this.bgMusic.play();
  }

  /**
   * Play hit/damage SFX once (when player's attack connects with an enemy).
   */
  playHit(): void {
    const sound = this.scene.sound.add('sfx_hit', { volume: AudioManager.SFX_VOLUME });
    (sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).play({ seek: 0.7 });
  }

  /**
   * Play miss/swing SFX once (when player attacks but doesn't connect).
   */
  playMissAttack(): void {
    const sound = this.scene.sound.add('sfx_miss_attack', { volume: AudioManager.ATTACK_VOLUME });
    sound.play();
  }

  /**
   * Play player damage SFX once (when player receives damage).
   */
  playPlayerDamage(): void {
    const sound = this.scene.sound.add('sfx_player_damage', { volume: AudioManager.SFX_VOLUME });
    sound.play();
  }

  /**
   * Play attack/swing SFX once (when player attacks), with offset.
   */
  playAttack(): void {
    const sound = this.scene.sound.add('sfx_hit', { volume: AudioManager.ATTACK_VOLUME });
    (sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).play({ seek: 0.7 });
  }

  /**
   * Update step sounds based on player movement state.
   * - When moving: plays step sound looped (restarts when it ends)
   * - When stopped: stops the step sound immediately
   * - Does NOT restart if player stops and starts again while sound is still playing
   */
  updateSteps(isMoving: boolean): void {
    if (isMoving) {
      // Start step sound if not already playing
      if (!this.isStepPlaying) {
        if (!this.stepSound) {
          this.stepSound = this.scene.sound.add('sfx_steps', {
            volume: AudioManager.STEP_VOLUME,
            loop: true,
          });
        }
        this.stepSound.play();
        this.isStepPlaying = true;
      }
    } else {
      // Stop step sound when player stops
      if (this.isStepPlaying && this.stepSound) {
        this.stepSound.stop();
        this.isStepPlaying = false;
      }
    }
  }
}

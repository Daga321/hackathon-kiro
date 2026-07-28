import Phaser from 'phaser';

const PREFS_KEY = 'horde_audio_prefs';

interface AudioPrefs {
  musicVolume: number; // 0.0 to 1.0
  sfxVolume: number; // 0.0 to 1.0
}

/**
 * AudioManager — centralized audio control for music and SFX.
 *
 * Manages two music tracks:
 * - Battle music (bgm_battle): plays during PLAYING state
 * - Game Over music (bgm_load): plays during GAME_OVER / RESULTS state
 *
 * Volume is controlled globally via musicVolume and sfxVolume,
 * persisted in localStorage across sessions.
 */
export class AudioManager {
  private scene: Phaser.Scene;
  private bgMusic: Phaser.Sound.BaseSound | null = null;
  private gameOverMusic: Phaser.Sound.BaseSound | null = null;
  private stepSound: Phaser.Sound.BaseSound | null = null;
  private isStepPlaying: boolean = false;

  /** Base volume levels (before user multiplier) */
  private static readonly BASE_MUSIC_VOLUME = 0.4;
  private static readonly BASE_GAMEOVER_MUSIC_VOLUME = 0.35;
  private static readonly BASE_SFX_VOLUME = 0.5;
  private static readonly BASE_STEP_VOLUME = 0.3;
  private static readonly BASE_ATTACK_VOLUME = 0.5;

  /** User-configurable volume multipliers (0.0 to 1.0) */
  private musicVolume: number;
  private sfxVolume: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const prefs = AudioManager.loadPrefs();
    this.musicVolume = prefs.musicVolume;
    this.sfxVolume = prefs.sfxVolume;
  }

  // ─── Volume getters/setters ───

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  /**
   * Set music volume (0.0 to 1.0). Applies immediately to active music.
   */
  setMusicVolume(value: number): void {
    this.musicVolume = Math.max(0, Math.min(1, value));
    this.savePrefs();
    this.applyMusicVolume();
  }

  /**
   * Set SFX volume (0.0 to 1.0). Applies to subsequent SFX playback.
   */
  setSfxVolume(value: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    this.savePrefs();
    // Apply to currently playing step sound
    if (this.stepSound && 'volume' in this.stepSound) {
      (this.stepSound as Phaser.Sound.WebAudioSound).volume =
        AudioManager.BASE_STEP_VOLUME * this.sfxVolume;
    }
  }

  // ─── Music control ───

  /**
   * Start battle background music (looped). Call once at game start.
   */
  startMusic(): void {
    if (this.bgMusic) return;

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
   * Transition to Game Over state:
   * - Stops battle music immediately
   * - Starts the load screen / game over music
   */
  transitionToGameOver(): void {
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

    if (!this.gameOverMusic) {
      this.gameOverMusic = this.scene.sound.add('bgm_load', {
        loop: true,
        volume: AudioManager.BASE_GAMEOVER_MUSIC_VOLUME * this.musicVolume,
      });
      this.gameOverMusic.play();
    }
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
    if (this.gameOverMusic) {
      this.gameOverMusic.stop();
      this.gameOverMusic.destroy();
      this.gameOverMusic = null;
    }
    if (this.stepSound) {
      this.stepSound.stop();
      this.stepSound.destroy();
      this.stepSound = null;
      this.isStepPlaying = false;
    }
    this.scene.sound.removeAll();
  }

  private playBgMusic(): void {
    if (this.bgMusic) return;
    this.bgMusic = this.scene.sound.add('bgm_battle', {
      loop: true,
      volume: AudioManager.BASE_MUSIC_VOLUME * this.musicVolume,
    });
    this.bgMusic.play();
  }

  /**
   * Apply current musicVolume to whichever music track is active.
   */
  private applyMusicVolume(): void {
    if (this.bgMusic && 'volume' in this.bgMusic) {
      (this.bgMusic as Phaser.Sound.WebAudioSound).volume =
        AudioManager.BASE_MUSIC_VOLUME * this.musicVolume;
    }
    if (this.gameOverMusic && 'volume' in this.gameOverMusic) {
      (this.gameOverMusic as Phaser.Sound.WebAudioSound).volume =
        AudioManager.BASE_GAMEOVER_MUSIC_VOLUME * this.musicVolume;
    }
  }

  // ─── SFX ───

  playHit(): void {
    const vol = AudioManager.BASE_SFX_VOLUME * this.sfxVolume;
    if (vol <= 0) return;
    const sound = this.scene.sound.add('sfx_hit', { volume: vol });
    (sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).play({ seek: 0.7 });
  }

  playMissAttack(): void {
    const vol = AudioManager.BASE_ATTACK_VOLUME * this.sfxVolume;
    if (vol <= 0) return;
    const sound = this.scene.sound.add('sfx_miss_attack', { volume: vol });
    sound.play();
  }

  playPlayerDamage(): void {
    const vol = AudioManager.BASE_SFX_VOLUME * this.sfxVolume;
    if (vol <= 0) return;
    const sound = this.scene.sound.add('sfx_player_damage', { volume: vol });
    sound.play();
  }

  playHealthPickup(): void {
    const vol = AudioManager.BASE_SFX_VOLUME * this.sfxVolume;
    if (vol <= 0) return;
    const sound = this.scene.sound.add('sfx_health_pickup', { volume: vol });
    sound.play();
  }

  playAttack(): void {
    const vol = AudioManager.BASE_ATTACK_VOLUME * this.sfxVolume;
    if (vol <= 0) return;
    const sound = this.scene.sound.add('sfx_hit', { volume: vol });
    (sound as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).play({ seek: 0.7 });
  }

  updateSteps(isMoving: boolean): void {
    if (isMoving) {
      if (!this.isStepPlaying) {
        const vol = AudioManager.BASE_STEP_VOLUME * this.sfxVolume;
        if (vol <= 0) return;
        if (!this.stepSound) {
          this.stepSound = this.scene.sound.add('sfx_steps', {
            volume: vol,
            loop: true,
          });
        }
        this.stepSound.play();
        this.isStepPlaying = true;
      }
    } else {
      if (this.isStepPlaying && this.stepSound) {
        this.stepSound.stop();
        this.isStepPlaying = false;
      }
    }
  }

  // ─── Persistence ───

  private savePrefs(): void {
    const prefs: AudioPrefs = {
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  private static loadPrefs(): AudioPrefs {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
        return {
          musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : 1,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : 1,
        };
      }
    } catch {
      // Corrupt data — use defaults
    }
    return { musicVolume: 1, sfxVolume: 1 };
  }
}

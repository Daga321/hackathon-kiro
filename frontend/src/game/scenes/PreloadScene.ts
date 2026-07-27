import Phaser from 'phaser';
import { TILESET_KEYS } from '../config/map-config';

/**
 * Preloads all tileset spritesheets and images needed for map generation.
 * Assets are loaded with correct frame dimensions for tilemap consumption.
 * Communicates loading progress to the HTML loading screen overlay.
 */
export class PreloadScene extends Phaser.Scene {
  private loadMusic: Phaser.Sound.BaseSound | null = null;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.connectHtmlLoadingScreen();

    // Load the load-screen music FIRST so it can play ASAP while other assets load
    this.load.audio('bgm_load', 'audio/music/bgm_loading_50bpm.wav');

    // Try to start music as soon as it's loaded (before all assets finish)
    this.load.once('filecomplete-audio-bgm_load', () => {
      this.tryStartLoadMusic();
    });

    // ─── Ground ─────────────────────────────────────────────────────────
    // grass.png is a single 16×16 tile — load as image for tilemap use
    this.load.image(TILESET_KEYS.GRASS, 'tilesets/grass.png');

    // ─── Elevated terrain ───────────────────────────────────────────────
    // plains.png: 96×192, 6 cols × 12 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.PLAINS, 'tilesets/plains.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Walls ──────────────────────────────────────────────────────────
    // walls.png: 128×128, 8 cols × 8 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.WALLS, 'tilesets/walls/walls.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Fences ─────────────────────────────────────────────────────────
    // fences.png: 64×64, 4 cols × 4 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.FENCES, 'tilesets/fences.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Decorations 16×16 ──────────────────────────────────────────────
    // decor_16x16.png: 64×80, 4 cols × 5 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.DECOR_16, 'tilesets/decor_16x16.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Decorations 8×8 ────────────────────────────────────────────────
    // decor_8x8.png: 32×32, 4 cols × 4 rows, 8×8 tiles
    this.load.spritesheet(TILESET_KEYS.DECOR_8, 'tilesets/decor_8x8.png', {
      frameWidth: 8,
      frameHeight: 8,
    });

    // ─── Objects ────────────────────────────────────────────────────────
    // objects.png: 256×208, 16 cols × 13 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.OBJECTS, 'objects/objects.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Floor tiles (for potential indoor areas) ───────────────────────
    // flooring.png: 80×48, 5 cols × 3 rows, 16×16 tiles
    this.load.spritesheet(TILESET_KEYS.FLOORING, 'tilesets/floors/flooring.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Player character ───────────────────────────────────────────────
    // player.png: 288×480, 6 cols × 10 rows, 48×48 frames
    this.load.spritesheet('player', 'characters/player.png', {
      frameWidth: 48,
      frameHeight: 48,
    });

    // ─── Skeleton enemy (swordless) ─────────────────────────────────────
    // skeleton_swordless.png: 288×624, 6 cols × 13 rows, 48×48 frames
    this.load.spritesheet('skeleton_swordless', 'characters/skeleton_swordless.png', {
      frameWidth: 48,
      frameHeight: 48,
    });

    // ─── Skeleton enemy (with sword) ────────────────────────────────────
    // skeleton.png: 288×624, 6 cols × 13 rows, 48×48 frames
    this.load.spritesheet('skeleton', 'characters/skeleton.png', {
      frameWidth: 48,
      frameHeight: 48,
    });

    // ─── Slime enemy ────────────────────────────────────────────────────
    // slime.png: 224×416, 7 cols × 13 rows, 32×32 frames
    this.load.spritesheet('slime', 'characters/slime.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // ─── Audio ──────────────────────────────────────────────────────────
    this.load.audio('bgm_battle', 'audio/music/bgm_battle_110bpm.wav');
    this.load.audio('sfx_hit', 'audio/sfx/sfx_hit.mp3');
    this.load.audio('sfx_steps', 'audio/sfx/sfx_steps.mp3');
    this.load.audio('sfx_player_damage', 'audio/sfx/sfx_player_damage.mp3');
    this.load.audio('sfx_miss_attack', 'audio/sfx/sfx_miss_attack.mp3');
    this.load.audio('sfx_health_pickup', 'audio/sfx/sfx_health_pickup.mp3');
  }

  create(): void {
    // If music didn't start during preload (e.g., audio context was locked),
    // it will start on the first user interaction via tryStartLoadMusic
    this.showStartPrompt();
  }

  /**
   * Attempt to play load screen music. If browser blocks autoplay,
   * it will start when the user interacts with the "Press to start" prompt.
   */
  private tryStartLoadMusic(): void {
    if (this.loadMusic) return;

    this.loadMusic = this.sound.add('bgm_load', { loop: true, volume: 0.35 });

    // Try to play — may fail silently due to autoplay policy.
    // The AudioContext will be resumed by the user's "Press to start" interaction.
    try {
      this.loadMusic.play();
    } catch {
      // Autoplay blocked — music will start when AudioContext is resumed
    }
  }

  /**
   * Connect Phaser's load progress to the HTML loading screen overlay.
   * Updates the progress bar fill width.
   */
  private connectHtmlLoadingScreen(): void {
    const progressFill = document.getElementById('loading-progress-fill');

    this.load.on('progress', (value: number) => {
      if (progressFill) {
        progressFill.style.width = `${Math.round(value * 100)}%`;
      }
    });
  }

  /**
   * Show "Press any key / Tap to start" prompt and wait for user interaction.
   */
  private showStartPrompt(): void {
    const statusText = document.getElementById('loading-status-text');
    const startPrompt = document.getElementById('loading-start-prompt');

    // Hide "Loading..." text, show prompt
    if (statusText) {
      statusText.style.display = 'none';
    }
    if (startPrompt) {
      startPrompt.classList.add('visible');
    }

    // Wait for any key press or touch/click
    const handleInteraction = (): void => {
      // Remove listeners to avoid double-firing
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('pointerdown', handleInteraction);

      // Unlock the AudioContext with this user gesture
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager)?.context;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }

      this.hideHtmlLoadingScreen();
    };

    document.addEventListener('keydown', handleInteraction, { once: true });
    document.addEventListener('pointerdown', handleInteraction, { once: true });
  }

  /**
   * Fade out and remove the HTML loading screen overlay, then start the game.
   */
  private hideHtmlLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');

    // Stop load screen music before transitioning
    if (this.loadMusic) {
      this.loadMusic.stop();
      this.loadMusic.destroy();
      this.loadMusic = null;
    }

    if (!loadingScreen) {
      this.scene.start('GameScene');
      return;
    }

    // Trigger CSS fade-out transition
    loadingScreen.classList.add('fade-out');

    // After the transition ends, remove from DOM and start the game
    loadingScreen.addEventListener(
      'transitionend',
      () => {
        loadingScreen.classList.add('hidden');
        this.scene.start('GameScene');
      },
      { once: true },
    );

    // Fallback in case transitionend doesn't fire (e.g., reduced motion)
    setTimeout(() => {
      if (!loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('hidden');
        if (!this.scene.isActive('GameScene')) {
          this.scene.start('GameScene');
        }
      }
    }, 1000);
  }
}

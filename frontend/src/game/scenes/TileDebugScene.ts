import Phaser from 'phaser';

/**
 * Asset registry entry for the debug viewer.
 */
interface AssetEntry {
  label: string;
  key: string;
  path: string;
  cols: number;
  rows: number;
  tileSize: number;
  category: string;
}

/**
 * Debug scene that displays ALL game assets organized by directory.
 *
 * Features:
 * - Left sidebar with scrollable file hierarchy grouped by folder
 * - Right content area with scrollable sprite grid
 * - Mouse wheel scrolls whichever panel the cursor is over
 * - Click sidebar entries to select, or use UP/DOWN/LEFT/RIGHT arrows
 * - T or ESC to return to game
 */
export class TileDebugScene extends Phaser.Scene {
  private assets: AssetEntry[] = [];
  private currentIndex = 0;

  // Cameras
  private sidebarCam!: Phaser.Cameras.Scene2D.Camera;
  private contentCam!: Phaser.Cameras.Scene2D.Camera;

  // Scroll state
  private sidebarScrollY = 0;
  private sidebarMaxScrollY = 0;
  private contentScrollY = 0;
  private contentMaxScrollY = 0;

  // Display objects tracked for cleanup
  private sidebarObjects: Phaser.GameObjects.GameObject[] = [];
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private infoText!: Phaser.GameObjects.Text;

  private readonly SIDEBAR_WIDTH = 230;
  private readonly SCROLL_SPEED = 30;
  private readonly CONTENT_OFFSET_X = 2000;

  constructor() {
    super({ key: 'TileDebugScene' });
  }

  preload(): void {
    // Load assets not already loaded by PreloadScene
    const objectImages = [
      'chest_01',
      'chest_02',
      'rock_in_water_01',
      'rock_in_water_02',
      'rock_in_water_03',
      'rock_in_water_04',
      'rock_in_water_05',
      'rock_in_water_06',
    ];
    objectImages.forEach((name) => {
      if (!this.textures.exists(`obj_${name}`)) {
        this.load.image(`obj_${name}`, `objects/${name}.png`);
      }
    });

    if (!this.textures.exists('obj_rock_in_water_01_sheet')) {
      this.load.spritesheet('obj_rock_in_water_01_sheet', 'objects/rock_in_water_01-sheet.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }

    if (!this.textures.exists('particle_dust_01')) {
      this.load.image('particle_dust_01', 'particles/dust_particles_01.png');
    }

    if (!this.textures.exists('tileset_water_sheet')) {
      this.load.spritesheet('tileset_water_sheet', 'tilesets/water-sheet.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    ['water1', 'water2', 'water3', 'water4', 'water5', 'water6'].forEach((name) => {
      if (!this.textures.exists(`tileset_${name}`)) {
        this.load.image(`tileset_${name}`, `tilesets/${name}.png`);
      }
    });
    if (!this.textures.exists('tileset_water_decorations')) {
      this.load.spritesheet('tileset_water_decorations', 'tilesets/water_decorations.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    if (!this.textures.exists('tileset_water_lillies')) {
      this.load.spritesheet('tileset_water_lillies', 'tilesets/water_lillies.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    if (!this.textures.exists('tileset_wooden_door')) {
      this.load.spritesheet('tileset_wooden_door', 'tilesets/walls/wooden_door.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    if (!this.textures.exists('tileset_wooden_door_b')) {
      this.load.spritesheet('tileset_wooden_door_b', 'tilesets/walls/wooden_door_b.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    if (!this.textures.exists('tileset_carpet')) {
      this.load.spritesheet('tileset_carpet', 'tilesets/floors/carpet.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    if (!this.textures.exists('tileset_wooden')) {
      this.load.spritesheet('tileset_wooden', 'tilesets/floors/wooden.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
  }

  create(): void {
    // Main camera: only renders the background and info bar
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.buildAssetRegistry();
    this.setupCameras();
    this.createInfoBar();
    this.renderSidebar();
    this.renderAsset();
    this.setupInput();
  }

  private setupCameras(): void {
    const { width, height } = this.scale;

    // Sidebar camera: left panel, clips to sidebar area
    this.sidebarCam = this.cameras.add(0, 0, this.SIDEBAR_WIDTH, height, false, 'sidebar');
    this.sidebarCam.setBackgroundColor('#111122');
    this.sidebarCam.setScroll(0, 0);

    // Content camera: right panel (after sidebar), clips to content area
    const infoBarHeight = 40;
    this.contentCam = this.cameras.add(
      this.SIDEBAR_WIDTH,
      infoBarHeight,
      width - this.SIDEBAR_WIDTH,
      height - infoBarHeight,
      false,
      'content',
    );
    this.contentCam.setBackgroundColor('#1a1a2e');
    this.contentCam.setScroll(0, 0);
  }

  private createInfoBar(): void {
    // Info text rendered on main camera (at top, right of sidebar)
    this.infoText = this.add
      .text(this.SIDEBAR_WIDTH + 10, 10, '', {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(500);

    // Main camera ignores sidebar/content objects (managed below)
    // Sidebar and content cameras ignore the info text
    this.sidebarCam.ignore(this.infoText);
    this.contentCam.ignore(this.infoText);
  }

  private setupInput(): void {
    // Keyboard navigation
    this.input.keyboard?.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.navigate(1));
    this.input.keyboard?.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-LEFT', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-T', () => this.returnToGame());
    this.input.keyboard?.on('keydown-ESC', () => this.returnToGame());

    // Mouse wheel scroll
    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        const pointer = this.input.activePointer;
        if (pointer.x < this.SIDEBAR_WIDTH) {
          // Scroll sidebar
          this.sidebarScrollY = Phaser.Math.Clamp(
            this.sidebarScrollY + dy * (this.SCROLL_SPEED / 30),
            0,
            this.sidebarMaxScrollY,
          );
          this.sidebarCam.setScroll(0, this.sidebarScrollY);
        } else {
          // Scroll content (keep X offset constant)
          this.contentScrollY = Phaser.Math.Clamp(
            this.contentScrollY + dy * (this.SCROLL_SPEED / 30),
            0,
            this.contentMaxScrollY,
          );
          this.contentCam.setScroll(this.CONTENT_OFFSET_X, this.contentScrollY);
        }
      },
    );
  }

  private buildAssetRegistry(): void {
    this.assets = [];

    const getFrameInfo = (key: string, tileSize: number): { cols: number; rows: number } => {
      const texture = this.textures.get(key);
      if (texture && texture.key !== '__MISSING') {
        const source = texture.getSourceImage();
        const cols = Math.max(1, Math.floor(source.width / tileSize));
        const rows = Math.max(1, Math.floor(source.height / tileSize));
        return { cols, rows };
      }
      return { cols: 1, rows: 1 };
    };

    // ─── Characters ──────────────────────────────────────────────────────
    [
      { key: 'player', file: 'player.png', tileSize: 48 },
      { key: 'skeleton', file: 'skeleton.png', tileSize: 48 },
      { key: 'skeleton_swordless', file: 'skeleton_swordless.png', tileSize: 48 },
      { key: 'slime', file: 'slime.png', tileSize: 32 },
    ].forEach(({ key, file, tileSize }) => {
      const { cols, rows } = getFrameInfo(key, tileSize);
      this.assets.push({
        label: file,
        key,
        path: `characters/${file}`,
        cols,
        rows,
        tileSize,
        category: 'characters',
      });
    });

    // ─── Objects ─────────────────────────────────────────────────────────
    const objInfo = getFrameInfo('objects', 16);
    this.assets.push({
      label: 'objects.png',
      key: 'objects',
      path: 'objects/objects.png',
      cols: objInfo.cols,
      rows: objInfo.rows,
      tileSize: 16,
      category: 'objects',
    });

    [
      'chest_01',
      'chest_02',
      'rock_in_water_01',
      'rock_in_water_02',
      'rock_in_water_03',
      'rock_in_water_04',
      'rock_in_water_05',
      'rock_in_water_06',
    ].forEach((name) => {
      this.assets.push({
        label: `${name}.png`,
        key: `obj_${name}`,
        path: `objects/${name}.png`,
        cols: 1,
        rows: 1,
        tileSize: 16,
        category: 'objects',
      });
    });

    if (this.textures.exists('obj_rock_in_water_01_sheet')) {
      const info = getFrameInfo('obj_rock_in_water_01_sheet', 16);
      this.assets.push({
        label: 'rock_in_water_01-sheet.png',
        key: 'obj_rock_in_water_01_sheet',
        path: 'objects/rock_in_water_01-sheet.png',
        cols: info.cols,
        rows: info.rows,
        tileSize: 16,
        category: 'objects',
      });
    }

    // ─── Particles ───────────────────────────────────────────────────────
    this.assets.push({
      label: 'dust_particles_01.png',
      key: 'particle_dust_01',
      path: 'particles/dust_particles_01.png',
      cols: 1,
      rows: 1,
      tileSize: 16,
      category: 'particles',
    });

    // ─── Tilesets ────────────────────────────────────────────────────────
    const tilesetEntries: {
      key: string;
      label: string;
      path: string;
      tileSize: number;
      category: string;
    }[] = [
      {
        key: 'grass',
        label: 'grass.png',
        path: 'tilesets/grass.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'plains',
        label: 'plains.png',
        path: 'tilesets/plains.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'fences',
        label: 'fences.png',
        path: 'tilesets/fences.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'decor16',
        label: 'decor_16x16.png',
        path: 'tilesets/decor_16x16.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'decor8',
        label: 'decor_8x8.png',
        path: 'tilesets/decor_8x8.png',
        tileSize: 8,
        category: 'tilesets',
      },
      {
        key: 'tileset_water_sheet',
        label: 'water-sheet.png',
        path: 'tilesets/water-sheet.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water_decorations',
        label: 'water_decorations.png',
        path: 'tilesets/water_decorations.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water_lillies',
        label: 'water_lillies.png',
        path: 'tilesets/water_lillies.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water1',
        label: 'water1.png',
        path: 'tilesets/water1.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water2',
        label: 'water2.png',
        path: 'tilesets/water2.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water3',
        label: 'water3.png',
        path: 'tilesets/water3.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water4',
        label: 'water4.png',
        path: 'tilesets/water4.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water5',
        label: 'water5.png',
        path: 'tilesets/water5.png',
        tileSize: 16,
        category: 'tilesets',
      },
      {
        key: 'tileset_water6',
        label: 'water6.png',
        path: 'tilesets/water6.png',
        tileSize: 16,
        category: 'tilesets',
      },
      // walls/
      {
        key: 'walls',
        label: 'walls.png',
        path: 'tilesets/walls/walls.png',
        tileSize: 16,
        category: 'tilesets/walls',
      },
      {
        key: 'tileset_wooden_door',
        label: 'wooden_door.png',
        path: 'tilesets/walls/wooden_door.png',
        tileSize: 16,
        category: 'tilesets/walls',
      },
      {
        key: 'tileset_wooden_door_b',
        label: 'wooden_door_b.png',
        path: 'tilesets/walls/wooden_door_b.png',
        tileSize: 16,
        category: 'tilesets/walls',
      },
      // floors/
      {
        key: 'flooring',
        label: 'flooring.png',
        path: 'tilesets/floors/flooring.png',
        tileSize: 16,
        category: 'tilesets/floors',
      },
      {
        key: 'tileset_carpet',
        label: 'carpet.png',
        path: 'tilesets/floors/carpet.png',
        tileSize: 16,
        category: 'tilesets/floors',
      },
      {
        key: 'tileset_wooden',
        label: 'wooden.png',
        path: 'tilesets/floors/wooden.png',
        tileSize: 16,
        category: 'tilesets/floors',
      },
    ];

    tilesetEntries.forEach(({ key, label, path, tileSize, category }) => {
      const { cols, rows } = getFrameInfo(key, tileSize);
      this.assets.push({ label, key, path, cols, rows, tileSize, category });
    });
  }

  private renderSidebar(): void {
    // Clear old sidebar objects
    this.sidebarObjects.forEach((obj) => obj.destroy());
    this.sidebarObjects = [];

    let y = 10;
    let lastCategory = '';

    this.assets.forEach((asset, index) => {
      // Category header
      if (asset.category !== lastCategory) {
        lastCategory = asset.category;
        const header = this.add.text(8, y, `${asset.category}/`, {
          fontSize: '11px',
          color: '#88aaff',
          fontStyle: 'bold',
        });
        header.setDepth(250);
        this.sidebarObjects.push(header);
        // Hide from other cameras
        this.cameras.main.ignore(header);
        this.contentCam.ignore(header);
        y += 18;
      }

      // File entry
      const isSelected = index === this.currentIndex;
      const entryText = this.add
        .text(16, y, `${isSelected ? '> ' : '  '}${asset.label}`, {
          fontSize: '10px',
          color: isSelected ? '#ffff00' : '#cccccc',
          backgroundColor: isSelected ? '#333355' : undefined,
          padding: isSelected ? { x: 2, y: 1 } : undefined,
        })
        .setDepth(250)
        .setInteractive({ useHandCursor: true });

      entryText.on('pointerdown', () => {
        this.currentIndex = index;
        this.refreshView();
      });

      this.sidebarObjects.push(entryText);
      this.cameras.main.ignore(entryText);
      this.contentCam.ignore(entryText);
      y += 15;
    });

    // Calculate max scroll
    const viewportHeight = this.scale.height;
    this.sidebarMaxScrollY = Math.max(0, y + 10 - viewportHeight);
    this.sidebarScrollY = Phaser.Math.Clamp(this.sidebarScrollY, 0, this.sidebarMaxScrollY);
    this.sidebarCam.setScroll(0, this.sidebarScrollY);
  }

  private renderAsset(): void {
    // Clear previous content objects
    this.contentObjects.forEach((obj) => obj.destroy());
    this.contentObjects = [];
    this.contentScrollY = 0;

    const asset = this.assets[this.currentIndex];
    if (!asset) return;

    const texture = this.textures.get(asset.key);
    if (!texture || texture.key === '__MISSING') {
      this.infoText.setText(
        `[${this.currentIndex + 1}/${this.assets.length}] "${asset.path}" — NOT FOUND | T/ESC: back`,
      );
      this.contentMaxScrollY = 0;
      return;
    }

    const { cols, rows, tileSize } = asset;
    const totalFrames = cols * rows;
    const isSingleImage = totalFrames <= 1;

    this.infoText.setText(
      `[${this.currentIndex + 1}/${this.assets.length}] "${asset.path}" — ` +
        (isSingleImage
          ? 'single image'
          : `${cols}x${rows} = ${totalFrames} frames (${tileSize}px)`) +
        ' | Arrows/Click: navigate | Scroll: mouse wheel | T/ESC: back',
    );

    // Content objects are placed at CONTENT_OFFSET_X so they don't overlap with sidebar objects.
    // The contentCam viewport starts at SIDEBAR_WIDTH visually, and scrolls from CONTENT_OFFSET_X.
    const startX = this.CONTENT_OFFSET_X + 10;
    const startY = 10;

    this.contentCam.setScroll(this.CONTENT_OFFSET_X, 0);

    if (isSingleImage) {
      const source = texture.getSourceImage();
      const maxDim = Math.max(source.width, source.height);
      const targetSize = 256;
      const scale = Math.min(targetSize / maxDim, 6);

      const img = this.add.image(
        startX + (source.width * scale) / 2,
        startY + (source.height * scale) / 2,
        asset.key,
      );
      img.setScale(scale);
      this.contentObjects.push(img);
      this.cameras.main.ignore(img);
      this.sidebarCam.ignore(img);

      const dimLabel = this.add.text(
        startX,
        startY + source.height * scale + 10,
        `${source.width}x${source.height}px (displayed at ${scale.toFixed(1)}x)`,
        { fontSize: '10px', color: '#aaaaaa' },
      );
      this.contentObjects.push(dimLabel);
      this.cameras.main.ignore(dimLabel);
      this.sidebarCam.ignore(dimLabel);

      this.contentMaxScrollY = 0;
    } else {
      // Spritesheet grid
      const scale = tileSize <= 8 ? 4 : tileSize <= 16 ? 3 : 2;
      const cellSize = tileSize * scale;
      const padding = 3;
      const labelHeight = 13;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const frameIndex = row * cols + col;
          const x = startX + col * (cellSize + padding);
          const y = startY + row * (cellSize + padding + labelHeight);

          const bg = this.add.graphics();
          bg.fillStyle(0x333333, 1);
          bg.fillRect(x, y, cellSize, cellSize);
          this.contentObjects.push(bg);
          this.cameras.main.ignore(bg);
          this.sidebarCam.ignore(bg);

          const sprite = this.add.sprite(x + cellSize / 2, y + cellSize / 2, asset.key, frameIndex);
          sprite.setScale(scale);
          this.contentObjects.push(sprite);
          this.cameras.main.ignore(sprite);
          this.sidebarCam.ignore(sprite);

          const label = this.add.text(x, y + cellSize + 1, `${frameIndex}`, {
            fontSize: '9px',
            color: '#ffff00',
          });
          this.contentObjects.push(label);
          this.cameras.main.ignore(label);
          this.sidebarCam.ignore(label);
        }
      }

      const totalContentHeight = startY + rows * (cellSize + padding + labelHeight) + 20;
      const viewportHeight = this.scale.height - 40; // minus info bar
      this.contentMaxScrollY = Math.max(0, totalContentHeight - viewportHeight);
    }

    this.contentCam.setScroll(this.CONTENT_OFFSET_X, 0);
  }

  private navigate(direction: number): void {
    this.currentIndex = (this.currentIndex + direction + this.assets.length) % this.assets.length;
    this.refreshView();
  }

  private refreshView(): void {
    this.renderSidebar();
    this.renderAsset();
  }

  private returnToGame(): void {
    this.scene.stop('TileDebugScene');
    this.scene.wake('GameScene');
  }
}

import Phaser from 'phaser';
import { MAP_CONFIG, TILESET_KEYS, LAYER_DEPTH } from '../config/map-config';
import {
  WALL_TILES,
  PLAINS_TILES,
  FENCE_TILES,
  OBSTACLE_FRAMES,
} from '../config/tile-indices';

/** Result returned by MapGenerator.generate() */
export interface MapGeneratorResult {
  /** The wall collision layer for physics */
  collisionLayer: Phaser.Tilemaps.TilemapLayer | null;
  /** The elevated terrain collision layer */
  elevatedLayer: Phaser.Tilemaps.TilemapLayer | null;
  /** The fence collision layer */
  fenceLayer: Phaser.Tilemaps.TilemapLayer | null;
  /** The objects layer (visual only, no tilemap collision) */
  objectsLayer: Phaser.Tilemaps.TilemapLayer | null;
  /** Static physics group for grave colliders (circular bodies) */
  graveColliders: Phaser.Physics.Arcade.StaticGroup | null;
  /** Static physics group for tree trunk colliders (circular bodies) */
  treeColliders: Phaser.Physics.Arcade.StaticGroup | null;
  /** Sprites for tree canopies rendered above the player for depth sorting */
  treeCanopySprites: Phaser.GameObjects.Sprite[];
}

/**
 * Generates a designed graveyard tilemap using Phaser's Tilemap API.
 *
 * The map is 128×128 tiles (2048×2048 px) with intentionally placed zones:
 * - 5 irregular elevated plateaus creating natural terrain variety
 * - Partial fences defining sub-areas (graveyard, enclosed yard, separators)
 * - Clustered decorations respecting zone identity
 * - Grouped objects (rock formations, debris clusters)
 * - Clear pathways and open combat areas between zones
 */
export class MapGenerator {
  private scene: Phaser.Scene;
  private rng: Phaser.Math.RandomDataGenerator;
  private pathPositions: Set<string> = new Set();
  private elevatedPositions: Set<string> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rng = new Phaser.Math.RandomDataGenerator([MAP_CONFIG.SEED]);
  }

  /**
   * Generate the complete tilemap with all layers.
   */
  generate(): MapGeneratorResult {
    const groundLayer = this.createGroundLayer();
    const pathLayer = this.createPathLayer();
    const elevatedLayer = this.createElevatedLayer();
    const sandLayer = this.createSandLayer(); // After elevated & path so positions are populated
    const collisionLayer = this.createWallLayer();
    const fenceLayer = this.createFenceLayer();
    this.createDecorLayer();
    const objectsLayer = this.createObjectsLayer();

    // Create circular physics bodies for graves (smooth sliding)
    const graveColliders = this.createGraveColliders(objectsLayer);

    // Create circular physics bodies for tree trunks (smooth sliding around trunks)
    const treeColliders = this.createTreeColliders(objectsLayer);

    // Create canopy sprites above the player for depth sorting (walk-behind effect)
    const treeCanopySprites = this.createTreeCanopySprites(objectsLayer);

    // Set depths
    groundLayer?.setDepth(LAYER_DEPTH.GROUND);
    sandLayer?.setDepth(LAYER_DEPTH.GROUND + 0.5);
    pathLayer?.setDepth(LAYER_DEPTH.DECOR + 0.5);
    elevatedLayer?.setDepth(LAYER_DEPTH.ELEVATED);
    collisionLayer?.setDepth(LAYER_DEPTH.WALLS);

    return { collisionLayer, elevatedLayer, fenceLayer, objectsLayer, graveColliders, treeColliders, treeCanopySprites };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: GROUND (grass fill)
  // ═══════════════════════════════════════════════════════════════════════════

  private createGroundLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Fill entire map with grass (frame 0 — single tile)
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      const row: number[] = [];
      for (let x = 0; x < TILES_X; x++) {
        row.push(0);
      }
      data.push(row);
    }

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage(
      TILESET_KEYS.GRASS,
      TILESET_KEYS.GRASS,
      TILE_SIZE,
      TILE_SIZE
    );
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    return layer;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1.5: SAND PATCHES (brown terrain from plains.png rows 0-3)
  // ═══════════════════════════════════════════════════════════════════════════

  private createSandLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // plains.png rows 0-3 (frames 0-23, 6 cols × 4 rows)
    // Standard RPG autotile layout (6 cols):
    //   Col 0-2: OUTER edges (concave corners + straight edges)
    //   Col 3-5: INNER edges (convex corners + fill variants)
    //
    // Row 0: [0]=TL-outer  [1]=Top-edge     [2]=TR-outer  [3]=TL-inner  [4]=Top-fill   [5]=TR-inner
    // Row 1: [6]=Left-edge [7]=Fill-center   [8]=Right-edge[9]=Left-inner[10]=Fill-var  [11]=Right-inner
    // Row 2: [12]=BL-outer [13]=Bottom-edge  [14]=BR-outer [15]=BL-inner [16]=Bot-fill  [17]=BR-inner
    // Row 3: [18-23] = additional variants
    const SAND = {
      TOP_LEFT: 1,       // Outer corner top-left
      TOP: 2,            // Top edge
      TOP_RIGHT: 3,      // Outer corner top-right
      LEFT: 7,           // Left edge
      FILL: 8,           // Center fill (solid brown)
      RIGHT: 9,          // Right edge
      BOTTOM_LEFT: 13,   // Outer corner bottom-left
      BOTTOM: 14,        // Bottom edge
      BOTTOM_RIGHT: 15,  // Outer corner bottom-right
    };

    // Sand patch zones — clean rectangles, avoiding elevated terrain
    const sandZones: { x: number; y: number; w: number; h: number }[] = [
      { x: 45, y: 75, w: 14, h: 10 },    // South-central
      { x: 87, y: 55, w: 10, h: 8 },     // East-center
      { x: 20, y: 46, w: 10, h: 7 },     // West
      { x: 75, y: 100, w: 12, h: 9 },    // South-east
      { x: 55, y: 35, w: 8, h: 6 },      // Center-north
    ];

    for (const zone of sandZones) {
      for (let dy = 0; dy < zone.h; dy++) {
        for (let dx = 0; dx < zone.w; dx++) {
          const tx = zone.x + dx;
          const ty = zone.y + dy;
          if (tx >= TILES_X || ty >= TILES_Y) continue;
          if (this.elevatedPositions.has(`${tx},${ty}`)) continue;
          if (this.pathPositions.has(`${tx},${ty}`)) continue;

          // Determine frame based on position within rectangle
          const isTop = dy === 0;
          const isBottom = dy === zone.h - 1;
          const isLeft = dx === 0;
          const isRight = dx === zone.w - 1;

          let frame: number;
          if (isTop && isLeft) frame = SAND.TOP_LEFT;
          else if (isTop && isRight) frame = SAND.TOP_RIGHT;
          else if (isBottom && isLeft) frame = SAND.BOTTOM_LEFT;
          else if (isBottom && isRight) frame = SAND.BOTTOM_RIGHT;
          else if (isTop) frame = SAND.TOP;
          else if (isBottom) frame = SAND.BOTTOM;
          else if (isLeft) frame = SAND.LEFT;
          else if (isRight) frame = SAND.RIGHT;
          else frame = SAND.FILL;

          data[ty][tx] = frame;
        }
      }
    }

    const map = this.scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(TILESET_KEYS.PLAINS, TILESET_KEYS.PLAINS, TILE_SIZE, TILE_SIZE);
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    return layer;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: ELEVATED TERRAIN (5 large irregular plateaus)
  // ═══════════════════════════════════════════════════════════════════════════

  private createElevatedLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Zone 1: NW Plateau — Large L-shape closer to center
    this.placeElevatedZone(data, 4, 4, 40, 35, 'nw-plateau');

    // Zone 2: NE Ridge — Wide ridge across top-right, pushed closer
    this.placeElevatedZone(data, 65, 4, 59, 22, 'ne-ridge');

    // Zone 3: South Shelf — Spans most of the bottom
    this.placeElevatedZone(data, 4, 95, 70, 29, 'south-shelf');

    // Zone 4: SE Mound — Large area bottom-right
    this.placeElevatedZone(data, 85, 75, 39, 30, 'se-mound');

    // Zone 5: Central-West Rock — Tactical obstacle near combat area
    this.placeElevatedZone(data, 8, 50, 20, 18, 'central-rock');

    // ─── Holes in elevated terrain (2×2 composite: frames 28+29 top, 34+35 bottom) ───
    const HOLE_2x2 = { frames: [[28, 29], [34, 35]], w: 2, h: 2 };
    const holeZones = [
      { x: 8, y: 8, w: 32, h: 27 },      // NW plateau interior
      { x: 69, y: 8, w: 51, h: 14 },      // NE ridge interior
      { x: 8, y: 99, w: 62, h: 21 },      // South shelf interior
      { x: 100, y: 79, w: 20, h: 22 },    // SE mound interior
    ];
    for (const zone of holeZones) {
      const holeCount = this.rng.between(1, 2);
      for (let h = 0; h < holeCount; h++) {
        for (let attempt = 0; attempt < 15; attempt++) {
          const hx = zone.x + this.rng.between(5, Math.max(6, zone.w - HOLE_2x2.w - 5));
          const hy = zone.y + this.rng.between(5, Math.max(6, zone.h - HOLE_2x2.h - 5));
          // Check all 4 tiles are filled (part of the elevated zone)
          let canPlace = true;
          for (let dy = 0; dy < HOLE_2x2.h && canPlace; dy++) {
            for (let dx = 0; dx < HOLE_2x2.w && canPlace; dx++) {
              const px = hx + dx; const py = hy + dy;
              if (px >= TILES_X || py >= TILES_Y) { canPlace = false; break; }
              if (data[py][px] === -1) canPlace = false; // must be on elevated terrain
            }
          }
          if (!canPlace) continue;
          // Place hole
          for (let dy = 0; dy < HOLE_2x2.h; dy++) {
            for (let dx = 0; dx < HOLE_2x2.w; dx++) {
              data[hy + dy][hx + dx] = HOLE_2x2.frames[dy][dx];
            }
          }
          break;
        }
      }
    }

    // ─── Small elevated mounds (frames 42-45 from plains.png row 7) ─────
    // Frame 42 = 1×1 small rock, Frame 43-44-45 = 3×1 wide mound composite
    const SMALL_MOUND_3x1 = [43, 44, 45];
    const moundPositions: [number, number][] = [
      [50, 42], [38, 68], [95, 42], [72, 58],
      [110, 62], [28, 82], [80, 42], [60, 92],
    ];
    for (const [mx, my] of moundPositions) {
      if (mx + 2 >= TILES_X || my >= TILES_Y) continue;
      // Only place on empty grass (not on elevated terrain or paths)
      if (this.elevatedPositions.has(`${mx},${my}`)) continue;
      if (data[my][mx] !== -1 || data[my][mx + 1] !== -1 || data[my][mx + 2] !== -1) continue;
      data[my][mx] = SMALL_MOUND_3x1[0];
      data[my][mx + 1] = SMALL_MOUND_3x1[1];
      data[my][mx + 2] = SMALL_MOUND_3x1[2];
      // Track as elevated
      this.elevatedPositions.add(`${mx},${my}`);
      this.elevatedPositions.add(`${mx + 1},${my}`);
      this.elevatedPositions.add(`${mx + 2},${my}`);
    }

    // Single-tile small rocks (frame 42)
    const smallRockPositions: [number, number][] = [
      [55, 48], [42, 72], [98, 38], [75, 62], [115, 55], [32, 88],
    ];
    for (const [rx, ry] of smallRockPositions) {
      if (rx >= TILES_X || ry >= TILES_Y) continue;
      if (this.elevatedPositions.has(`${rx},${ry}`)) continue;
      if (data[ry][rx] !== -1) continue;
      data[ry][rx] = 42;
      this.elevatedPositions.add(`${rx},${ry}`);
    }

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage(
      TILESET_KEYS.PLAINS,
      TILESET_KEYS.PLAINS,
      TILE_SIZE,
      TILE_SIZE
    );
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) {
      layer.setCollisionByExclusion([-1]);
    }
    return layer;
  }


  /**
   * Place an elevated zone with proper autotile edges.
   * SIMPLIFIED: Using simple rectangles first to validate autotiling.
   * Indentations disabled until visual rendering is confirmed correct.
   */
  private placeElevatedZone(
    data: number[][],
    startX: number,
    startY: number,
    width: number,
    height: number,
    _position: string
  ): void {
    // Create a boolean mask for the zone shape — simple rectangle for validation
    const mask: boolean[][] = [];
    for (let dy = 0; dy < height; dy++) {
      mask.push(new Array(width).fill(true));
    }

    // Apply simple shape carving (NO random indentations for now)
    switch (_position) {
      case 'nw-plateau':
        // L-shaped: remove a 22×18 chunk from bottom-right
        for (let dy = height - 18; dy < height; dy++) {
          for (let dx = width - 22; dx < width; dx++) {
            if (dy >= 0 && dy < height && dx >= 0 && dx < width) {
              mask[dy][dx] = false;
            }
          }
        }
        break;

      case 'ne-ridge':
        // Remove a wide notch from the bottom-center (passage for player)
        for (let dy = height - 10; dy < height; dy++) {
          for (let dx = 15; dx < 40 && dx < width; dx++) {
            mask[dy][dx] = false;
          }
        }
        break;

      case 'south-shelf':
        // Two large passages cut from the top edge
        for (let dy = 0; dy < 14 && dy < height; dy++) {
          for (let dx = 18; dx < 35 && dx < width; dx++) {
            mask[dy][dx] = false;
          }
        }
        for (let dy = 0; dy < 12 && dy < height; dy++) {
          for (let dx = 45; dx < 60 && dx < width; dx++) {
            mask[dy][dx] = false;
          }
        }
        break;

      case 'se-mound':
        // Remove top-left chunk to create an entrance
        for (let dy = 0; dy < 12; dy++) {
          for (let dx = 0; dx < 15 && dx < width; dx++) {
            if (dy >= 0 && dy < height) {
              mask[dy][dx] = false;
            }
          }
        }
        break;

      case 'central-rock':
        // Simple solid rectangle (tactical block)
        break;

      default:
        break;
    }

    // Assign tile frames using FULL 8-neighbor autotile logic
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        if (!mask[dy][dx]) continue;

        const mapX = startX + dx;
        const mapY = startY + dy;
        if (mapX >= MAP_CONFIG.TILES_X || mapY >= MAP_CONFIG.TILES_Y) continue;

        const frame = this.getPlainsTileFrame(mask, dx, dy, width, height);
        data[mapY][mapX] = frame;
        // Track elevated positions for decoration margin
        this.elevatedPositions.add(`${mapX},${mapY}`);
      }
    }
  }


  /**
   * Add irregular indentations to the zone mask for a natural look.
   */
  // @ts-ignore — unused method kept for potential future use
  private addIndentations(
    mask: boolean[][],
    width: number,
    height: number,
    topCount?: number,
    bottomCount?: number,
    leftCount?: number,
    rightCount?: number
  ): void {
    // Top edge indentations
    const topIndents = topCount ?? (2 + this.rng.between(0, 1));
    for (let i = 0; i < topIndents; i++) {
      const ix = this.rng.between(2, Math.max(3, width - 3));
      const iw = this.rng.between(2, 3);
      const ih = this.rng.between(2, 3);
      for (let dy = 0; dy < ih && dy < height; dy++) {
        for (let dx = 0; dx < iw && ix + dx < width; dx++) {
          mask[dy][ix + dx] = false;
        }
      }
    }

    // Bottom edge indentations
    const bottomIndents = bottomCount ?? (2 + this.rng.between(0, 1));
    for (let i = 0; i < bottomIndents; i++) {
      const ix = this.rng.between(2, Math.max(3, width - 3));
      const iw = this.rng.between(2, 3);
      const ih = this.rng.between(2, 3);
      for (let dy = 0; dy < ih && height - 1 - dy >= 0; dy++) {
        for (let dx = 0; dx < iw && ix + dx < width; dx++) {
          mask[height - 1 - dy][ix + dx] = false;
        }
      }
    }

    // Left edge indentations
    const leftIndent = leftCount ?? this.rng.between(1, 2);
    for (let i = 0; i < leftIndent; i++) {
      const iy = this.rng.between(2, Math.max(3, height - 3));
      const iw = this.rng.between(2, 3);
      const ih = this.rng.between(2, 3);
      for (let dy = 0; dy < ih && iy + dy < height; dy++) {
        for (let dx = 0; dx < iw; dx++) {
          mask[iy + dy][dx] = false;
        }
      }
    }

    // Right edge indentations
    const rightIndent = rightCount ?? this.rng.between(1, 2);
    for (let i = 0; i < rightIndent; i++) {
      const iy = this.rng.between(2, Math.max(3, height - 3));
      const iw = this.rng.between(2, 3);
      const ih = this.rng.between(2, 3);
      for (let dy = 0; dy < ih && iy + dy < height; dy++) {
        for (let dx = 0; dx < iw; dx++) {
          if (width - 1 - dx >= 0) {
            mask[iy + dy][width - 1 - dx] = false;
          }
        }
      }
    }
  }


  /**
   * Determine which plains tile frame to use based on neighbor adjacency.
   */
  private getPlainsTileFrame(
    mask: boolean[][],
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    const hasTop = y > 0 && mask[y - 1][x];
    const hasBottom = y < height - 1 && mask[y + 1][x];
    const hasLeft = x > 0 && mask[y][x - 1];
    const hasRight = x < width - 1 && mask[y][x + 1];

    // Corners
    if (!hasTop && !hasLeft && hasBottom && hasRight) return PLAINS_TILES.TOP_LEFT;
    if (!hasTop && !hasRight && hasBottom && hasLeft) return PLAINS_TILES.TOP_RIGHT;
    if (!hasBottom && !hasLeft && hasTop && hasRight) return PLAINS_TILES.BOTTOM_LEFT;
    if (!hasBottom && !hasRight && hasTop && hasLeft) return PLAINS_TILES.BOTTOM_RIGHT;

    // Edges
    if (!hasTop && hasBottom && hasLeft && hasRight) return PLAINS_TILES.TOP;
    if (!hasBottom && hasTop && hasLeft && hasRight) return PLAINS_TILES.BOTTOM;
    if (!hasLeft && hasRight && hasTop && hasBottom) return PLAINS_TILES.LEFT;
    if (!hasRight && hasLeft && hasTop && hasBottom) return PLAINS_TILES.RIGHT;

    // Interior fill (all neighbors present)
    if (hasTop && hasBottom && hasLeft && hasRight) {
      // Alternate fills for visual variety
      const variant = (x + y) % 2;
      return variant === 0 ? PLAINS_TILES.FILL_1 : PLAINS_TILES.FILL_2;
    }

    // Peninsula/isolated — use fill as fallback
    return PLAINS_TILES.FILL_1;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3: BORDER WALLS (2 tiles thick perimeter)
  // ═══════════════════════════════════════════════════════════════════════════

  private createWallLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE, BORDER_THICKNESS } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Fill the border with wall tiles (2 tiles thick)
    // For TOP wall: row 0 = perspective (grass→stone transition), row 1 = dark wall face
    // For BOTTOM wall: row TILES_Y-2 = dark wall face, row TILES_Y-1 = perspective
    // For LEFT/RIGHT walls: both rows use lateral tiles
    for (let y = 0; y < TILES_Y; y++) {
      for (let x = 0; x < TILES_X; x++) {
        const isInBorder =
          x < BORDER_THICKNESS ||
          x >= TILES_X - BORDER_THICKNESS ||
          y < BORDER_THICKNESS ||
          y >= TILES_Y - BORDER_THICKNESS;

        if (!isInBorder) continue;

        data[y][x] = this.getWallTileFrame(x, y, TILES_X, TILES_Y, BORDER_THICKNESS);
      }
    }

    // Override top wall perspective: row 0 gets green transition tiles (frames 0-1)
    for (let x = 0; x < TILES_X; x++) {
      data[0][x] = (x % 2 === 0) ? 0 : 1; // Perspective frames (row 0 of walls.png)
    }

    // Override bottom wall: penultimate row gets visible stone face (frames 8/16),
    // last row gets dark base (BOTTOM frames remain)
    for (let x = 0; x < TILES_X; x++) {
      data[TILES_Y - 2][x] = (x % 2 === 0) ? 8 : 16; // Visible blue-gray stone face
      data[TILES_Y - 1][x] = (x % 2 === 0) ? WALL_TILES.BOTTOM : WALL_TILES.BOTTOM_ALT;
    }

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage(
      TILESET_KEYS.WALLS,
      TILESET_KEYS.WALLS,
      TILE_SIZE,
      TILE_SIZE
    );
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) {
      layer.setCollisionByExclusion([-1]);
    }
    return layer;
  }


  /**
   * Determine wall tile frame based on position in the border.
   */
  private getWallTileFrame(
    x: number,
    y: number,
    tilesX: number,
    tilesY: number,
    border: number
  ): number {
    const isTop = y < border;
    const isBottom = y >= tilesY - border;
    const isLeft = x < border;
    const isRight = x >= tilesX - border;

    // Corners
    if (isTop && isLeft) return WALL_TILES.TOP_LEFT;
    if (isTop && isRight) return WALL_TILES.TOP_RIGHT;
    if (isBottom && isLeft) return WALL_TILES.BOTTOM_LEFT;
    if (isBottom && isRight) return WALL_TILES.BOTTOM_RIGHT;

    // Edges
    if (isTop) return (x % 2 === 0) ? WALL_TILES.TOP : WALL_TILES.TOP_ALT;
    if (isBottom) return (x % 2 === 0) ? WALL_TILES.BOTTOM : WALL_TILES.BOTTOM_ALT;
    if (isLeft) return (y % 2 === 0) ? WALL_TILES.LEFT : WALL_TILES.LEFT_ALT;
    if (isRight) return (y % 2 === 0) ? WALL_TILES.RIGHT : WALL_TILES.RIGHT_ALT;

    // Interior fill
    return WALL_TILES.FILL_1;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // PATH LAYER (gray cobblestone paths using plains.png rows 8-11)
  // ═══════════════════════════════════════════════════════════════════════════

  private createPathLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Gray cobblestone path tiles from plains.png rows 8-11
    // Row 8 (F48-53): grass-to-stone transition at top (top edge tiles)
    // Row 9 (F54-59): stone body (middle/fill tiles)
    // Row 10 (F60-65): stone-to-grass transition at bottom (bottom edge tiles)
    // Using specific frames for autotile:
    const PATH = {
      TOP_LEFT: 48,     // Grass corners at TL (row 8, col 0)
      TOP: 50,          // Top edge (row 8, col 2)
      TOP_RIGHT: 51,    // Grass corner at TR (row 8, col 3)
      LEFT: 54,         // Left edge body (row 9, col 0)
      FILL: 56,         // Center fill (row 9, col 2) — most uniform stone
      RIGHT: 57,        // Right edge body (row 9, col 3)
      BOTTOM_LEFT: 60,  // Bottom-left (row 10, col 0)
      BOTTOM: 62,       // Bottom edge (row 10, col 2)
      BOTTOM_RIGHT: 63, // Bottom-right (row 10, col 3)
    };

    // Helper: place a horizontal path (3 tiles tall) with proper edge tiles
    const placeHPath = (startCol: number, endCol: number, centerRow: number): void => {
      for (let col = startCol; col <= endCol; col++) {
        if (col < 0 || col >= TILES_X) continue;
        const isLeft = col === startCol;
        const isRight = col === endCol;

        const topRow = centerRow - 1;
        const botRow = centerRow + 1;

        // Top row (top edge of horizontal path)
        if (topRow >= 0 && topRow < TILES_Y) {
          const tile = isLeft ? PATH.TOP_LEFT : isRight ? PATH.TOP_RIGHT : PATH.TOP;
          data[topRow][col] = tile;
          this.pathPositions.add(`${col},${topRow}`);
        }
        // Center row (fill)
        if (centerRow >= 0 && centerRow < TILES_Y) {
          const tile = isLeft ? PATH.LEFT : isRight ? PATH.RIGHT : PATH.FILL;
          data[centerRow][col] = tile;
          this.pathPositions.add(`${col},${centerRow}`);
        }
        // Bottom row (bottom edge of horizontal path)
        if (botRow >= 0 && botRow < TILES_Y) {
          const tile = isLeft ? PATH.BOTTOM_LEFT : isRight ? PATH.BOTTOM_RIGHT : PATH.BOTTOM;
          data[botRow][col] = tile;
          this.pathPositions.add(`${col},${botRow}`);
        }
      }
    };

    // Helper: place a vertical path (3 tiles wide) with proper edge tiles
    const placeVPath = (startRow: number, endRow: number, centerCol: number): void => {
      for (let row = startRow; row <= endRow; row++) {
        if (row < 0 || row >= TILES_Y) continue;
        const isTop = row === startRow;
        const isBottom = row === endRow;

        const leftCol = centerCol - 1;
        const rightCol = centerCol + 1;

        // Left column (left edge of vertical path)
        if (leftCol >= 0 && leftCol < TILES_X) {
          const tile = isTop ? PATH.TOP_LEFT : isBottom ? PATH.BOTTOM_LEFT : PATH.LEFT;
          data[row][leftCol] = tile;
          this.pathPositions.add(`${leftCol},${row}`);
        }
        // Center column (fill)
        if (centerCol >= 0 && centerCol < TILES_X) {
          const tile = isTop ? PATH.TOP : isBottom ? PATH.BOTTOM : PATH.FILL;
          data[row][centerCol] = tile;
          this.pathPositions.add(`${centerCol},${row}`);
        }
        // Right column (right edge of vertical path)
        if (rightCol >= 0 && rightCol < TILES_X) {
          const tile = isTop ? PATH.TOP_RIGHT : isBottom ? PATH.BOTTOM_RIGHT : PATH.RIGHT;
          data[row][rightCol] = tile;
          this.pathPositions.add(`${rightCol},${row}`);
        }
      }
    };

    // Helper: fill intersection area with FILL tiles (where paths cross)
    const fillIntersection = (col: number, row: number): void => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const y = row + dy;
          const x = col + dx;
          if (x >= 0 && x < TILES_X && y >= 0 && y < TILES_Y) {
            data[y][x] = PATH.FILL;
            this.pathPositions.add(`${x},${y}`);
          }
        }
      }
    };

    // ─── Main path network (3 tiles wide) ────────────────────────────────
    // Central vertical path: cols 62-64, rows 36-88
    placeVPath(36, 88, 63);

    // Central horizontal path: cols 28-95, rows 62-64
    placeHPath(28, 95, 63);

    // Path to cemetery: cols 52-54, rows 50-62
    placeVPath(50, 62, 53);

    // NE branch horizontal: cols 75-85, rows 27-29
    placeHPath(75, 85, 28);

    // Connect NE branch to main vertical: cols 84-86, rows 29-36
    placeVPath(29, 36, 85);

    // SE branch: cols 89-91, rows 64-82
    placeVPath(64, 82, 90);

    // ─── Fill intersections where paths cross ────────────────────────────
    // Main cross (vertical col 63 meets horizontal row 63)
    fillIntersection(63, 63);
    // Cemetery branch meets horizontal (col 53, row 63)
    fillIntersection(53, 63);
    // NE connector meets main vertical (col 85, row 36) — close to top of main V
    fillIntersection(85, 36);
    // SE branch meets horizontal (col 90, row 63)
    fillIntersection(90, 63);

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage(
      TILESET_KEYS.PLAINS,
      TILESET_KEYS.PLAINS,
      TILE_SIZE,
      TILE_SIZE
    );
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    return layer;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: FENCES (large meaningful structures with gaps)
  // ═══════════════════════════════════════════════════════════════════════════

  private createFenceLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // ─── 1. Graveyard perimeter (cols 40-70, rows 50-75) ───────────────────
    // North fence
    this.placeFenceSegment(data, 'horizontal', 40, 50, 70, 50);
    // East fence
    this.placeFenceSegment(data, 'vertical', 70, 50, 70, 75);
    // South fence with entry gap at cols 52-56
    this.placeFenceSegment(data, 'horizontal', 40, 75, 51, 75);
    this.placeFenceSegment(data, 'horizontal', 57, 75, 70, 75);
    // West fence
    this.placeFenceSegment(data, 'vertical', 40, 50, 40, 75);

    // ─── 2. Small NW enclosure — REMOVED ──────────────────────────────────

    // ─── 3. Horizontal separator row 35, cols 30-55, gap at 40-43 ──────────
    this.placeFenceSegment(data, 'horizontal', 30, 35, 39, 35);
    this.placeFenceSegment(data, 'horizontal', 44, 35, 55, 35);

    // ─── 4. Short fragments ─────────────────────────────────────────────────
    // Eastern vertical fragment
    this.placeFenceSegment(data, 'vertical', 85, 45, 85, 52);
    // Southern horizontal fragment
    this.placeFenceSegment(data, 'horizontal', 55, 85, 62, 85);
    // SW vertical fragment
    this.placeFenceSegment(data, 'vertical', 50, 80, 50, 86);

    // Remove fence tiles where paths cross (keep paths open for navigation)
    for (let y = 0; y < TILES_Y; y++) {
      for (let x = 0; x < TILES_X; x++) {
        if (data[y][x] !== -1 && this.pathPositions.has(`${x},${y}`)) {
          data[y][x] = -1;
        }
      }
    }

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage(
      TILESET_KEYS.FENCES,
      TILESET_KEYS.FENCES,
      TILE_SIZE,
      TILE_SIZE
    );
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) {
      layer.setDepth(LAYER_DEPTH.FENCES);
      layer.setCollisionByExclusion([-1]);
    }
    return layer;
  }


  /**
   * Place a fence segment (horizontal or vertical) between two points.
   * Endpoints get corner/post tiles, midpoints get directional tiles.
   */
  private placeFenceSegment(
    data: number[][],
    direction: 'horizontal' | 'vertical',
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): void {
    if (direction === 'horizontal') {
      const row = startY;
      if (row >= MAP_CONFIG.TILES_Y || row < 0) return;
      for (let col = startX; col <= endX; col++) {
        if (col >= MAP_CONFIG.TILES_X || col < 0) continue;
        if (col === startX) {
          data[row][col] = FENCE_TILES.CORNER_TOP_LEFT;
        } else if (col === endX) {
          data[row][col] = FENCE_TILES.CORNER_TOP_RIGHT;
        } else {
          data[row][col] = FENCE_TILES.HORIZONTAL;
        }
      }
    } else {
      const col = startX;
      if (col >= MAP_CONFIG.TILES_X || col < 0) return;
      for (let row = startY; row <= endY; row++) {
        if (row >= MAP_CONFIG.TILES_Y || row < 0) continue;
        if (row === startY) {
          data[row][col] = FENCE_TILES.CORNER_TOP_LEFT;
        } else if (row === endY) {
          data[row][col] = FENCE_TILES.CORNER_BOTTOM_LEFT;
        } else {
          data[row][col] = FENCE_TILES.VERTICAL;
        }
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 5: DECORATIONS (small grass details from decor_16x16.png)
  // ═══════════════════════════════════════════════════════════════════════════

  private createDecorLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Curated whitelist of decor_16x16.png frames that render correctly as
    // standalone individual tiles. Excludes partial/broken plant fragments
    // (frames that show only the top half of a plant — dark green silhouettes
    // without a base that appear as "cut bushes").
    // decor_16x16.png layout: 4 cols × 5 rows = 20 frames (0-19)
    //   Row 0 (0-3): Gravestones — small solid shapes, all OK
    //   Row 1 (4-7): Crosses/tall markers — frames 4,5 are partial tops, EXCLUDE
    //   Row 2 (8-11): Broken tombstones — frames 8,9 partial fragments, EXCLUDE
    //   Row 3 (12-15): Small decor — all solid small items, OK
    //   Row 4 (16-19): Additional — frames 16,17 partial tops, EXCLUDE
    const SAFE_DECOR_FRAMES = [
      0, 1, 2, 3,     // Row 0: complete gravestones
      6, 7,           // Row 1: solid tall markers (not partial tops)
      10, 11,         // Row 2: solid worn stones (not fragments)
      12, 13, 14, 15, // Row 3: small complete decor items
      18, 19,         // Row 4: solid additional decor
    ];

    // Near elevated edges: dense
    this.placeDecorZone(data, 3, 36, 42, 48, 35, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 64, 23, 125, 28, 30, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 3, 92, 72, 97, 30, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 82, 72, 88, 78, 8, SAFE_DECOR_FRAMES);

    // ON elevated terrain interiors (flowers and plants on platforms)
    this.placeDecorZoneDirect(data, 10, 10, 35, 30, 40, SAFE_DECOR_FRAMES);  // NW plateau
    this.placeDecorZoneDirect(data, 72, 8, 118, 18, 35, SAFE_DECOR_FRAMES);  // NE ridge
    this.placeDecorZoneDirect(data, 10, 100, 65, 118, 40, SAFE_DECOR_FRAMES); // South shelf
    this.placeDecorZoneDirect(data, 103, 82, 118, 100, 20, SAFE_DECOR_FRAMES); // SE mound
    this.placeDecorZoneDirect(data, 12, 54, 24, 64, 12, SAFE_DECOR_FRAMES);  // Central-West

    // Open grass areas: medium density
    this.placeDecorZone(data, 28, 38, 55, 50, 25, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 72, 30, 100, 50, 30, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 3, 68, 38, 92, 30, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 100, 50, 125, 72, 25, SAFE_DECOR_FRAMES);

    // Near paths: sparse
    this.placeDecorZone(data, 60, 36, 66, 90, 12, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 25, 60, 100, 66, 15, SAFE_DECOR_FRAMES);

    // Combat center: minimal
    this.placeDecorZone(data, 45, 55, 55, 72, 5, SAFE_DECOR_FRAMES);

    // Scattered across remaining map
    this.placeDecorZone(data, 45, 5, 62, 30, 18, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 100, 80, 125, 95, 15, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 3, 100, 40, 125, 20, SAFE_DECOR_FRAMES);

    // ─── Extra density: bottom-left corner ──────────────────────────────
    this.placeDecorZone(data, 3, 100, 25, 115, 25, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 3, 115, 35, 125, 20, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 25, 105, 40, 120, 18, SAFE_DECOR_FRAMES);

    // ─── Extra density: upper-center area ───────────────────────────────
    this.placeDecorZone(data, 38, 3, 55, 15, 20, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 55, 3, 70, 20, 22, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 40, 15, 65, 28, 18, SAFE_DECOR_FRAMES);

    // ─── Extra density: bottom-right corner ─────────────────────────────
    this.placeDecorZone(data, 85, 100, 110, 118, 40, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 100, 95, 125, 112, 35, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 90, 115, 125, 125, 30, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 80, 108, 100, 125, 30, SAFE_DECOR_FRAMES);
    this.placeDecorZone(data, 108, 105, 125, 125, 25, SAFE_DECOR_FRAMES);

    const map = this.scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(TILESET_KEYS.DECOR_16, TILESET_KEYS.DECOR_16, TILE_SIZE, TILE_SIZE);
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) { layer.setDepth(LAYER_DEPTH.DECOR); }
    return layer;
  }


  /**
   * Place decor items in a zone with cluster-based distribution.
   */
  private placeDecorZone(
    data: number[][], x1: number, y1: number, x2: number, y2: number,
    count: number, frames: readonly number[]
  ): void {
    const border = MAP_CONFIG.BORDER_THICKNESS;
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 6;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const cx = this.rng.between(x1, x2);
      const cy = this.rng.between(y1, y2);
      const clusterSize = this.rng.between(2, 5);
      for (let i = 0; i < clusterSize && placed < count; i++) {
        const tx = cx + this.rng.between(-2, 2);
        const ty = cy + this.rng.between(-2, 2);
        if (tx < 0 || tx >= MAP_CONFIG.TILES_X) continue;
        if (ty < 0 || ty >= MAP_CONFIG.TILES_Y) continue;
        // Skip wall border zone
        if (tx < border || tx >= MAP_CONFIG.TILES_X - border ||
            ty < border || ty >= MAP_CONFIG.TILES_Y - border) continue;
        if (data[ty][tx] !== -1) continue;
        if (this.isInSpawnZone(tx, ty)) continue;
        data[ty][tx] = frames[this.rng.between(0, frames.length - 1)];
        placed++;
      }
    }
  }

  /**
   * Place decor directly in a zone with minimum spacing (for elevated interiors).
   */
  private placeDecorZoneDirect(
    data: number[][], x1: number, y1: number, x2: number, y2: number,
    count: number, frames: readonly number[]
  ): void {
    const border = MAP_CONFIG.BORDER_THICKNESS;
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 8;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const tx = this.rng.between(x1, x2);
      const ty = this.rng.between(y1, y2);
      if (tx < 0 || tx >= MAP_CONFIG.TILES_X) continue;
      if (ty < 0 || ty >= MAP_CONFIG.TILES_Y) continue;
      // Skip wall border zone
      if (tx < border || tx >= MAP_CONFIG.TILES_X - border ||
          ty < border || ty >= MAP_CONFIG.TILES_Y - border) continue;
      if (data[ty][tx] !== -1) continue;
      // Minimum 2-tile spacing
      let tooClose = false;
      for (let dy = -2; dy <= 2 && !tooClose; dy++) {
        for (let dx = -2; dx <= 2 && !tooClose; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = ty + dy; const nx = tx + dx;
          if (ny >= 0 && ny < MAP_CONFIG.TILES_Y && nx >= 0 && nx < MAP_CONFIG.TILES_X) {
            if (data[ny][nx] !== -1) tooClose = true;
          }
        }
      }
      if (tooClose) continue;
      data[ty][tx] = frames[this.rng.between(0, frames.length - 1)];
      placed++;
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 6: OBJECTS (rich environmental objects from objects.png)
  // ═══════════════════════════════════════════════════════════════════════════

  private createObjectsLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // A. Graveyard objects
    this.placeGraveyardObjects(data);
    // B. Trees (on ground level)
    this.placeTreeClusters(data);
    // C. Rocks/Stones
    this.placeRockFormations(data);
    // D. Bushes
    this.placeBushes(data);
    // E. Stumps/Logs
    this.placeStumpsAndLogs(data);
    // F. Benches (removed)
    this.placeBenches(data);
    // G. Elevated terrain decoration (trees, stumps, bushes ON platforms)
    this.placeElevatedTerrainDecor(data);
    // H. Skulls and skeletons scattered across the ENTIRE map
    this.placeSkullsEverywhere(data);

    const map = this.scene.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(TILESET_KEYS.OBJECTS, TILESET_KEYS.OBJECTS, TILE_SIZE, TILE_SIZE);
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) { layer.setDepth(LAYER_DEPTH.OBJECTS); }
    return layer;
  }

  /**
   * Create invisible circular static bodies at each grave position (frame 6 and 7).
   * Scans the actual objects tilemap layer to find all graves everywhere on the map.
   * Circular bodies give smooth sliding collisions.
   */
  private createGraveColliders(objectsLayer: Phaser.Tilemaps.TilemapLayer | null): Phaser.Physics.Arcade.StaticGroup {
    const { TILE_SIZE } = MAP_CONFIG;
    const group = this.scene.physics.add.staticGroup();

    if (!objectsLayer) return group;

    objectsLayer.forEachTile((tile) => {
      if (tile.index === 6 || tile.index === 7) {
        const worldX = tile.pixelX + TILE_SIZE / 2;
        const worldY = tile.pixelY + TILE_SIZE / 2;

        const zone = this.scene.add.zone(worldX, worldY, TILE_SIZE, TILE_SIZE);
        group.add(zone);

        const body = zone.body as Phaser.Physics.Arcade.StaticBody;
        body.setCircle(6, TILE_SIZE / 2 - 6, TILE_SIZE / 2 - 6);
        body.updateFromGameObject();
      }
    });

    return group;
  }

  // @ts-ignore — unused method kept for potential future use
  private addGraveBody(group: Phaser.Physics.Arcade.StaticGroup, tileX: number, tileY: number, tileSize: number): void {
    const worldX = tileX * tileSize + tileSize / 2;
    const worldY = tileY * tileSize + tileSize / 2;

    const zone = this.scene.add.zone(worldX, worldY, tileSize, tileSize);
    group.add(zone);

    const body = zone.body as Phaser.Physics.Arcade.StaticBody;
    body.setCircle(6, tileSize / 2 - 6, tileSize / 2 - 6);
    body.updateFromGameObject();
  }


  /**
   * Create circular static bodies at each tree TRUNK position (bottom 2 rows of each tree).
   * Trees are 3×4 composites. Rows 0-1 are canopy (no collision), rows 2-3 are trunk (collision).
   * 
   * Tree types and their trunk frame indices:
   * - deciduous_A: rows 7-8, cols 0-2 → frames 112,113,114,128,129,130
   * - pine_B: rows 7-8, cols 3-5 → frames 115,116,117,131,132,133
   * - deciduous_D: rows 11-12, cols 0-2 → frames 176,177,178,192,193,194
   * - pine_E: rows 11-12, cols 3-5 → frames 179,180,181,195,196,197
   */
  private createTreeColliders(objectsLayer: Phaser.Tilemaps.TilemapLayer | null): Phaser.Physics.Arcade.StaticGroup {
    const { TILE_SIZE } = MAP_CONFIG;
    const group = this.scene.physics.add.staticGroup();

    if (!objectsLayer) return group;

    // Tree trunk frames (bottom 2 rows of each tree type)
    // Format: row * 16 + col
    const TRUNK_FRAMES = new Set<number>([
      // deciduous_A: rows 7-8, cols 0-2
      7 * 16 + 0, 7 * 16 + 1, 7 * 16 + 2,   // 112, 113, 114
      8 * 16 + 0, 8 * 16 + 1, 8 * 16 + 2,   // 128, 129, 130
      // pine_B: rows 7-8, cols 3-5
      7 * 16 + 3, 7 * 16 + 4, 7 * 16 + 5,   // 115, 116, 117
      8 * 16 + 3, 8 * 16 + 4, 8 * 16 + 5,   // 131, 132, 133
      // deciduous_D: rows 11-12, cols 0-2
      11 * 16 + 0, 11 * 16 + 1, 11 * 16 + 2, // 176, 177, 178
      12 * 16 + 0, 12 * 16 + 1, 12 * 16 + 2, // 192, 193, 194
      // pine_E: rows 11-12, cols 3-5
      11 * 16 + 3, 11 * 16 + 4, 11 * 16 + 5, // 179, 180, 181
      12 * 16 + 3, 12 * 16 + 4, 12 * 16 + 5, // 195, 196, 197
    ]);

    objectsLayer.forEachTile((tile) => {
      if (TRUNK_FRAMES.has(tile.index)) {
        const worldX = tile.pixelX + TILE_SIZE / 2;
        const worldY = tile.pixelY + TILE_SIZE / 2;

        const zone = this.scene.add.zone(worldX, worldY, TILE_SIZE, TILE_SIZE);
        group.add(zone);

        const body = zone.body as Phaser.Physics.Arcade.StaticBody;
        // Circular body with radius 6px for smooth sliding around trunks
        body.setCircle(6, TILE_SIZE / 2 - 6, TILE_SIZE / 2 - 6);
        body.updateFromGameObject();
      }
    });

    return group;
  }

  /**
   * Create standalone sprites for tree canopy tiles (top 2 rows of each tree).
   * These sprites render at a high depth so the player can walk "behind" the canopy.
   * The canopy tiles are removed from the objects tilemap layer to avoid double-rendering.
   * 
   * Tree canopy frame indices:
   * - deciduous_A: rows 5-6, cols 0-2 → frames 80,81,82,96,97,98
   * - pine_B: rows 5-6, cols 3-5 → frames 83,84,85,99,100,101
   * - deciduous_D: rows 9-10, cols 0-2 → frames 144,145,146,160,161,162
   * - pine_E: rows 9-10, cols 3-5 → frames 147,148,149,163,164,165
   */
  private createTreeCanopySprites(objectsLayer: Phaser.Tilemaps.TilemapLayer | null): Phaser.GameObjects.Sprite[] {
    const { TILE_SIZE } = MAP_CONFIG;
    const sprites: Phaser.GameObjects.Sprite[] = [];

    if (!objectsLayer) return sprites;

    // Tree canopy frames (top 2 rows of each tree type)
    const CANOPY_FRAMES = new Set<number>([
      // deciduous_A: rows 5-6, cols 0-2
      5 * 16 + 0, 5 * 16 + 1, 5 * 16 + 2,   // 80, 81, 82
      6 * 16 + 0, 6 * 16 + 1, 6 * 16 + 2,   // 96, 97, 98
      // pine_B: rows 5-6, cols 3-5
      5 * 16 + 3, 5 * 16 + 4, 5 * 16 + 5,   // 83, 84, 85
      6 * 16 + 3, 6 * 16 + 4, 6 * 16 + 5,   // 99, 100, 101
      // deciduous_D: rows 9-10, cols 0-2
      9 * 16 + 0, 9 * 16 + 1, 9 * 16 + 2,   // 144, 145, 146
      10 * 16 + 0, 10 * 16 + 1, 10 * 16 + 2, // 160, 161, 162
      // pine_E: rows 9-10, cols 3-5
      9 * 16 + 3, 9 * 16 + 4, 9 * 16 + 5,   // 147, 148, 149
      10 * 16 + 3, 10 * 16 + 4, 10 * 16 + 5, // 163, 164, 165
    ]);

    objectsLayer.forEachTile((tile) => {
      if (CANOPY_FRAMES.has(tile.index)) {
        const worldX = tile.pixelX + TILE_SIZE / 2;
        const worldY = tile.pixelY + TILE_SIZE / 2;

        // Create a sprite for this canopy tile
        const sprite = this.scene.add.sprite(worldX, worldY, TILESET_KEYS.OBJECTS, tile.index);
        sprite.setOrigin(0.5, 0.5);
        // Depth based on the trunk's Y position (canopy is 2 tiles above trunk bottom)
        // The trunk bottom is 2 tiles below the canopy, so use canopy Y + 3 tiles worth
        // This ensures depth sorting: player south of trunk → player renders on top
        const trunkBottomY = worldY + TILE_SIZE * 3; // approximate trunk base Y
        sprite.setDepth(LAYER_DEPTH.OBJECTS + trunkBottomY / 10000);
        sprites.push(sprite);

        // Remove from tilemap layer to avoid double-rendering
        tile.index = -1;
      }
    });

    return sprites;
  }


  /** Place graveyard objects: organized rows of gravestones, avoiding paths. */
  private placeGraveyardObjects(data: number[][]): void {
    // Frame 6 = GRAVESTONE (stone/gray lápida)
    const GRAVESTONE_FRAME = 6;
    // Frame 8 = skull decoration (2 tiles to the right)
    const SKULL_FRAME_1 = 8;
    // Frame 9 = second skull version
    const SKULL_FRAME_2 = 9;
    // Frame 7 = tomb variant (brown)
    const TOMB_FRAME = 7;

    // Graveyard area: inside fence (cols 42-68, rows 52-73)
    const startX = 42;
    const endX = 68;
    const startY = 52;
    const endY = 73;

    // ─── MAIN: ~55+ gravestones (frame 6) in organized rows ───────────────
    // 9 rows of 6-7 gravestones each
    const rowSpacing = 2;
    const colSpacing = 3;
    let currentRow = startY + 2;

    for (let rowIdx = 0; rowIdx < 9 && currentRow < endY - 1; rowIdx++) {
      const rowOffset = (rowIdx % 2 === 0) ? 0 : 1;
      const stonesInRow = (rowIdx % 2 === 0) ? 7 : 6;

      for (let col = 0; col < stonesInRow; col++) {
        const x = startX + 1 + rowOffset + col * colSpacing;
        if (x >= endX) break;
        if (x < 0 || x >= MAP_CONFIG.TILES_X) continue;
        if (currentRow < 0 || currentRow >= MAP_CONFIG.TILES_Y) continue;
        if (data[currentRow][x] !== -1) continue;
        // Don't place on paths
        if (this.pathPositions.has(`${x},${currentRow}`)) continue;

        data[currentRow][x] = GRAVESTONE_FRAME;
      }
      currentRow += rowSpacing;
    }

    // ─── SKULLS: Both skull versions scattered ───────────────────────────
    const skullSpots: [number, number, number][] = [
      [startX + 2, startY + 3, SKULL_FRAME_1],
      [startX + 10, startY + 3, SKULL_FRAME_2],
      [startX + 16, startY + 6, SKULL_FRAME_1],
      [startX + 5, startY + 9, SKULL_FRAME_2],
      [startX + 13, startY + 9, SKULL_FRAME_1],
      [startX + 20, startY + 12, SKULL_FRAME_2],
      [startX + 3, startY + 15, SKULL_FRAME_1],
      [startX + 11, startY + 15, SKULL_FRAME_2],
      [startX + 18, startY + 18, SKULL_FRAME_1],
      [startX + 8, startY + 18, SKULL_FRAME_2],
    ];
    for (const [dx, dy, frame] of skullSpots) {
      if (dx >= endX || dy >= endY) continue;
      if (dx < 0 || dy < 0 || dx >= MAP_CONFIG.TILES_X || dy >= MAP_CONFIG.TILES_Y) continue;
      if (data[dy][dx] !== -1) continue;
      if (this.pathPositions.has(`${dx},${dy}`)) continue;
      data[dy][dx] = frame;
    }

    // ─── TOMB VARIANTS (frame 7) ─────────────────────────────────────────
    const tombSpots: [number, number][] = [
      [startX + 4, startY + 5], [startX + 12, startY + 8],
      [startX + 18, startY + 11], [startX + 7, startY + 14],
      [startX + 15, startY + 17], [startX + 22, startY + 4],
      [startX + 1, startY + 11], [startX + 19, startY + 8],
    ];
    for (const [tx, ty] of tombSpots) {
      if (tx >= endX || ty >= endY) continue;
      if (tx < 0 || ty < 0 || tx >= MAP_CONFIG.TILES_X || ty >= MAP_CONFIG.TILES_Y) continue;
      if (data[ty][tx] !== -1) continue;
      if (this.pathPositions.has(`${tx},${ty}`)) continue;
      data[ty][tx] = TOMB_FRAME;
    }
  }

  /** Place trees as COMPLETE composite objects (3×4 or 2×4 tiles each). */
  private placeTreeClusters(data: number[][]): void {
    // Tree definitions: each tree is a multi-tile composite object
    // Format: [colStart, rowStart, width, height] in the objects.png spritesheet
    // Frame index = row * 16 + col (16 columns per row in objects.png)
    const TREE_TYPES = [
      { name: 'deciduous_A', cols: [0, 1, 2], rows: [5, 6, 7, 8], w: 3, h: 4 },
      { name: 'pine_B', cols: [3, 4, 5], rows: [5, 6, 7, 8], w: 3, h: 4 },
      { name: 'deciduous_D', cols: [0, 1, 2], rows: [9, 10, 11, 12], w: 3, h: 4 },
      { name: 'pine_E', cols: [3, 4, 5], rows: [9, 10, 11, 12], w: 3, h: 4 },
    ];

    // Cluster positions: [centerX, centerY, radius, count]
    const clusters: [number, number, number, number][] = [
      [18, 12, 12, 3],   // NW elevated surface
      [92, 8, 10, 3],    // NE elevated surface
      [105, 88, 8, 2],   // SE elevated surface
      [30, 108, 10, 3],  // South shelf
      [12, 70, 6, 2],    // West natural area
      [75, 42, 6, 2],    // East of center
      [108, 55, 6, 2],   // Far east
      [55, 88, 5, 1],    // South center
      [85, 30, 5, 1],    // NE area
      [30, 45, 5, 1],    // West corridor
      // Bottom-right corner (extra density)
      [100, 110, 8, 3],  // SE corner trees
      [115, 95, 6, 2],   // Far SE
      [110, 115, 6, 2],  // Bottom-right edge
      [95, 100, 5, 2],   // Near SE mound
    ];

    for (const [cx, cy, radius, count] of clusters) {
      for (let i = 0; i < count; i++) {
        // Pick a random tree type
        const treeType = TREE_TYPES[this.rng.between(0, TREE_TYPES.length - 1)];
        // Find position with enough space (minimum spacing = tree width + 2)
        let placed = false;
        for (let attempt = 0; attempt < 15 && !placed; attempt++) {
          const tx = cx + this.rng.between(-radius, radius);
          const ty = cy + this.rng.between(-radius, radius);

          // Check the tree fits and doesn't overlap anything
          if (!this.canPlaceComposite(data, tx, ty, treeType.w, treeType.h)) continue;

          // Place all tiles of the composite tree
          for (let dy = 0; dy < treeType.h; dy++) {
            for (let dx = 0; dx < treeType.w; dx++) {
              const mapX = tx + dx;
              const mapY = ty + dy;
              const frameCol = treeType.cols[dx];
              const frameRow = treeType.rows[dy];
              const frameIndex = frameRow * 16 + frameCol;
              data[mapY][mapX] = frameIndex;
            }
          }
          placed = true;
        }
      }
    }
  }

  /**
   * Check if a composite object of given width×height can be placed at (x, y).
   * Verifies: within bounds, no overlap with existing tiles, not in spawn zone,
   * and has a 2-tile margin from other objects.
   */
  private canPlaceComposite(
    data: number[][],
    x: number,
    y: number,
    w: number,
    h: number
  ): boolean {
    const margin = 2; // tiles margin around the object

    // Check bounds (with margin)
    if (x - margin < 0 || x + w + margin >= MAP_CONFIG.TILES_X) return false;
    if (y - margin < 0 || y + h + margin >= MAP_CONFIG.TILES_Y) return false;

    // Check spawn zone
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (this.isInSpawnZone(x + dx, y + dy)) return false;
      }
    }

    // Check no overlap (including margin)
    for (let dy = -margin; dy < h + margin; dy++) {
      for (let dx = -margin; dx < w + margin; dx++) {
        const checkX = x + dx;
        const checkY = y + dy;
        if (checkX < 0 || checkX >= MAP_CONFIG.TILES_X) continue;
        if (checkY < 0 || checkY >= MAP_CONFIG.TILES_Y) continue;
        if (data[checkY][checkX] !== -1) return false;
      }
    }

    return true;
  }

  /** Place rock/stone formations (~30-40 total). */
  private placeRockFormations(data: number[][]): void {
    // Removed frame 43 (red furniture/table) — only gray rocks
    const ROCK_FRAMES: number[] = [6, 16, 17, 18, ...OBSTACLE_FRAMES.slice(0, 5)];
    const clusters: [number, number, number, number][] = [
      [42, 20, 4, 4], [10, 36, 5, 4], [70, 25, 4, 3],
      [110, 22, 4, 3], [25, 93, 4, 3], [50, 93, 4, 3],
      [60, 45, 2, 2], [75, 63, 2, 2], [90, 70, 2, 2],
      [48, 82, 4, 4], [15, 80, 4, 4], [105, 45, 3, 3], [80, 98, 3, 3],
    ];
    for (const [cx, cy, radius, count] of clusters) {
      this.placeCluster(data, cx, cy, radius, count, ROCK_FRAMES);
    }
  }

  /** Place bushes/tall plants as 2×4 COMPLETE composite objects (cols 8-9, rows 5-8). */
  private placeBushes(data: number[][]): void {
    // Full tall bush/plant = cols 8-9, rows 5-8 = 2 wide × 4 tall
    // Frames: [88,89], [104,105], [120,121], [136,137]
    const BUSH_FULL = {
      frames: [[88, 89], [104, 105], [120, 121], [136, 137]],
      w: 2, h: 4,
    };

    const positions: [number, number][] = [
      [22, 18], [92, 12], [38, 110], [42, 49],
      [68, 49], [12, 42], [95, 65], [78, 55],
      [35, 60], [110, 70], [50, 95], [16, 12],
      [88, 14], [30, 106], [60, 70], [65, 50],
      // Bottom-right corner extra bushes
      [100, 105], [108, 112], [115, 100], [95, 118],
    ];

    for (const [cx, cy] of positions) {
      if (this.canPlaceComposite(data, cx, cy, BUSH_FULL.w, BUSH_FULL.h)) {
        for (let dy = 0; dy < BUSH_FULL.h; dy++) {
          for (let dx = 0; dx < BUSH_FULL.w; dx++) {
            data[cy + dy][cx + dx] = BUSH_FULL.frames[dy][dx];
          }
        }
      }
    }
  }

  /** Place stumps as 2×4 COMPLETE composite objects (cols 6-7, rows 5-8). */
  private placeStumpsAndLogs(data: number[][]): void {
    // Full stump/cut tree = cols 6-7, rows 5-8 = 2 wide × 4 tall
    // Frames: [86,87], [102,103], [118,119], [134,135]
    const STUMP_FULL = {
      frames: [[86, 87], [102, 103], [118, 119], [134, 135]],
      w: 2, h: 4,
    };

    const positions: [number, number][] = [
      [25, 20], [95, 13], [40, 112], [8, 48],
      [45, 93], [100, 60], [80, 90], [115, 80],
      [30, 75], [62, 48], [18, 22], [65, 75],
      // Bottom-right corner extra stumps
      [105, 100], [112, 108], [98, 115], [118, 112],
    ];

    for (const [cx, cy] of positions) {
      if (this.canPlaceComposite(data, cx, cy, STUMP_FULL.w, STUMP_FULL.h)) {
        for (let dy = 0; dy < STUMP_FULL.h; dy++) {
          for (let dx = 0; dx < STUMP_FULL.w; dx++) {
            data[cy + dy][cx + dx] = STUMP_FULL.frames[dy][dx];
          }
        }
      }
    }
  }

  /** Benches removed per user request (frame 44 looked like beds/shelves). */
  private placeBenches(_data: number[][]): void {
    // Intentionally empty — benches/beds removed
  }

  /** Scatter skulls, bones and gravestones across the entire map for cemetery atmosphere. */
  private placeSkullsEverywhere(data: number[][]): void {
    // Frame 8 = skull version 1, Frame 9 = skull/bone version 2
    const SKULL_FRAMES = [8, 9];
    // Frame 6 = gravestone (gray lápida)
    const GRAVESTONE = 6;

    // 80 skulls spread across the whole map
    let placed = 0;
    let attempts = 0;
    while (placed < 80 && attempts < 800) {
      attempts++;
      const x = this.rng.between(4, MAP_CONFIG.TILES_X - 4);
      const y = this.rng.between(4, MAP_CONFIG.TILES_Y - 4);
      if (data[y][x] !== -1) continue;
      if (this.pathPositions.has(`${x},${y}`)) continue;
      // Minimum 6-tile spacing from other skulls
      let tooClose = false;
      for (let dy = -5; dy <= 5 && !tooClose; dy++) {
        for (let dx = -5; dx <= 5 && !tooClose; dx++) {
          const ny = y + dy; const nx = x + dx;
          if (ny >= 0 && ny < MAP_CONFIG.TILES_Y && nx >= 0 && nx < MAP_CONFIG.TILES_X) {
            if (data[ny][nx] === 8 || data[ny][nx] === 9) tooClose = true;
          }
        }
      }
      if (tooClose) continue;
      data[y][x] = SKULL_FRAMES[this.rng.between(0, 1)];
      placed++;
    }

    // 60 gravestones (frame 6) spread across the map
    placed = 0;
    attempts = 0;
    while (placed < 60 && attempts < 600) {
      attempts++;
      const x = this.rng.between(4, MAP_CONFIG.TILES_X - 4);
      const y = this.rng.between(4, MAP_CONFIG.TILES_Y - 4);
      if (data[y][x] !== -1) continue;
      if (this.pathPositions.has(`${x},${y}`)) continue;
      // Minimum 8-tile spacing from other gravestones (more sparse than skulls)
      let tooClose = false;
      for (let dy = -7; dy <= 7 && !tooClose; dy++) {
        for (let dx = -7; dx <= 7 && !tooClose; dx++) {
          const ny = y + dy; const nx = x + dx;
          if (ny >= 0 && ny < MAP_CONFIG.TILES_Y && nx >= 0 && nx < MAP_CONFIG.TILES_X) {
            if (data[ny][nx] === 6) tooClose = true;
          }
        }
      }
      if (tooClose) continue;
      data[y][x] = GRAVESTONE;
      placed++;
    }
  }

  /** Place composite objects (trees, stumps, bushes) and single-tile items on elevated terrain.
   * Uses 4-tile margin from edges. Excludes bed and bookshelf.
   * Places: trees, stumps, bushes (composite) + rocks, barrels, crates, vases, 
   * gravestones, bones, holes, pots, potted plants, seedlings, cut trees (single-tile).
   */
  private placeElevatedTerrainDecor(data: number[][]): void {
    // Elevated zones (interior regions, 4 tiles inset from edges)
    const zones = [
      { x: 8, y: 8, w: 32, h: 27 },      // NW plateau interior
      { x: 69, y: 8, w: 51, h: 14 },      // NE ridge interior
      { x: 8, y: 99, w: 62, h: 21 },      // South shelf interior
      { x: 100, y: 79, w: 20, h: 22 },    // SE mound interior
      { x: 12, y: 54, w: 12, h: 10 },     // Central-West rock interior
    ];

    // Tree types (3×4 composite) — cols 0-5 only (NO cols 8-9 bed, NO cols 10-11 bookshelf)
    const TREE_TYPES = [
      { cols: [0, 1, 2], rows: [5, 6, 7, 8], w: 3, h: 4 },
      { cols: [3, 4, 5], rows: [5, 6, 7, 8], w: 3, h: 4 },
      { cols: [0, 1, 2], rows: [9, 10, 11, 12], w: 3, h: 4 },
      { cols: [3, 4, 5], rows: [9, 10, 11, 12], w: 3, h: 4 },
    ];

    // Cut tree / stump (2×4 composite) — cols 6-7, rows 5-8
    const CUT_TREE = { cols: [6, 7], rows: [5, 6, 7, 8], w: 2, h: 4 };

    // Bush (2×4 composite) — cols 8-9, rows 5-8 (full plant, not partial)
    const BUSH_COMPOSITE = {
      frames: [[88, 89], [104, 105], [120, 121], [136, 137]],
      w: 2, h: 4,
    };

    // Additional composites from cols 8-11 (verified from tile debug):
    // Small palm/plant: FULL 2×4 composite (cols 8-9, rows 5-8) — same as BUSH_COMPOSITE
    // Using cols 10-11, rows 5-8 for a different plant variety (2×4)
    const SMALL_PLANT_2x4 = {
      frames: [[90, 91], [106, 107], [122, 123], [138, 139]],
      w: 2, h: 4,
    };
    // Root/base: F138+F139 (2×1) — REMOVED, these are bottom of a composite and look cut alone

    // Single-tile items for elevated terrain (all valid objects)
    // EXCLUDED: frame 43 (RED square), frames 9-11, 19-20, 25-27, 44, 59 (brown tables)
    // EXCLUDED: frame 40 (brown crate with legs), composite stump/bush parts
    const SINGLE_ITEMS = [
      // Rocks/stones (gray)
      16, 17, 18,
      // Small tombstones/gravestones
      0, 1, 3, 4, 5,
      // Lápida gris and tomb
      6, 7,
      // Skull
      8,
      // Misc small objects (NOT 40=crate, NOT 43=red)
      41, 42,       // row 2
      57, 58, 60,   // row 3
      73, 74, 75,   // row 4
      // Dark cross/detail
      24,
    ];

    for (const zone of zones) {
      // ─── Composite trees (3-4 per zone) ────────────────────────────────
      const treeCount = this.rng.between(3, 4);
      for (let i = 0; i < treeCount; i++) {
        const tree = TREE_TYPES[this.rng.between(0, TREE_TYPES.length - 1)];
        for (let attempt = 0; attempt < 20; attempt++) {
          const tx = zone.x + this.rng.between(4, Math.max(5, zone.w - tree.w - 4));
          const ty = zone.y + this.rng.between(4, Math.max(5, zone.h - tree.h - 4));
          if (this.canPlaceComposite(data, tx, ty, tree.w, tree.h)) {
            for (let dy = 0; dy < tree.h; dy++) {
              for (let dx = 0; dx < tree.w; dx++) {
                data[ty + dy][tx + dx] = tree.rows[dy] * 16 + tree.cols[dx];
              }
            }
            break;
          }
        }
      }

      // ─── Cut trees (1-2 per zone) ────────────────────────────────────────
      const cutTreeCount = this.rng.between(1, 2);
      for (let ct = 0; ct < cutTreeCount; ct++) {
        for (let attempt = 0; attempt < 15; attempt++) {
          const cx = zone.x + this.rng.between(4, Math.max(5, zone.w - CUT_TREE.w - 4));
          const cy = zone.y + this.rng.between(4, Math.max(5, zone.h - CUT_TREE.h - 4));
          if (this.canPlaceComposite(data, cx, cy, CUT_TREE.w, CUT_TREE.h)) {
            for (let dy = 0; dy < CUT_TREE.h; dy++) {
              for (let dx = 0; dx < CUT_TREE.w; dx++) {
                data[cy + dy][cx + dx] = CUT_TREE.rows[dy] * 16 + CUT_TREE.cols[dx];
              }
            }
            break;
          }
        }
      }

      // ─── Bushes as 2×4 composite (2-3 per zone) ───────────────────────
      const bushCount = this.rng.between(2, 3);
      for (let i = 0; i < bushCount; i++) {
        for (let attempt = 0; attempt < 15; attempt++) {
          const bx = zone.x + this.rng.between(4, Math.max(5, zone.w - BUSH_COMPOSITE.w - 4));
          const by = zone.y + this.rng.between(4, Math.max(5, zone.h - BUSH_COMPOSITE.h - 4));
          if (this.canPlaceComposite(data, bx, by, BUSH_COMPOSITE.w, BUSH_COMPOSITE.h)) {
            for (let dy = 0; dy < BUSH_COMPOSITE.h; dy++) {
              for (let dx = 0; dx < BUSH_COMPOSITE.w; dx++) {
                data[by + dy][bx + dx] = BUSH_COMPOSITE.frames[dy][dx];
              }
            }
            break;
          }
        }
      }

      // ─── Small plants 2×4 (cols 10-11, rows 5-8) (1-2 per zone) ───────
      const plantCount = this.rng.between(1, 2);
      for (let i = 0; i < plantCount; i++) {
        for (let attempt = 0; attempt < 15; attempt++) {
          const px = zone.x + this.rng.between(4, Math.max(5, zone.w - SMALL_PLANT_2x4.w - 4));
          const py = zone.y + this.rng.between(4, Math.max(5, zone.h - SMALL_PLANT_2x4.h - 4));
          if (this.canPlaceComposite(data, px, py, SMALL_PLANT_2x4.w, SMALL_PLANT_2x4.h)) {
            for (let dy = 0; dy < SMALL_PLANT_2x4.h; dy++) {
              for (let dx = 0; dx < SMALL_PLANT_2x4.w; dx++) {
                data[py + dy][px + dx] = SMALL_PLANT_2x4.frames[dy][dx];
              }
            }
            break;
          }
        }
      }

      // ─── Single-tile items scattered (12-18 per zone, with spacing) ──────
      const itemCount = this.rng.between(12, 18);
      let placed = 0;
      for (let attempt = 0; attempt < itemCount * 8 && placed < itemCount; attempt++) {
        const ix = zone.x + this.rng.between(4, Math.max(5, zone.w - 5));
        const iy = zone.y + this.rng.between(4, Math.max(5, zone.h - 5));
        if (ix < 0 || ix >= MAP_CONFIG.TILES_X || iy < 0 || iy >= MAP_CONFIG.TILES_Y) continue;
        if (data[iy][ix] !== -1) continue;
        // Minimum 3-tile spacing from other items
        let tooClose = false;
        for (let dy = -3; dy <= 3 && !tooClose; dy++) {
          for (let dx = -3; dx <= 3 && !tooClose; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = iy + dy; const nx = ix + dx;
            if (ny >= 0 && ny < MAP_CONFIG.TILES_Y && nx >= 0 && nx < MAP_CONFIG.TILES_X) {
              if (data[ny][nx] !== -1) tooClose = true;
            }
          }
        }
        if (tooClose) continue;
        data[iy][ix] = SINGLE_ITEMS[this.rng.between(0, SINGLE_ITEMS.length - 1)];
        placed++;
      }
    }
  }

  /** Generic cluster placement: places `count` items from `frames` within `radius` of (cx,cy). */
  private placeCluster(
    data: number[][], cx: number, cy: number,
    radius: number, count: number, frames: readonly number[] | number[]
  ): void {
    const border = MAP_CONFIG.BORDER_THICKNESS;
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 8;
    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = cx + this.rng.between(-radius, radius);
      const y = cy + this.rng.between(-radius, radius);
      if (x < 0 || x >= MAP_CONFIG.TILES_X || y < 0 || y >= MAP_CONFIG.TILES_Y) continue;
      // Skip wall border zone
      if (x < border || x >= MAP_CONFIG.TILES_X - border ||
          y < border || y >= MAP_CONFIG.TILES_Y - border) continue;
      if (this.isInSpawnZone(x, y) || data[y][x] !== -1) continue;

      let tooClose = false;
      for (let dy = -2; dy <= 2 && !tooClose; dy++) {
        for (let dx = -2; dx <= 2 && !tooClose; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy; const nx = x + dx;
          if (ny >= 0 && ny < MAP_CONFIG.TILES_Y && nx >= 0 && nx < MAP_CONFIG.TILES_X) {
            if (data[ny][nx] !== -1) tooClose = true;
          }
        }
      }
      if (tooClose) continue;

      data[y][x] = frames[this.rng.between(0, frames.length - 1)];
      placed++;
    }
  }

  /** Place random items in an area with optional priority frame. */
  // @ts-ignore — unused method kept for potential future use
  private placeRandomInArea(
    data: number[][], x1: number, y1: number, x2: number, y2: number,
    count: number, frames: readonly number[] | number[], priorityFrame?: number
  ): void {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 5;
    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = this.rng.between(x1, x2);
      const y = this.rng.between(y1, y2);
      if (x >= MAP_CONFIG.TILES_X || y >= MAP_CONFIG.TILES_Y) continue;
      if (this.isInSpawnZone(x, y) || data[y][x] !== -1) continue;
      const frame = (priorityFrame !== undefined && placed % 3 === 0)
        ? priorityFrame
        : frames[this.rng.between(0, frames.length - 1)];
      data[y][x] = frame;
      placed++;
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a tile position is excluded from decoration placement.
   * Returns true if in spawn zone, on/near a path, or on/near elevated terrain border.
   */
  private isInSpawnZone(tileX: number, tileY: number): boolean {
    const centerTileX = MAP_CONFIG.TILES_X / 2;
    const centerTileY = MAP_CONFIG.TILES_Y / 2;
    const radiusTiles = MAP_CONFIG.SPAWN_SAFE_RADIUS / MAP_CONFIG.TILE_SIZE;

    const dx = tileX - centerTileX;
    const dy = tileY - centerTileY;
    if ((dx * dx + dy * dy) < (radiusTiles * radiusTiles)) return true;

    // Exclude path positions (with 1-tile margin)
    for (let my = -1; my <= 1; my++) {
      for (let mx = -1; mx <= 1; mx++) {
        if (this.pathPositions.has(`${tileX + mx},${tileY + my}`)) return true;
      }
    }

    // Exclude positions adjacent to elevated terrain (2-tile margin around borders)
    // A "border" tile is one that IS elevated but has a non-elevated neighbor
    if (this.isNearElevatedBorder(tileX, tileY, 2)) return true;

    return false;
  }

  /**
   * Check if a position is within `margin` tiles of an elevated terrain border.
   */
  private isNearElevatedBorder(tileX: number, tileY: number, margin: number): boolean {
    for (let my = -margin; my <= margin; my++) {
      for (let mx = -margin; mx <= margin; mx++) {
        const checkX = tileX + mx;
        const checkY = tileY + my;
        const key = `${checkX},${checkY}`;
        if (this.elevatedPositions.has(key)) {
          // Check if this elevated tile is a BORDER (has at least one non-elevated neighbor)
          const hasNonElevatedNeighbor =
            !this.elevatedPositions.has(`${checkX - 1},${checkY}`) ||
            !this.elevatedPositions.has(`${checkX + 1},${checkY}`) ||
            !this.elevatedPositions.has(`${checkX},${checkY - 1}`) ||
            !this.elevatedPositions.has(`${checkX},${checkY + 1}`);
          if (hasNonElevatedNeighbor) return true;
        }
      }
    }
    return false;
  }
}

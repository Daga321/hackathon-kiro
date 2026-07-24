import Phaser from 'phaser';
import { MAP_CONFIG, TILESET_KEYS, LAYER_DEPTH } from '../config/map-config';
import {
  WALL_TILES,
  PLAINS_TILES,
  FENCE_TILES,
  GRAVESTONE_FRAMES,
  OBSTACLE_FRAMES,
} from '../config/tile-indices';

/** Result returned by MapGenerator.generate() */
export interface MapGeneratorResult {
  /** The wall collision layer for physics */
  collisionLayer: Phaser.Tilemaps.TilemapLayer | null;
  /** The elevated terrain collision layer */
  elevatedLayer: Phaser.Tilemaps.TilemapLayer | null;
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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rng = new Phaser.Math.RandomDataGenerator([MAP_CONFIG.SEED]);
  }

  /**
   * Generate the complete tilemap with all layers.
   */
  generate(): MapGeneratorResult {
    const groundLayer = this.createGroundLayer();
    const elevatedLayer = this.createElevatedLayer();
    const collisionLayer = this.createWallLayer();
    this.createFenceLayer();
    this.createDecorLayer();
    this.createObjectsLayer();

    // Set depths
    groundLayer?.setDepth(LAYER_DEPTH.GROUND);
    elevatedLayer?.setDepth(LAYER_DEPTH.ELEVATED);
    collisionLayer?.setDepth(LAYER_DEPTH.WALLS);

    return { collisionLayer, elevatedLayer };
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
      }
    }
  }


  /**
   * Add irregular indentations to the zone mask for a natural look.
   */
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

    // Fill the border with wall tiles
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

    // Interior fill (shouldn't reach here for border, but fallback)
    return WALL_TILES.FILL_1;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: FENCES (large meaningful structures with gaps)
  // ═══════════════════════════════════════════════════════════════════════════

  private createFenceLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // ─── 1. Graveyard perimeter (cols 55-85, rows 55-80) ───────────────────
    // North fence
    this.placeFenceSegment(data, 'horizontal', 55, 55, 85, 55);
    // East fence
    this.placeFenceSegment(data, 'vertical', 85, 55, 85, 80);
    // South fence with gate
    this.placeFenceSegment(data, 'horizontal', 55, 80, 67, 80);
    this.placeFenceSegment(data, 'horizontal', 72, 80, 85, 80);
    // West fence partial (leave large opening north side)
    this.placeFenceSegment(data, 'vertical', 55, 65, 55, 80);

    // ─── 2. Corridor fence separating NW plateau from combat area ───────────
    // Horizontal at row 38, from col 4 to col 55, with gaps
    this.placeFenceSegment(data, 'horizontal', 4, 38, 18, 38);
    this.placeFenceSegment(data, 'horizontal', 23, 38, 38, 38);
    this.placeFenceSegment(data, 'horizontal', 43, 38, 55, 38);

    // ─── 3. Eastern separator (between NE ridge and SE area) ────────────────
    this.placeFenceSegment(data, 'vertical', 82, 26, 82, 45);
    // Gap at row 35-38
    this.placeFenceSegment(data, 'vertical', 82, 49, 82, 60);

    // ─── 4. Small enclosed yard (cols 32-48, rows 42-52) ────────────────────
    this.placeFenceSegment(data, 'horizontal', 32, 42, 48, 42);
    this.placeFenceSegment(data, 'horizontal', 32, 52, 38, 52);
    this.placeFenceSegment(data, 'horizontal', 43, 52, 48, 52);
    this.placeFenceSegment(data, 'vertical', 32, 42, 32, 52);
    this.placeFenceSegment(data, 'vertical', 48, 42, 48, 52);

    // ─── 5. Scattered short fragments ────────────────────────────────────────
    this.placeFenceSegment(data, 'horizontal', 90, 68, 97, 68);
    this.placeFenceSegment(data, 'vertical', 60, 85, 60, 92);
    this.placeFenceSegment(data, 'horizontal', 35, 72, 42, 72);

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
  // LAYER 5: DECORATIONS (dense, zone-clustered placement)
  // ═══════════════════════════════════════════════════════════════════════════

  private createDecorLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // A. Main graveyard inside fence area (cols 57-83, rows 57-78)
    this.placeMainGraveyard(data);

    // B. Secondary graveyard (cols 35-45, rows 72-88)
    this.placeSecondaryGraveyard(data);

    // C. Cluster at NW cliff base (cols 6-20, rows 37-43)
    this.placeDebrisCluster(data, 6, 39, 20, 45, 18);

    // D. Cluster near NE ridge base (cols 68-85, rows 24-30)
    this.placeDebrisCluster(data, 68, 24, 85, 30, 16);

    // E. Cluster near South shelf passages (cols 22-34, rows 90-96)
    this.placeDebrisCluster(data, 22, 90, 34, 96, 12);

    // F. Scattered in combat zone (cols 30-55, rows 42-65)
    this.placeCombatZoneDecor(data);

    // G. Path-side decor along row 38 fence
    this.placePathSideDecor(data);

    // H. Decor near SE mound entrance (cols 88-105, rows 70-78)
    this.placeDebrisCluster(data, 88, 70, 105, 78, 14);

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage(
      TILESET_KEYS.DECOR_16,
      TILESET_KEYS.DECOR_16,
      TILE_SIZE,
      TILE_SIZE
    );
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) {
      layer.setDepth(LAYER_DEPTH.DECOR);
    }
    return layer;
  }


  /**
   * Place the main graveyard: 10 rows of 6-8 gravestones each.
   * Inside the graveyard fence (cols 57-83, rows 57-78).
   */
  private placeMainGraveyard(data: number[][]): void {
    const startX = 57;
    const startY = 57;
    const rowSpacing = 2;
    const colSpacing = 3;
    const numRows = 10;

    for (let row = 0; row < numRows; row++) {
      const y = startY + row * rowSpacing;
      if (y >= MAP_CONFIG.TILES_Y || y >= 78) break;

      const rowOffset = (row % 2 === 0) ? 0 : 1;
      const stonesInRow = 6 + (row % 3 === 0 ? 2 : row % 2 === 0 ? 1 : 0);

      for (let col = 0; col < stonesInRow; col++) {
        const x = startX + rowOffset + col * colSpacing;
        if (x >= 83 || x >= MAP_CONFIG.TILES_X) break;
        if (y >= MAP_CONFIG.TILES_Y) break;
        if (this.isInSpawnZone(x, y)) continue;

        const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
        data[y][x] = GRAVESTONE_FRAMES[frameIdx];
      }
    }
  }

  /**
   * Place secondary graveyard: 8 rows of 3-5 gravestones.
   * Cols 35-45, rows 72-88.
   */
  private placeSecondaryGraveyard(data: number[][]): void {
    const startX = 35;
    const startY = 72;
    const rowSpacing = 2;
    const colSpacing = 2;
    const numRows = 8;

    for (let row = 0; row < numRows; row++) {
      const y = startY + row * rowSpacing;
      if (y >= MAP_CONFIG.TILES_Y || y >= 88) break;

      const rowOffset = (row % 2 === 0) ? 0 : 1;
      const stonesInRow = 3 + (row % 2 === 0 ? 2 : 1);

      for (let col = 0; col < stonesInRow; col++) {
        const x = startX + rowOffset + col * colSpacing;
        if (x >= 45 || x >= MAP_CONFIG.TILES_X) break;
        if (this.isInSpawnZone(x, y)) continue;

        const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
        data[y][x] = GRAVESTONE_FRAMES[frameIdx];
      }
    }
  }


  /**
   * Place decor pairs and triples in the combat zone (cols 30-55, rows 42-65).
   */
  private placeCombatZoneDecor(data: number[][]): void {
    const pairs: [number, number][] = [
      [32, 43], [36, 45], [40, 47], [44, 44], [48, 46],
      [52, 48], [34, 50], [38, 52], [42, 54], [46, 56],
      [50, 58], [54, 60], [33, 56], [37, 58], [41, 62],
      [45, 64], [49, 43], [53, 45], [31, 63], [35, 65],
    ];

    for (const [baseX, baseY] of pairs) {
      this.placePair(data, baseX, baseY);
    }

    const triples: [number, number][] = [
      [30, 42], [54, 42], [30, 64], [54, 64],
    ];
    for (const [baseX, baseY] of triples) {
      this.placeTriple(data, baseX, baseY);
    }
  }

  /**
   * Place decor items along the corridor fence at row 38.
   */
  private placePathSideDecor(data: number[][]): void {
    const positions: [number, number][] = [
      [8, 36], [12, 36], [16, 36], [25, 40], [30, 40],
      [44, 40], [48, 40], [52, 36], [56, 36], [60, 40],
    ];

    for (const [x, y] of positions) {
      if (x >= MAP_CONFIG.TILES_X || y >= MAP_CONFIG.TILES_Y) continue;
      if (this.isInSpawnZone(x, y)) continue;
      if (data[y][x] !== -1) continue;
      const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
      data[y][x] = GRAVESTONE_FRAMES[frameIdx];
    }
  }


  /**
   * Place a tight cluster of decor items in a defined region.
   * Items are spaced 2 tiles apart for a dense grouped feel.
   */
  private placeDebrisCluster(
    data: number[][],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    count: number
  ): void {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 4;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const tx = this.rng.between(x1, x2);
      const ty = this.rng.between(y1, y2);

      if (tx >= MAP_CONFIG.TILES_X || ty >= MAP_CONFIG.TILES_Y) continue;
      if (data[ty][tx] !== -1) continue;
      if (this.isInSpawnZone(tx, ty)) continue;

      // Check minimum spacing (2 tiles from other decor in this cluster)
      let tooClose = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = ty + dy;
          const nx = tx + dx;
          if (ny >= 0 && ny < MAP_CONFIG.TILES_Y && nx >= 0 && nx < MAP_CONFIG.TILES_X) {
            if (data[ny][nx] !== -1) { tooClose = true; break; }
          }
        }
        if (tooClose) break;
      }
      if (tooClose) continue;

      const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
      data[ty][tx] = GRAVESTONE_FRAMES[frameIdx];
      placed++;
    }
  }

  /** Place a pair of decorations at a base position. */
  private placePair(data: number[][], baseX: number, baseY: number): void {
    const positions: [number, number][] = [
      [baseX, baseY],
      [baseX + 2, baseY + 1],
    ];
    for (const [x, y] of positions) {
      if (x >= MAP_CONFIG.TILES_X || y >= MAP_CONFIG.TILES_Y) continue;
      if (this.isInSpawnZone(x, y)) continue;
      if (data[y][x] !== -1) continue;
      const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
      data[y][x] = GRAVESTONE_FRAMES[frameIdx];
    }
  }

  /** Place a triple of decorations at a base position. */
  private placeTriple(data: number[][], baseX: number, baseY: number): void {
    const positions: [number, number][] = [
      [baseX, baseY],
      [baseX + 2, baseY],
      [baseX + 1, baseY + 2],
    ];
    for (const [x, y] of positions) {
      if (x >= MAP_CONFIG.TILES_X || y >= MAP_CONFIG.TILES_Y) continue;
      if (this.isInSpawnZone(x, y)) continue;
      if (data[y][x] !== -1) continue;
      const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
      data[y][x] = GRAVESTONE_FRAMES[frameIdx];
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 6: OBJECTS (grouped formations, clusters, and hedges)
  // ═══════════════════════════════════════════════════════════════════════════

  private createObjectsLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // ─── A. Rock wall formation (cols 35-42, rows 45-48) L-shaped ───────────
    this.placeObjectCluster(data, [
      [35, 45], [36, 45], [37, 45], [38, 45],
      [35, 46], [36, 46], [37, 46],
      [35, 47], [36, 47],
      [35, 48], [36, 48], [37, 48],
    ], 'rocks');

    // ─── B. Boulder cluster NW (cols 30-35, rows 8-12) ──────────────────────
    this.placeObjectCluster(data, [
      [30, 8], [32, 8], [34, 9],
      [31, 10], [33, 10],
      [30, 11], [32, 12], [34, 11],
    ], 'rocks');

    // ─── C. Debris field SE (cols 100-108, rows 78-83) ──────────────────────
    this.placeObjectCluster(data, [
      [100, 78], [102, 79], [104, 78], [106, 79],
      [101, 81], [103, 80], [105, 82],
      [107, 81], [100, 83], [104, 83],
    ], 'debris');

    // ─── D. Path obstacles — 6 clusters of 3 rocks each ─────────────────────
    const pathObstacles: [number, number][] = [
      [28, 55], [45, 38], [60, 72], [75, 50], [50, 85], [95, 60],
    ];
    for (const [bx, by] of pathObstacles) {
      this.placeObjectCluster(data, [
        [bx, by], [bx + 1, by], [bx, by + 1],
      ], 'rocks');
    }

    // ─── E. Bush hedges — 4 lines of 5-8 bushes ─────────────────────────────
    // Horizontal hedge at (8-15, 45)
    this.placeObjectCluster(data, [
      [8, 45], [9, 45], [10, 45], [11, 45],
      [12, 45], [13, 45], [14, 45], [15, 45],
    ], 'bushes');
    // Horizontal hedge at (85-93, 55)
    this.placeObjectCluster(data, [
      [85, 55], [86, 55], [87, 55], [88, 55],
      [89, 55], [90, 55], [91, 55], [92, 55], [93, 55],
    ], 'bushes');
    // Vertical hedge at (48, 70-77)
    this.placeObjectCluster(data, [
      [48, 70], [48, 71], [48, 72], [48, 73],
      [48, 74], [48, 75], [48, 76], [48, 77],
    ], 'bushes');
    // Horizontal hedge at (25-32, 95)
    this.placeObjectCluster(data, [
      [25, 95], [26, 95], [27, 95], [28, 95],
      [29, 95], [30, 95], [31, 95], [32, 95],
    ], 'bushes');

    // ─── F. Lone stumps at strategic positions ───────────────────────────────
    this.placeSingleObject(data, 5, 50);
    this.placeSingleObject(data, 120, 30);
    this.placeSingleObject(data, 115, 75);
    this.placeSingleObject(data, 25, 105);
    this.placeSingleObject(data, 70, 98);
    this.placeSingleObject(data, 40, 15);
    this.placeSingleObject(data, 100, 40);
    this.placeSingleObject(data, 85, 110);

    const map = this.scene.make.tilemap({
      data,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });

    const tileset = map.addTilesetImage(
      TILESET_KEYS.OBJECTS,
      TILESET_KEYS.OBJECTS,
      TILE_SIZE,
      TILE_SIZE
    );
    if (!tileset) return null;

    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) {
      layer.setDepth(LAYER_DEPTH.OBJECTS);
    }
    return layer;
  }


  /**
   * Place a cluster of objects at specified positions.
   * Type determines which subset of OBSTACLE_FRAMES to use.
   */
  private placeObjectCluster(
    data: number[][],
    positions: [number, number][],
    type: 'rocks' | 'debris' | 'bushes'
  ): void {
    for (const [x, y] of positions) {
      if (x >= MAP_CONFIG.TILES_X || y >= MAP_CONFIG.TILES_Y) continue;
      if (x < 0 || y < 0) continue;
      if (data[y][x] !== -1) continue;
      if (this.isInSpawnZone(x, y)) continue;

      let frameIdx: number;
      switch (type) {
        case 'rocks':
          // Use first 5 frames (ROCK_1 through ROCK_5)
          frameIdx = this.rng.between(0, 4);
          break;
        case 'debris':
          // Use frames 5-7 (DEBRIS_1, DEBRIS_2, STUMP)
          frameIdx = this.rng.between(5, 7);
          break;
        case 'bushes':
          // Use last 2 frames (BUSH_1, BUSH_2)
          frameIdx = this.rng.between(8, 9);
          break;
      }
      data[y][x] = OBSTACLE_FRAMES[frameIdx];
    }
  }

  /**
   * Place a single stump/bush object at a position.
   */
  private placeSingleObject(data: number[][], x: number, y: number): void {
    if (x >= MAP_CONFIG.TILES_X || y >= MAP_CONFIG.TILES_Y) return;
    if (x < 0 || y < 0) return;
    if (data[y][x] !== -1) return;
    if (this.isInSpawnZone(x, y)) return;

    // Use STUMP or BUSH frames
    const frameIdx = this.rng.between(7, 9);
    data[y][x] = OBSTACLE_FRAMES[frameIdx];
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a tile position is within the center spawn safe zone.
   */
  private isInSpawnZone(tileX: number, tileY: number): boolean {
    const centerTileX = MAP_CONFIG.TILES_X / 2;
    const centerTileY = MAP_CONFIG.TILES_Y / 2;
    const radiusTiles = MAP_CONFIG.SPAWN_SAFE_RADIUS / MAP_CONFIG.TILE_SIZE;

    const dx = tileX - centerTileX;
    const dy = tileY - centerTileY;
    return (dx * dx + dy * dy) < (radiusTiles * radiusTiles);
  }
}

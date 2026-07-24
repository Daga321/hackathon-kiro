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
 * The map is 128×128 tiles (2048×2048 px) with multiple layers:
 * - Ground (grass fill)
 * - Elevated terrain (plains with proper autotile edges)
 * - Border walls (2 tiles thick perimeter)
 * - Fences (corridor dividers with gaps)
 * - Decorations (organized graveyard rows + sparse scatter)
 * - Objects (rocks/debris near walls)
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
  // LAYER 2: ELEVATED TERRAIN (plains with proper autotile edges)
  // ═══════════════════════════════════════════════════════════════════════════

  private createElevatedLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Define elevated zones with irregular shapes
    this.placeElevatedZone(data, 5, 5, 28, 25, 'top-left');    // Top-left corner
    this.placeElevatedZone(data, 85, 5, 38, 25, 'top-right');  // Top-right corner
    this.placeElevatedZone(data, 85, 90, 38, 32, 'bottom-right'); // Bottom-right patch

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
   * Adds irregular indentations to avoid perfect rectangles.
   */
  private placeElevatedZone(
    data: number[][],
    startX: number,
    startY: number,
    width: number,
    height: number,
    _position: string
  ): void {
    // Create a boolean mask for the zone shape (with irregularities)
    const mask: boolean[][] = [];
    for (let dy = 0; dy < height; dy++) {
      mask.push(new Array(width).fill(true));
    }

    // Add indentations (2-3 tile bites) along edges for organic look
    this.addIndentations(mask, width, height);

    // Now assign proper tile frames based on adjacency
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
  private addIndentations(mask: boolean[][], width: number, height: number): void {
    // Top edge indentations
    const topIndents = 2 + (this.rng.between(0, 1));
    for (let i = 0; i < topIndents; i++) {
      const ix = this.rng.between(3, width - 4);
      const iw = this.rng.between(2, 3);
      const ih = this.rng.between(2, 3);
      for (let dy = 0; dy < ih && dy < height; dy++) {
        for (let dx = 0; dx < iw && ix + dx < width; dx++) {
          mask[dy][ix + dx] = false;
        }
      }
    }

    // Bottom edge indentations
    const bottomIndents = 2 + (this.rng.between(0, 1));
    for (let i = 0; i < bottomIndents; i++) {
      const ix = this.rng.between(3, width - 4);
      const iw = this.rng.between(2, 3);
      const ih = this.rng.between(2, 3);
      for (let dy = 0; dy < ih && height - 1 - dy >= 0; dy++) {
        for (let dx = 0; dx < iw && ix + dx < width; dx++) {
          mask[height - 1 - dy][ix + dx] = false;
        }
      }
    }

    // Left edge indentations
    const leftIndent = this.rng.between(1, 2);
    for (let i = 0; i < leftIndent; i++) {
      const iy = this.rng.between(3, height - 4);
      const iw = this.rng.between(2, 3);
      const ih = this.rng.between(2, 3);
      for (let dy = 0; dy < ih && iy + dy < height; dy++) {
        for (let dx = 0; dx < iw; dx++) {
          mask[iy + dy][dx] = false;
        }
      }
    }

    // Right edge indentations
    const rightIndent = this.rng.between(1, 2);
    for (let i = 0; i < rightIndent; i++) {
      const iy = this.rng.between(3, height - 4);
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
  // LAYER 4: FENCES (corridor dividers with gaps for passage)
  // ═══════════════════════════════════════════════════════════════════════════

  private createFenceLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Vertical fence line separating left corridor (column 25-26, rows 20-90)
    this.placeVerticalFence(data, 25, 20, 90);

    // Horizontal fence in the south (row 90, columns 30-80)
    this.placeHorizontalFence(data, 90, 30, 80);

    // Small fence enclosures in the graveyard section (right area)
    // Enclosure 1: top-right graveyard area
    this.placeFenceEnclosure(data, 75, 35, 20, 15);
    // Enclosure 2: middle-right graveyard
    this.placeFenceEnclosure(data, 90, 55, 18, 12);
    // Enclosure 3: smaller section
    this.placeFenceEnclosure(data, 70, 70, 15, 10);

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
   * Place a vertical fence line with gaps every 15-20 tiles for player passage.
   */
  private placeVerticalFence(
    data: number[][],
    col: number,
    startRow: number,
    endRow: number
  ): void {
    const gapInterval = 17;
    const gapSize = 3;

    for (let row = startRow; row <= endRow; row++) {
      // Create gaps for passage
      const relativePos = row - startRow;
      if (relativePos % gapInterval < gapSize) continue;

      if (row === startRow || (relativePos % gapInterval === gapSize)) {
        // Post at start of segment
        data[row][col] = FENCE_TILES.CORNER_TOP_LEFT;
      } else if (row === endRow || (relativePos % gapInterval === gapInterval - 1)) {
        // Post at end of segment
        data[row][col] = FENCE_TILES.CORNER_BOTTOM_LEFT;
      } else {
        data[row][col] = FENCE_TILES.VERTICAL;
      }
    }
  }

  /**
   * Place a horizontal fence line with gaps every 15-20 tiles.
   */
  private placeHorizontalFence(
    data: number[][],
    row: number,
    startCol: number,
    endCol: number
  ): void {
    const gapInterval = 18;
    const gapSize = 3;

    for (let col = startCol; col <= endCol; col++) {
      const relativePos = col - startCol;
      if (relativePos % gapInterval < gapSize) continue;

      if (col === startCol || (relativePos % gapInterval === gapSize)) {
        data[row][col] = FENCE_TILES.CORNER_TOP_LEFT;
      } else if (col === endCol || (relativePos % gapInterval === gapInterval - 1)) {
        data[row][col] = FENCE_TILES.CORNER_TOP_RIGHT;
      } else {
        data[row][col] = FENCE_TILES.HORIZONTAL;
      }
    }
  }

  /**
   * Place a rectangular fence enclosure with a gap for entry.
   */
  private placeFenceEnclosure(
    data: number[][],
    startX: number,
    startY: number,
    width: number,
    height: number
  ): void {
    const gapPos = Math.floor(width / 2); // Gap in the bottom fence
    const gapSize = 3;

    for (let dx = 0; dx < width; dx++) {
      const x = startX + dx;
      if (x >= MAP_CONFIG.TILES_X) continue;

      // Top fence
      if (startY < MAP_CONFIG.TILES_Y) {
        if (dx === 0) data[startY][x] = FENCE_TILES.CORNER_TOP_LEFT;
        else if (dx === width - 1) data[startY][x] = FENCE_TILES.CORNER_TOP_RIGHT;
        else data[startY][x] = FENCE_TILES.HORIZONTAL;
      }

      // Bottom fence (with gap)
      const bottomY = startY + height;
      if (bottomY < MAP_CONFIG.TILES_Y) {
        if (dx >= gapPos && dx < gapPos + gapSize) continue; // gap
        if (dx === 0) data[bottomY][x] = FENCE_TILES.CORNER_BOTTOM_LEFT;
        else if (dx === width - 1) data[bottomY][x] = FENCE_TILES.CORNER_BOTTOM_RIGHT;
        else data[bottomY][x] = FENCE_TILES.HORIZONTAL;
      }
    }

    // Left and right vertical fences
    for (let dy = 1; dy < height; dy++) {
      const y = startY + dy;
      if (y >= MAP_CONFIG.TILES_Y) continue;

      const leftX = startX;
      const rightX = startX + width - 1;

      if (leftX < MAP_CONFIG.TILES_X) data[y][leftX] = FENCE_TILES.VERTICAL;
      if (rightX < MAP_CONFIG.TILES_X) data[y][rightX] = FENCE_TILES.VERTICAL;
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 5: DECORATIONS (organized graveyard + sparse scatter)
  // ═══════════════════════════════════════════════════════════════════════════

  private createDecorLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Graveyard section (right third of map): organized gravestone rows
    this.placeGraveyardRows(data);

    // Sparse random decor in open areas (left and center)
    this.placeSparseDecor(data);

    // Cluster decor near elevated terrain bases
    this.placeElevatedBaseDecor(data);

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
   * Place organized gravestone rows in the graveyard section (right third).
   * 5-8 rows of 4-6 gravestones each, spaced 3-4 tiles apart.
   */
  private placeGraveyardRows(data: number[][]): void {
    const graveyardStartX = 80;  // Right third starts around column 80
    const graveyardEndX = 120;   // Leave room for wall border
    const graveyardStartY = 35;
    const graveyardEndY = 85;

    const rowSpacing = 4;  // Tiles between rows
    const colSpacing = 3;  // Tiles between gravestones in a row

    let currentY = graveyardStartY;
    let rowCount = 0;
    const maxRows = 8;

    while (currentY < graveyardEndY && rowCount < maxRows) {
      const stonesInRow = this.rng.between(4, 6);
      const rowOffsetX = this.rng.between(0, 2); // Slight row stagger

      for (let i = 0; i < stonesInRow; i++) {
        const tileX = graveyardStartX + rowOffsetX + (i * colSpacing);
        if (tileX >= graveyardEndX) break;
        if (currentY >= MAP_CONFIG.TILES_Y) break;

        // Pick a random gravestone frame
        const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
        data[currentY][tileX] = GRAVESTONE_FRAMES[frameIdx];
      }

      currentY += rowSpacing;
      rowCount++;
    }

    // Second graveyard cluster (staggered rows below)
    currentY = graveyardStartY + 2;
    const secondStartX = graveyardStartX + 15;
    rowCount = 0;

    while (currentY < graveyardEndY && rowCount < 5) {
      const stonesInRow = this.rng.between(3, 5);
      const rowOffsetX = this.rng.between(0, 1);

      for (let i = 0; i < stonesInRow; i++) {
        const tileX = secondStartX + rowOffsetX + (i * colSpacing);
        if (tileX >= graveyardEndX) break;
        if (currentY >= MAP_CONFIG.TILES_Y) break;

        const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
        data[currentY][tileX] = GRAVESTONE_FRAMES[frameIdx];
      }

      currentY += rowSpacing + 1;
      rowCount++;
    }
  }

  /**
   * Place sparse decor in open areas (about 1 per 100-150 sq tiles).
   */
  private placeSparseDecor(data: number[][]): void {
    // Open areas: left and center zones (avoiding graveyard and border)
    const zones = [
      { x1: 5, y1: 35, x2: 22, y2: 85 },   // Left corridor
      { x1: 30, y1: 35, x2: 70, y2: 55 },   // Center top
      { x1: 30, y1: 70, x2: 70, y2: 95 },   // Center bottom
      { x1: 5, y1: 95, x2: 60, y2: 120 },   // Bottom-left open
    ];

    for (const zone of zones) {
      const area = (zone.x2 - zone.x1) * (zone.y2 - zone.y1);
      const decorCount = Math.floor(area / this.rng.between(100, 150));

      for (let i = 0; i < decorCount; i++) {
        const tx = this.rng.between(zone.x1, zone.x2);
        const ty = this.rng.between(zone.y1, zone.y2);

        if (tx >= MAP_CONFIG.TILES_X || ty >= MAP_CONFIG.TILES_Y) continue;
        if (data[ty][tx] !== -1) continue; // Don't overwrite existing

        // Don't place in spawn zone center
        if (this.isInSpawnZone(tx, ty)) continue;

        const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
        data[ty][tx] = GRAVESTONE_FRAMES[frameIdx];
      }
    }
  }

  /**
   * Place small clusters of decor at the base of elevated terrain.
   */
  private placeElevatedBaseDecor(data: number[][]): void {
    // Clusters along the south edges of elevated zones
    const basePositions = [
      { x: 10, y: 31, count: 4 },  // Below top-left elevated
      { x: 90, y: 31, count: 4 },  // Below top-right elevated
      { x: 90, y: 122, count: 3 }, // Below bottom-right elevated
    ];

    for (const pos of basePositions) {
      for (let i = 0; i < pos.count; i++) {
        const tx = pos.x + this.rng.between(0, 8);
        const ty = pos.y + this.rng.between(0, 2);

        if (tx >= MAP_CONFIG.TILES_X || ty >= MAP_CONFIG.TILES_Y) continue;
        if (data[ty][tx] !== -1) continue;

        const frameIdx = this.rng.between(0, GRAVESTONE_FRAMES.length - 1);
        data[ty][tx] = GRAVESTONE_FRAMES[frameIdx];
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 6: OBJECTS (rocks, debris near walls and elevated areas)
  // ═══════════════════════════════════════════════════════════════════════════

  private createObjectsLayer(): Phaser.Tilemaps.TilemapLayer | null {
    const { TILES_X, TILES_Y, TILE_SIZE } = MAP_CONFIG;

    // Initialize empty layer
    const data: number[][] = [];
    for (let y = 0; y < TILES_Y; y++) {
      data.push(new Array(TILES_X).fill(-1));
    }

    // Place objects near walls (10-15 total)
    this.placeWallAdjacentObjects(data);

    // Place objects near center paths as light obstacles (3-5)
    this.placeCenterPathObjects(data);

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
   * Place 10-15 objects near walls and elevated terrain edges.
   */
  private placeWallAdjacentObjects(data: number[][]): void {
    const positions = [
      // Near top wall
      { x: 15, y: 4 }, { x: 35, y: 3 }, { x: 55, y: 4 },
      { x: 75, y: 3 }, { x: 100, y: 4 },
      // Near bottom wall
      { x: 20, y: 123 }, { x: 50, y: 124 }, { x: 80, y: 123 },
      // Near left wall
      { x: 3, y: 40 }, { x: 4, y: 70 },
      // Near right wall
      { x: 124, y: 45 }, { x: 123, y: 75 },
      // Near elevated terrain
      { x: 30, y: 28 }, { x: 88, y: 28 }, { x: 88, y: 92 },
    ];

    for (const pos of positions) {
      if (pos.x >= MAP_CONFIG.TILES_X || pos.y >= MAP_CONFIG.TILES_Y) continue;
      if (data[pos.y][pos.x] !== -1) continue;

      const frameIdx = this.rng.between(0, OBSTACLE_FRAMES.length - 1);
      data[pos.y][pos.x] = OBSTACLE_FRAMES[frameIdx];
    }
  }

  /**
   * Place 3-5 objects along center paths as light obstacles.
   */
  private placeCenterPathObjects(data: number[][]): void {
    const pathPositions = [
      { x: 45, y: 55 },
      { x: 55, y: 65 },
      { x: 50, y: 75 },
      { x: 60, y: 50 },
      { x: 40, y: 80 },
    ];

    for (const pos of pathPositions) {
      // Don't place in direct spawn zone
      if (this.isInSpawnZone(pos.x, pos.y)) continue;
      if (pos.x >= MAP_CONFIG.TILES_X || pos.y >= MAP_CONFIG.TILES_Y) continue;
      if (data[pos.y][pos.x] !== -1) continue;

      const frameIdx = this.rng.between(0, OBSTACLE_FRAMES.length - 1);
      data[pos.y][pos.x] = OBSTACLE_FRAMES[frameIdx];
    }
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

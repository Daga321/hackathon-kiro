/**
 * Tile frame indices for each spritesheet.
 *
 * Frame indices are calculated as: row * columns + column
 * where (row, col) is the position in the spritesheet grid.
 */

// ─── walls.png: 8 cols × 8 rows = 64 frames (index 0-63) ───────────────────
// Standard autotile layout for wall borders
export const WALL_TILES = {
  // Outer corners
  TOP_LEFT: 0,
  TOP_RIGHT: 3,
  BOTTOM_LEFT: 24,
  BOTTOM_RIGHT: 27,

  // Edges
  TOP: 1,
  TOP_ALT: 2,
  BOTTOM: 25,
  BOTTOM_ALT: 26,
  LEFT: 8,
  LEFT_ALT: 16,
  RIGHT: 11,
  RIGHT_ALT: 19,

  // Interior fills
  FILL_1: 9,
  FILL_2: 10,
  FILL_3: 17,
  FILL_4: 18,
} as const;

// ─── plains.png: 6 cols × 12 rows = 72 frames (index 0-71) ─────────────────
// Elevated terrain with proper edge transitions
export const PLAINS_TILES = {
  // Outer corners (row 0)
  TOP_LEFT: 0,
  TOP_RIGHT: 2,

  // Top edge
  TOP: 1,

  // Left/right edges (rows 1-2)
  LEFT: 6,
  LEFT_ALT: 12,
  RIGHT: 8,
  RIGHT_ALT: 14,

  // Bottom corners (row 3)
  BOTTOM_LEFT: 18,
  BOTTOM_RIGHT: 20,

  // Bottom edge
  BOTTOM: 19,

  // Interior fills
  FILL_1: 7,
  FILL_2: 13,
  FILL_3: 14,
  FILL_4: 8,

  // Inner corners (concave)
  INNER_TOP_LEFT: 3,
  INNER_TOP_RIGHT: 5,
  INNER_BOTTOM_LEFT: 15,
  INNER_BOTTOM_RIGHT: 17,
} as const;

// ─── fences.png: 4 cols × 4 rows = 16 frames (index 0-15) ──────────────────
export const FENCE_TILES = {
  // Horizontal pieces
  HORIZONTAL: 1,
  HORIZONTAL_ALT: 2,

  // Vertical pieces
  VERTICAL: 4,
  VERTICAL_ALT: 8,

  // Posts / endpoints
  POST: 0,
  END_LEFT: 3,
  END_RIGHT: 5,
  END_TOP: 12,
  END_BOTTOM: 13,

  // Corners
  CORNER_TOP_LEFT: 0,
  CORNER_TOP_RIGHT: 3,
  CORNER_BOTTOM_LEFT: 12,
  CORNER_BOTTOM_RIGHT: 15,

  // T-junctions
  T_LEFT: 4,
  T_RIGHT: 7,
  T_TOP: 9,
  T_BOTTOM: 14,
} as const;

// ─── decor_16x16.png: 4 cols × 5 rows = 20 frames (index 0-19) ─────────────
export const DECOR_TILES = {
  // Row 0: Gravestones
  GRAVESTONE_1: 0,
  GRAVESTONE_2: 1,
  GRAVESTONE_3: 2,
  GRAVESTONE_4: 3,

  // Row 1: Crosses and tall markers
  CROSS_1: 4,
  CROSS_2: 5,
  TALL_MARKER_1: 6,
  TALL_MARKER_2: 7,

  // Row 2: Broken/worn tombstones
  BROKEN_1: 8,
  BROKEN_2: 9,
  WORN_1: 10,
  WORN_2: 11,

  // Row 3: Small decor
  SMALL_1: 12,
  SMALL_2: 13,
  SMALL_3: 14,
  SMALL_4: 15,

  // Row 4: Additional decor
  EXTRA_1: 16,
  EXTRA_2: 17,
  EXTRA_3: 18,
  EXTRA_4: 19,
} as const;

// ─── objects/objects.png: 16 cols × 13 rows = 208 frames (index 0-207) ──────
export const OBJECT_TILES = {
  // Rocks
  ROCK_1: 0,
  ROCK_2: 1,
  ROCK_3: 2,
  ROCK_4: 16,
  ROCK_5: 17,

  // Debris
  DEBRIS_1: 3,
  DEBRIS_2: 4,
  DEBRIS_3: 19,
  DEBRIS_4: 20,

  // Misc objects
  BARREL: 32,
  CRATE: 33,
  STUMP: 48,
  LOG: 49,
  BUSH_1: 64,
  BUSH_2: 65,
} as const;

/** Gravestone frames array for easy random selection */
export const GRAVESTONE_FRAMES: readonly number[] = [
  DECOR_TILES.GRAVESTONE_1,
  DECOR_TILES.GRAVESTONE_2,
  DECOR_TILES.GRAVESTONE_3,
  DECOR_TILES.GRAVESTONE_4,
  DECOR_TILES.CROSS_1,
  DECOR_TILES.CROSS_2,
  DECOR_TILES.TALL_MARKER_1,
  DECOR_TILES.TALL_MARKER_2,
  DECOR_TILES.BROKEN_1,
  DECOR_TILES.BROKEN_2,
];

/** Obstacle object frames for random placement */
export const OBSTACLE_FRAMES: readonly number[] = [
  OBJECT_TILES.ROCK_1,
  OBJECT_TILES.ROCK_2,
  OBJECT_TILES.ROCK_3,
  OBJECT_TILES.ROCK_4,
  OBJECT_TILES.ROCK_5,
  OBJECT_TILES.DEBRIS_1,
  OBJECT_TILES.DEBRIS_2,
  OBJECT_TILES.STUMP,
  OBJECT_TILES.BUSH_1,
  OBJECT_TILES.BUSH_2,
];

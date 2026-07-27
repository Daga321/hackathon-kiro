/**
 * Tile frame indices for each spritesheet.
 *
 * Frame indices are calculated as: row * columns + column
 * where (row, col) is the position in the spritesheet grid.
 */

// ─── walls.png: 8 cols × 8 rows = 64 frames (index 0-63) ───────────────────
// VERIFIED via pixel analysis:
//   Row 0 (F0-5): Top edges (partial transparency at top, stone visible at bottom)
//   Row 1 (F8-13): Middle tiles — F8 fully solid blue-gray, F9/11/12/13 partial transparency
//   Row 2 (F16-19): Similar — F16 fully solid, F17/19 partial
//   Row 3 (F24-27): Bottom edges (same pattern as row 0)
//   Rows 4-5 (F32-45): DARK fill (almost black, dark=51/64) — wall interior shadow
//
// For a visible blue-gray stone wall:
//   Fill/interior = F8 or F16 (fully solid, blue=45-46, visible)
//   Top edge = F0-3 (partial transparency, stone below)
//   Bottom edge = F24-27 (partial transparency, same as top mirrored)
//   Side edges = F9, F11, F12, F13 (partial transparency left/right)
export const WALL_TILES = {
  // Top wall (player sees the front face from above) — use dark solid rows 4-5
  TOP_LEFT: 32, // Frame 32: dark solid fill (top-left corner)
  TOP: 33, // Frame 33: dark solid (top edge with perspective)
  TOP_ALT: 34, // Frame 34: dark solid variant
  TOP_RIGHT: 35, // Frame 35: dark solid (top-right corner)

  // Side edges — use partially transparent frames for left/right visibility
  LEFT: 9, // Frame 9: partial transparency (left edge)
  LEFT_ALT: 13, // Frame 13: left edge variant
  RIGHT: 11, // Frame 11: partial transparency (right edge)
  RIGHT_ALT: 12, // Frame 12: right edge variant

  // Bottom wall (same perspective as top) — use dark solid rows 4-5
  BOTTOM_LEFT: 40, // Frame 40: dark solid fill (bottom-left)
  BOTTOM: 41, // Frame 41: dark solid (bottom edge with perspective)
  BOTTOM_ALT: 42, // Frame 42: dark solid variant
  BOTTOM_RIGHT: 43, // Frame 43: dark solid (bottom-right)

  // Interior fills (use same dark solid for wall thickness)
  FILL_1: 32, // Frame 32: dark solid
  FILL_2: 33, // Frame 33: dark solid variant
  FILL_3: 40, // Frame 40: dark solid
  FILL_4: 41, // Frame 41: dark solid variant
} as const;

// ─── plains.png: 6 cols × 12 rows = 72 frames (index 0-71) ─────────────────
// VERIFIED via pixel transparency analysis.
// The tileset has 3 blocks of 4 rows each:
//   Rows 0-3 (frames 0-23):  Solid brown terrain (0% transparency)
//   Rows 4-7 (frames 24-47): Green transition tiles (partial transparency for edges)
//   Rows 8-11 (frames 48-71): Solid blue-gray terrain (0% transparency)
//
// GREEN BLOCK (rows 4-7) transparency pattern:
//   Frame 24: ALL transparent (unused/full outside)
//   Frame 25: TL+TR+BL transparent → shows only BR quadrant = OUTER TOP-LEFT CORNER
//   Frame 26: TL+TR transparent → shows bottom half = TOP EDGE
//   Frame 27: TL+TR+BR transparent → shows only BL quadrant = OUTER TOP-RIGHT CORNER
//   Frame 28: SOLID = INTERIOR FILL 1
//   Frame 29: SOLID = INTERIOR FILL 2
//   Frame 30: TL transparent = LEFT EDGE (or inner concave)
//   Frame 31: TL transparent = LEFT EDGE variant
//   Frame 32: SOLID = INTERIOR FILL 3
//   Frame 33: SOLID = INTERIOR FILL 4
//   Frame 34: SOLID = INTERIOR FILL 5
//   Frame 35: SOLID = INTERIOR FILL 6
//   Frame 36: BL transparent = BOTTOM-LEFT region = OUTER BOTTOM-LEFT CORNER
//   Frame 37: BL transparent = BOTTOM EDGE variant
//   Frame 38: SOLID = BOTTOM EDGE (solid, drawn over grass)
//   Frame 39: SOLID = INTERIOR / BOTTOM-RIGHT area
//   Frame 40: SOLID = INNER CORNER (concave TR)
//   Frame 41: SOLID = INNER CORNER (concave TL)
//
// For correct autotiling: use SOLID frames for interior, and
// transparency frames for EDGES (they overlay on top of grass).
export const PLAINS_TILES = {
  // Outer corners — determined by edge opacity (L/R/T/B = 0 means transparent on that side)
  TOP_LEFT: 25, // Frame 25: L=0 R=6 T=0 B=6 (transparent top+left = outer TL corner)
  TOP_RIGHT: 27, // Frame 27: L=6 R=0 T=0 B=7 (transparent top+right = outer TR corner)
  BOTTOM_LEFT: 36, // Frame 36: L=0 R=0 T=6 B=0 (transparent left+bottom = outer BL corner)
  BOTTOM_RIGHT: 39, // Frame 39: L=8 R=0 T=8 B=0 (transparent right+bottom = outer BR corner)

  // Edges — the transparent side faces OUTWARD (toward grass)
  TOP: 26, // Frame 26: L=6 R=6 T=0 B=8 (transparent top = grass above)
  BOTTOM: 38, // Frame 38: L=7 R=7 T=8 B=0 (transparent bottom = grass below)
  LEFT: 31, // Frame 31: L=0 R=8 T=6 B=6 (transparent left = grass to the left)
  RIGHT: 33, // Frame 33: L=8 R=0 T=7 B=7 (transparent right = grass to the right)

  // Interior fills (fully solid on all edges)
  FILL_1: 32, // Frame 32: L=8 R=8 T=8 B=8 (PERFECT 100% solid green)
  FILL_2: 32, // Same frame for uniform interior (no alternation pattern)

  // Inner corners (concave) — solid green fills work for these
  INNER_TOP_LEFT: 34, // Frame 34: L=8 R=7 T=8 B=8 (almost solid)
  INNER_TOP_RIGHT: 34, // Same
  INNER_BOTTOM_LEFT: 34, // Same
  INNER_BOTTOM_RIGHT: 34, // Same

  // Alternatives
  LEFT_ALT: 31, // Same as LEFT
  RIGHT_ALT: 33, // Same as RIGHT
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

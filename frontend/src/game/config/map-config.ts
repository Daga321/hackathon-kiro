/**
 * Core map configuration constants for the graveyard tilemap.
 */
export const MAP_CONFIG = {
  /** Total map width in pixels */
  WIDTH: 2048,
  /** Total map height in pixels */
  HEIGHT: 2048,
  /** Individual tile size in pixels */
  TILE_SIZE: 16,
  /** Number of tiles horizontally */
  TILES_X: 128,
  /** Number of tiles vertically */
  TILES_Y: 128,
  /** Wall border thickness in tiles */
  BORDER_THICKNESS: 2,
  /** Safe spawn radius from center (in pixels) */
  SPAWN_SAFE_RADIUS: 200,
  /** Deterministic seed for procedural elements */
  SEED: 'graveyard-2024',
} as const;

/** Tileset keys used in preload and tilemap creation */
export const TILESET_KEYS = {
  GRASS: 'grass',
  PLAINS: 'plains',
  WALLS: 'walls',
  FENCES: 'fences',
  DECOR_16: 'decor16',
  DECOR_8: 'decor8',
  OBJECTS: 'objects',
  FLOORING: 'flooring',
} as const;

/** Layer depth ordering */
export const LAYER_DEPTH = {
  GROUND: 0,
  ELEVATED: 1,
  WALLS: 2,
  FENCES: 3,
  DECOR: 4,
  OBJECTS: 5,
} as const;

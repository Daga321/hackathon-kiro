# Bugfix Requirements Document

## Introduction

The `MapGenerator.ts` file produces a 128×128 tile map for a Phaser 3 graveyard game. Three visual bugs degrade the map's appearance:

1. **Broken decor fragments** — The decor layer uses all 20 frames from `decor_16x16.png` without filtering. Some frames show only the top half of a plant (dark green silhouette without a base), appearing as "cut bushes" when placed as standalone tiles.
2. **Missing sand sections** — The map has no sand/dirt area despite `plains.png` rows 0-3 containing solid brown terrain tiles (RGB ~157,118,88). A sand patch should exist in the south-central zone.
3. **Missing holes in elevated terrain** — Specific frames from `decor_16x16.png` that depict holes/cavities (brown cavity shapes on green background) are never placed on elevated platform interiors.

The fix must not alter the autotiling system, wall tiles, cobblestone paths, composite tree system (3×4), stumps (2×4), or bushes (2×4), all of which work correctly.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the decor layer places decoration tiles THEN the system uses all 20 frames (0-19) from `decor_16x16.png` indiscriminately, including partial/broken plant fragments that appear as dark green silhouettes without a base

1.2 WHEN the map is generated THEN the system does not place any sand/dirt patch tiles from `plains.png` rows 0-3, leaving the south-central area as plain grass

1.3 WHEN elevated terrain platforms are decorated THEN the system never places hole/cavity decor frames from `decor_16x16.png` in the platform interiors

### Expected Behavior (Correct)

2.1 WHEN the decor layer places decoration tiles THEN the system SHALL only use a curated whitelist of `decor_16x16.png` frames that render correctly as standalone individual tiles, excluding partial/broken plant fragments

2.2 WHEN the map is generated THEN the system SHALL place a sand/dirt patch area of approximately 15×10 tiles in the south-central zone using `plains.png` rows 0-3 (solid brown color, frames 0-23 with 6 columns per row), with proper edge autotiling against the surrounding grass

2.3 WHEN elevated terrain platforms are decorated THEN the system SHALL place 3-5 hole/cavity decor tiles (from `decor_16x16.png` hole frames) in the interior of elevated platforms, at least 4 tiles away from platform edges

### Unchanged Behavior (Regression Prevention)

3.1 WHEN elevated terrain is generated THEN the system SHALL CONTINUE TO use the existing 8-neighbor autotile logic with `PLAINS_TILES` for platform edges and fills

3.2 WHEN wall tiles are placed around the map border THEN the system SHALL CONTINUE TO use `WALL_TILES` frames with 2-tile border thickness

3.3 WHEN cobblestone paths are generated THEN the system SHALL CONTINUE TO use `plains.png` rows 8-11 (frames 48-71) for gray stone path tiles with proper edge autotiling

3.4 WHEN composite trees (3×4) are placed THEN the system SHALL CONTINUE TO use frames from objects.png cols 0-5, rows 5-12, placed as complete multi-tile composites

3.5 WHEN stumps (2×4) are placed THEN the system SHALL CONTINUE TO use frames from objects.png cols 6-7, rows 5-8, placed as complete multi-tile composites

3.6 WHEN bushes (2×4) are placed THEN the system SHALL CONTINUE TO use frames from objects.png cols 8-9, rows 5-8, placed as complete multi-tile composites

3.7 WHEN the fence layer is created THEN the system SHALL CONTINUE TO use the existing `FENCE_TILES` frames with the same perimeter and segment placements

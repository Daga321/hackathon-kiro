import { MAP_CONFIG } from '../config/map-config';

/**
 * Navigation grid and A* pathfinder for the game map.
 *
 * Builds a walkability grid from the same collision data used by the physics system.
 * Each cell is either walkable (0) or blocked (1).
 *
 * Grid dimensions: 128×128 (same as tile grid).
 */

/** A point on the tile grid */
interface GridPoint {
  x: number;
  y: number;
}

/** A* node for the open/closed sets */
interface AStarNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to goal
  f: number; // g + h
  parent: AStarNode | null;
}

export class Pathfinder {
  /** Walkability grid: false = walkable, true = blocked */
  private grid: boolean[][];
  private readonly width: number;
  private readonly height: number;
  private readonly tileSize: number;

  constructor() {
    this.width = MAP_CONFIG.TILES_X;
    this.height = MAP_CONFIG.TILES_Y;
    this.tileSize = MAP_CONFIG.TILE_SIZE;

    // Initialize all as walkable
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      this.grid.push(new Array(this.width).fill(false));
    }
  }

  /**
   * Mark a tile as blocked. Called during map generation to register obstacles.
   */
  markBlocked(tileX: number, tileY: number): void {
    if (tileX >= 0 && tileX < this.width && tileY >= 0 && tileY < this.height) {
      this.grid[tileY][tileX] = true;
    }
  }

  /**
   * Check if a tile is walkable.
   */
  isWalkable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) return false;
    return !this.grid[tileY][tileX];
  }

  /**
   * Convert world position to tile coordinates.
   */
  worldToTile(worldX: number, worldY: number): GridPoint {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize),
    };
  }

  /**
   * Convert tile coordinates to world position (center of tile).
   */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: tileX * this.tileSize + this.tileSize / 2,
      y: tileY * this.tileSize + this.tileSize / 2,
    };
  }

  /**
   * Find a path from start to goal using A*.
   * Returns an array of world positions (waypoints), or null if no path exists.
   *
   * @param startX World X position of start
   * @param startY World Y position of start
   * @param goalX World X position of goal
   * @param goalY World Y position of goal
   * @param maxNodes Maximum nodes to explore before giving up (performance limit)
   * @returns Array of world-position waypoints, or null if no path found
   */
  findPath(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    maxNodes: number = 500,
  ): { x: number; y: number }[] | null {
    const start = this.worldToTile(startX, startY);
    const goal = this.worldToTile(goalX, goalY);

    // If start or goal is blocked, fail fast
    if (!this.isWalkable(start.x, start.y) || !this.isWalkable(goal.x, goal.y)) {
      return null;
    }

    // If start === goal, no path needed
    if (start.x === goal.x && start.y === goal.y) {
      return [];
    }

    // A* implementation with binary heap approximation (simple sorted insert)
    const openSet: AStarNode[] = [];
    const closedSet = new Set<string>();

    const startNode: AStarNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: this.heuristic(start.x, start.y, goal.x, goal.y),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    let explored = 0;

    while (openSet.length > 0 && explored < maxNodes) {
      explored++;

      // Get node with lowest f
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIdx].f) lowestIdx = i;
      }
      const current = openSet[lowestIdx];
      openSet.splice(lowestIdx, 1);

      // Goal reached
      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(current);
      }

      const key = `${current.x},${current.y}`;
      if (closedSet.has(key)) continue;
      closedSet.add(key);

      // Explore neighbors (4-directional + 4-diagonal)
      const neighbors = this.getNeighbors(current.x, current.y);
      for (const neighbor of neighbors) {
        const nKey = `${neighbor.x},${neighbor.y}`;
        if (closedSet.has(nKey)) continue;
        if (!this.isWalkable(neighbor.x, neighbor.y)) continue;

        // Diagonal movement cost: √2 ≈ 1.41, cardinal: 1
        const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.y;

        // For diagonal movement, check that both adjacent cardinal cells are walkable
        // (prevents cutting corners through walls)
        if (isDiagonal) {
          if (!this.isWalkable(neighbor.x, current.y) || !this.isWalkable(current.x, neighbor.y)) {
            continue;
          }
        }

        const moveCost = isDiagonal ? 1.41 : 1;
        const tentativeG = current.g + moveCost;
        const h = this.heuristic(neighbor.x, neighbor.y, goal.x, goal.y);
        const f = tentativeG + h;

        // Check if already in open set with better g
        const existingIdx = openSet.findIndex((n) => n.x === neighbor.x && n.y === neighbor.y);
        if (existingIdx !== -1) {
          if (openSet[existingIdx].g <= tentativeG) continue;
          openSet.splice(existingIdx, 1);
        }

        openSet.push({
          x: neighbor.x,
          y: neighbor.y,
          g: tentativeG,
          h,
          f,
          parent: current,
        });
      }
    }

    // No path found (or exceeded max nodes)
    return null;
  }

  /**
   * Octile distance heuristic (allows diagonal movement).
   */
  private heuristic(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
  }

  /**
   * Get 8 neighbors of a tile.
   */
  private getNeighbors(x: number, y: number): GridPoint[] {
    return [
      { x: x - 1, y: y }, // left
      { x: x + 1, y: y }, // right
      { x: x, y: y - 1 }, // up
      { x: x, y: y + 1 }, // down
      { x: x - 1, y: y - 1 }, // top-left
      { x: x + 1, y: y - 1 }, // top-right
      { x: x - 1, y: y + 1 }, // bottom-left
      { x: x + 1, y: y + 1 }, // bottom-right
    ];
  }

  /**
   * Reconstruct path from goal node back to start.
   * Returns world positions, skipping the start node (enemy is already there).
   */
  private reconstructPath(goalNode: AStarNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: AStarNode | null = goalNode;

    while (current && current.parent) {
      path.unshift(this.tileToWorld(current.x, current.y));
      current = current.parent;
    }

    return path;
  }

  /**
   * Build the navigation grid from the tilemap layers.
   * Call this after all layers have been generated.
   */
  buildFromLayers(
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
    elevatedLayer: Phaser.Tilemaps.TilemapLayer | null,
    fenceLayer: Phaser.Tilemaps.TilemapLayer | null,
    objectsLayer: Phaser.Tilemaps.TilemapLayer | null,
  ): void {
    // Mark wall tiles
    if (collisionLayer) {
      collisionLayer.forEachTile((tile) => {
        if (tile.index !== -1) {
          this.markBlocked(tile.x, tile.y);
        }
      });
    }

    // Mark elevated terrain tiles
    if (elevatedLayer) {
      elevatedLayer.forEachTile((tile) => {
        if (tile.index !== -1) {
          this.markBlocked(tile.x, tile.y);
        }
      });
    }

    // Mark fence tiles
    if (fenceLayer) {
      fenceLayer.forEachTile((tile) => {
        if (tile.index !== -1) {
          this.markBlocked(tile.x, tile.y);
        }
      });
    }

    // Mark object tiles that have collision (same frames used by physics colliders)
    if (objectsLayer) {
      // Frames that get circular collision bodies:
      const COLLISION_FRAMES = new Set<number>([
        // Gravestones/tombs
        6, 7,
        // Signs, barrels, crates, vases
        0, 1, 2, 3, 4, 5,
        // Large rocks
        16, 17, 18,
        // Solid objects (tables, logs, pots)
        9, 24, 40, 41, 42, 57, 58, 60, 73, 74, 75,
        // Tree trunks
        112, 113, 114, 115, 116, 117, 128, 129, 130, 131, 132, 133, 176, 177, 178, 179, 180, 181,
        192, 193, 194, 195, 196, 197,
        // Stump/cut tree (all rows)
        86, 87, 102, 103, 118, 119, 134, 135,
        // Bush bottoms
        120, 121, 136, 137,
        // Small plant bottoms
        122, 123, 138, 139,
      ]);

      objectsLayer.forEachTile((tile) => {
        if (tile.index !== -1 && COLLISION_FRAMES.has(tile.index)) {
          this.markBlocked(tile.x, tile.y);
        }
      });
    }
  }
}

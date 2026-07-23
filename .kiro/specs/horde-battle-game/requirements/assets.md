# Requirements: Asset Management

> **Related:** [Design](../design/scenes-flow.md) | [Tasks](../tasks/scenes.md)

---

### Requirement 15: Pixel Art Asset Management — Graveyard Theme

**User Story:** As a developer, I want a clear asset management structure with graveyard-themed pixel art, so that graveyard resources (guard, undead, tombstones, fences) can be updated or replaced in future iterations without breaking the game.

#### Acceptance Criteria

1. THE Game SHALL load all Assets from a centralized manifest file that maps logical asset keys to file paths.
2. WHEN an Asset file is not found or fails to load, THE Game SHALL log the error to the browser console and substitute it with a visible placeholder sprite.
3. THE Game SHALL support hot-swapping of Assets by updating the manifest without requiring changes to game logic code.
4. THE Game SHALL use sprite sheets with a uniform frame size per character or object category, as defined in the asset manifest.
5. THE asset manifest SHALL define separate asset categories for: Graveyard_Guard animations (idle, walk, attack, hurt, death), Undead Enemy animations (idle, walk, attack, death), Arena environment tiles (graveyard floor, tombstones, fences, gates), and audio effects (melee swing, undead groan, guard hurt, round start).

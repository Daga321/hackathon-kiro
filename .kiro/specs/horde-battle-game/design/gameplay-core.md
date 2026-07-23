# Design: Gameplay Core

> **Related:** [Requirements](../requirements/gameplay-core.md) | [Tasks](../tasks/gameplay-core.md)

---

## GameObjects

```typescript
// GraveyardGuard.ts  (formerly Player.ts)
class GraveyardGuard extends Phaser.GameObjects.Sprite {
  hp: number;              // [0, 100]
  speed: number;           // 200 px/s (constant)
  meleeRange: number;      // 64 px — staff/shovel range
  attackCooldown: number;  // 600 ms
  lastAttackTime: number;
  
  move(velocity: Phaser.Math.Vector2): void  // normalizes to 200 px/s
  meleeAttack(): void                        // attacks within PLAYER_MELEE_RANGE; respects 600 ms cooldown
  takeDamage(amount: number): void           // clamp to 0; cannot be negative
  clampToArena(bounds: Phaser.Geom.Rectangle): void
}

// Undead.ts  (formerly Enemy.ts)
class Undead extends Phaser.GameObjects.Sprite {
  hp: number;             // > 0 while active
  maxHp: number;          // 100 for standard zombie
  speed: number;          // 80 px/s base
  meleeRange: number;     // 48 px — ALWAYS < PLAYER_MELEE_RANGE (64 px)
  damageTick: number;     // 10 pts every 1000 ms
  undeadType: 'zombie' | 'skeleton';  // extensible for post-MVP
  healthBar: HealthBar;
  
  update(playerPos: Phaser.Math.Vector2, delta: number): void
  takeDamage(amount: number): void
  die(): void             // collapse animation + destruction in ≤300 ms
}

// Projectile.ts  (post-MVP, Req 19 — minimal scaffolding in MVP)
class Projectile extends Phaser.GameObjects.Sprite {
  speed: number;          // 400 px/s
  maxRange: number;       // 400 px
  traveled: number;       // accumulated distance
  damage: number;         // 25 pts
  
  update(delta: number): void
  onHitUndead(enemy: Undead): void
  onHitWall(): void
}

// HealthBar.ts
class HealthBar extends Phaser.GameObjects.Graphics {
  attach(enemy: Undead): void
  update(currentHp: number, maxHp: number): void
  hide(): void
  destroy(): void
}

// HUD.ts
class HUD extends Phaser.GameObjects.Container {
  updateHp(current: number, max: number): void    // red if < 30%
  updateRound(round: number): void
  updateEnemiesLeft(count: number): void
  updateScore(score: number): void                // within 1 frame
  showRoundIncoming(nextRound: number): void      // 3 seconds
}
```

---

## Systems

```typescript
// CombatSystem.ts
class CombatSystem {
  // MVP: guard melee only against undead
  applyPlayerMeleeAttack(guard: GraveyardGuard, enemies: Undead[]): void  // damages all Undead within PLAYER_MELEE_RANGE
  applyUndeadMeleeDamage(undead: Undead, guard: GraveyardGuard, delta: number): void  // 10 pts/1000 ms if ≤ 48 px
  checkGameOver(guard: GraveyardGuard): boolean

  // Post-MVP (Req 19): ranged attack
  applyProjectileDamage(projectile: Projectile, undead: Undead): void
}

// PathfindingSystem.ts
class PathfindingSystem {
  // Direct direction to Player with agent separation
  // Minimum frequency: 10 times/second (every 100 ms)
  updateEnemyDirection(undead: Undead, playerPos: Phaser.Math.Vector2): void
  applySeparationForce(enemies: Undead[], arenaBounds: Phaser.Geom.Rectangle): void
}

// InputSystem.ts
class InputSystem {
  // Keyboard (WASD + arrows) and virtual joystick (mobile)
  getMovementVector(): Phaser.Math.Vector2   // normalized
  isAttackPressed(): boolean                 // click, tap, spacebar or attack button
  getAttackTarget(): Phaser.Math.Vector2     // cursor or touch point (for post-MVP ranged)
}
```

---

## Config

```typescript
// GameConfig.ts
export const GAME_CONFIG = {
  // Graveyard Guard
  PLAYER_SPEED: 200,              // px/s
  PLAYER_HP: 100,
  PLAYER_MELEE_RANGE: 64,        // px — guard's staff/shovel range
  PLAYER_ATTACK_COOLDOWN: 600,   // ms — time between melee attacks
  PLAYER_MELEE_DAMAGE: 30,       // HP applied to each Undead in range

  // Undead
  ENEMY_BASE_SPEED: 80,          // px/s
  ENEMY_HP: 100,
  ENEMY_MELEE_RANGE: 48,         // px — ALWAYS < PLAYER_MELEE_RANGE (64 px)
  ENEMY_DAMAGE_PER_TICK: 10,
  ENEMY_DAMAGE_INTERVAL: 1000,   // ms

  // Collision and spawn
  ENEMY_SEPARATION_RADIUS: 32,   // px
  ROUND_BASE_ENEMIES: 5,
  ROUND_ENEMY_INCREMENT: 3,
  INTER_ROUND_PAUSE: 3000,       // ms
  SPAWN_STRIP_WIDTH: 32,         // px interior to Arena edge
  SPAWN_MIN_DISTANCE: 100,       // px from Player to spawn
  WAVE_MANAGER_MAX_ROUNDS: 50,

  // Post-MVP (Req 19) — values used when ranged is enabled
  PROJECTILE_SPEED: 400,         // px/s
  PROJECTILE_RANGE: 400,         // px — ALWAYS > ENEMY_MELEE_RANGE
  PROJECTILE_DAMAGE: 25,
  PROJECTILE_COOLDOWN: 500,      // ms
} as const;

// UndeadConfig.ts  (extensible for Req 17-18-19)
export interface UndeadDefinition {
  key: string;
  hp: number;
  speed: number;
  meleeRange: number;
  damagePerTick: number;
  scoreValue: number;
  spriteKey: string;
  animKeys: { idle: string; walk: string; attack: string; die: string };
}

// AssetManifest.ts — organized by thematic category
export const ASSET_MANIFEST = {
  guard: {
    idle:   { key: 'guard-idle',   path: 'assets/sprites/guard/idle.png',   frameWidth: 32, frameHeight: 32 },
    walk:   { key: 'guard-walk',   path: 'assets/sprites/guard/walk.png',   frameWidth: 32, frameHeight: 32 },
    attack: { key: 'guard-attack', path: 'assets/sprites/guard/attack.png', frameWidth: 32, frameHeight: 32 },
    hurt:   { key: 'guard-hurt',   path: 'assets/sprites/guard/hurt.png',   frameWidth: 32, frameHeight: 32 },
    death:  { key: 'guard-death',  path: 'assets/sprites/guard/death.png',  frameWidth: 32, frameHeight: 32 },
  },
  undead: {
    zombie:   { key: 'zombie',   path: 'assets/sprites/undead/zombie.png',   frameWidth: 32, frameHeight: 32 },
    skeleton: { key: 'skeleton', path: 'assets/sprites/undead/skeleton.png', frameWidth: 32, frameHeight: 32 },
  },
  arena: {
    ground:    { key: 'cemetery-ground', path: 'assets/tiles/ground.png' },
    gravestone: { key: 'gravestone',     path: 'assets/tiles/gravestone.png' },
    fence:     { key: 'cemetery-fence',  path: 'assets/tiles/fence.png' },
  },
  audio: {
    meleeSwing:   { key: 'sfx-melee-swing',   path: 'assets/audio/melee-swing.mp3' },
    undeadGroan:  { key: 'sfx-undead-groan',  path: 'assets/audio/undead-groan.mp3' },
    undeadDeath:  { key: 'sfx-undead-death',  path: 'assets/audio/undead-death.mp3' },
    guardHurt:    { key: 'sfx-guard-hurt',    path: 'assets/audio/guard-hurt.mp3' },
    roundStart:   { key: 'sfx-round-start',   path: 'assets/audio/round-start.mp3' },
    ambience:     { key: 'music-cemetery',    path: 'assets/audio/cemetery-ambience.mp3' },
  },
} as const;
```

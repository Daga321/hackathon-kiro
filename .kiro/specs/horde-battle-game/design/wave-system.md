# Design: Wave System & HUD

> **Related:** [Requirements](../requirements/wave-system.md) | [Tasks](../tasks/gameplay-core.md)

---

## WaveManager

```typescript
// WaveManager.ts
class WaveManager {
  currentRound: number;
  enemiesRemaining: number;

  // Formula: undead = 5 + (round - 1) * 3
  enemyCountForRound(round: number): number

  startRound(round: number): void
  onEnemyKilled(): void          // if enemiesRemaining === 0 → inter-round pause
  startInterRoundPause(): void   // 3 seconds, then startRound(round+1)
}
```

---

## HUD Component

```typescript
// HUD.ts
class HUD extends Phaser.GameObjects.Container {
  updateHp(current: number, max: number): void    // red if < 30%
  updateRound(round: number): void
  updateEnemiesLeft(count: number): void
  updateScore(score: number): void                // within 1 frame
  showRoundIncoming(nextRound: number): void      // 3 seconds
}
```

### HUD Design Constraints

- Font ≥ 12 px; contrast ≥ 4.5:1 (WCAG AA)
- SHALL NOT occlude more than 10% of the Arena play area
- Health indicator: red if HP < 30%, default color otherwise
- Score update: within 1 rendered frame
- Round incoming notification: displayed for 3 seconds during inter-round pause

---

## AudioSystem

```typescript
// AudioSystem.ts
class AudioSystem {
  playMeleeSwing(): void       // guard swing sound
  playUndeadGroan(): void      // groan on taking damage
  playUndeadDeath(): void      // undead collapse sound
  playGuardHurt(): void        // guard hurt sound
  playRoundStart(): void       // bell/ambience round start
}
```

### Audio Design Notes

- Load keys from `ASSET_MANIFEST.audio`
- Mute if asset did not load (do not throw error)
- Audio keys: `sfx-melee-swing`, `sfx-undead-groan`, `sfx-undead-death`, `sfx-guard-hurt`, `sfx-round-start`, `music-cemetery`

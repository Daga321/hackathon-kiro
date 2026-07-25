# Design: Testing Strategy

> **Related:** [Tasks](../tasks/integration-tests.md)

---

## Dual Approach: Unit Tests + Property-Based Tests

This feature involves game logic with clear mathematical invariants (physics, round formulas, sorting), making it well-suited for property-based testing (PBT). PBT is applied to the pure client logic and the backend; it is **not** applied to AWS infrastructure (IaC, Cognito, DynamoDB) or visual rendering.

---

## Tools

| Context | PBT Framework | Unit Framework |
|---|---|---|
| Client TypeScript (Phaser) | [fast-check](https://github.com/dubzzz/fast-check) | Vitest |
| Backend Lambda (Node.js/TS) | [fast-check](https://github.com/dubzzz/fast-check) | Vitest / Jest |
| IaC (CDK) | N/A — snapshot tests | AWS CDK Assertions |
| Integration | N/A | Supertest + DynamoDB Local |

---

## Unit Tests — Examples and Edge Cases

Unit tests cover:
- Specific scene behavior (MenuScene, AuthScene, GameOverScene)
- Exact state events: game-over at HP=0, inter-round pause, submit score success/failure
- Security: generic error on login, 401 on protected endpoints
- UI: HealthBar appears on first damage, hidden on death animation
- Mobile: virtual joystick and fire button present on touch device

---

## Property-Based Tests — Configuration

Each property test uses fast-check with a **minimum of 100 iterations**. Each test references its design property via a comment tag:

```typescript
// Feature: horde-battle-game, Property N: <property text>
it('Property N: <title>', () => {
  fc.assert(fc.property(
    fc./* arbitraries */,
    (input) => {
      // property verification
    }
  ), { numRuns: 100 });
});
```

---

## Coverage by Property

| Property | PBT Type | Required Arbitraries |
|---|---|---|
| P1: Arena bounds | Invariant | `fc.float(0, W)`, `fc.float(0, H)`, `fc.float(-500, 500)` velocity |
| P2: Player speed normalization | Invariant | `fc.constantFrom` of directional combinations |
| P3: Projectile range | Round-trip / Invariant | `fc.float` angle, origin position |
| P4: Proj range > melee range | Structural | `fc.record` EnemyDefinition |
| P5: Projectile damage = 25 | Invariant | `fc.integer(1, 1000)` enemy HP |
| P6: Fire cooldown ≥ 500 ms | Invariant | `fc.array` of fire timestamps |
| P7: Separation force + Arena | Metamorphic | `fc.array(fc.record(pos))` enemy clusters |
| P8: Enemy speed = 80 px/s | Invariant | `fc.record` Player/Enemy positions |
| P9: Player HP ∈ [0, 100] | Invariant | `fc.array(fc.integer(0, 200))` damages |
| P10: HealthBar ratio | Invariant | `fc.integer(1, 99)` fractional HP |
| P11: Score += 10 exact | Invariant | `fc.integer(1, 200)` damage amounts |
| P12: Wave formula | Mathematical | `fc.integer(1, 50)` round number |
| P13: Spawn distance ≥ 100 | Invariant | `fc.record` player pos + arena bounds |
| P14: Game-over overlay data | Round-trip | `fc.record` session state |
| P15: Play Again reset | Invariant | `fc.record` arbitrary game state |
| P16: Password length validation | Boundary | `fc.string` of length 1-100 |
| P17: DynamoDB retry logic | State machine | `fc.integer(0, 5)` n failures |
| P18: Leaderboard sort order | Invariant | `fc.array(fc.record(entry))` |
| P19: Leaderboard max 100 | Count invariant | `fc.integer(0, 500)` N users |
| P20: Leaderboard fields complete | Structural | `fc.array(fc.record(entry))` |
| P21: 401 on invalid token | Security invariant | `fc.oneof` token variants |
| P22: Friendship bidirectional delete | Round-trip | `fc.record` user pair |
| P23: Anti-cheat plausibility | Metamorphic | `fc.integer` sessionDuration, round |
| P24: HUD color threshold | Threshold invariant | `fc.integer(0, 100)` HP value |

---

## Integration Tests

For infrastructure requirements (DynamoDB, Cognito, Lambda-to-DB wiring), integration tests with 1–3 representative examples are used:

- Submit score → verify it appears in DynamoDB
- Register → verify Cognito user + DynamoDB profile
- Login + token → verify access to protected endpoint
- Logout → verify token invalidated

---

## CDK Snapshot Tests

Infrastructure resources are validated via:

```typescript
// CDK Assertions
template.hasResourceProperties('AWS::DynamoDB::Table', { BillingMode: 'PAY_PER_REQUEST' });
template.hasResourceProperties('AWS::CloudFront::Distribution', { /* ... */ });
```

---

## Performance Tests (non-PBT)

- 60 fps with 30 enemies: measured with Chrome DevTools Performance API
- Initial load < 5 seconds: Lighthouse CI in pipeline
- p99 Lambda < 2000 ms: CloudWatch metrics + alarm

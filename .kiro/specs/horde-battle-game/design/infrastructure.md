# Design: Infrastructure

> **Related:** [Requirements](../requirements/infrastructure-security.md) | [Tasks](../tasks/infrastructure.md)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   BROWSER (Client)                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Phaser 3 Game Engine (WebGL)              │  │
│  │                                                      │  │
│  │  Scenes: Boot → Preload → Menu → Auth → Game →       │  │
│  │          GameOver → Leaderboard                       │  │
│  │                                                      │  │
│  │  Systems: WaveManager · CombatSystem · InputSystem   │  │
│  │           PathfindingSystem · AudioSystem            │  │
│  │                                                      │  │
│  │  GameObjects: Player · Enemy · Projectile ·          │  │
│  │               HealthBar · HUD                        │  │
│  └───────────────────────┬──────────────────────────────┘  │
│                          │ HTTPS (fetch / XHR)             │
└──────────────────────────┼──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │        Amazon CloudFront       │  ← Static assets (S3)
           │     (CDN + optional WAF)       │
           └───────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │       Amazon API Gateway       │
           │   (REST, HTTPS only, CORS)     │
           └──────┬───────────┬────────────┘
                  │           │            │
           ┌──────┴──┐  ┌─────┴───┐  ┌────┴────┐
           │ Lambda  │  │ Lambda  │  │ Lambda  │
           │  Auth/  │  │ Leader- │  │ Friends │
           │Cognito  │  │  board  │  │ Service │
           └──────┬──┘  └─────┬───┘  └────┬────┘
                  │           │            │
           ┌──────┴───────────┴────────────┴──┐
           │           DynamoDB               │
           │  (users · scores · friends)      │
           └──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │       Amazon CloudWatch        │
           │  (Logs · Metrics · Alarms)     │
           └───────────────────────────────┘
```

---

## Architecture Decisions

| Decision | Choice | Justification |
|---|---|---|
| Game engine | Phaser 3 (WebGL) | Mature, native pixel art support, built-in Arcade physics, active community, TypeScript friendly |
| Build | Vite | Instant HMR, tree-shaking, optimized production output |
| Auth | Amazon Cognito User Pools | JWT OAuth 2.0 out-of-the-box, native rate-limiting, no custom auth server required |
| DB | DynamoDB on-demand | No capacity management, pay-per-use, low read latency with GSI for leaderboard |
| Hosting | S3 + CloudFront | Immutable assets with long TTL, global CDN, low cost |
| API | API Gateway REST + Lambda | Auto-scaling, serverless, cost per invocation |
| IaC | AWS CDK (TypeScript) | Same language as backend, reusable constructs, compile-time validation |
| Score async | Synchronous with client retries | For MVP, SQS/EventBridge doesn't justify the additional complexity; can migrate post-MVP |

# Requirements Document

## Introduction

Horde Battle Game is a top-down action asynchronous multiplayer browser game, set in a graveyard and starring a guard who must defend his territory from waves of the undead. Inspired by titles like Boxhead and Brotato, the player controls the guard inside the graveyard arena and must survive successive waves of undead that increase in number and difficulty. The guard begins the game with melee attack only; ranged combat (projectiles) is a capability that unlocks in later rounds or as a post-MVP feature. The game runs on desktop and mobile web browsers, and features an AWS backend for authentication, global rankings, friend lists, and friend leaderboards.

---

## Glossary

- **Game**: The complete game system (Phaser 3 client + AWS backend).
- **Player**: The graveyard guard controlled by the human user; main character of the game.
- **Graveyard_Guard**: The playable character — a graveyard guard who defends his territory from the undead using first his staff/shovel (melee) and later ranged weapons.
- **Enemy**: An undead (zombie, skeleton, or other living dead) controlled by the AI that chases the Player and inflicts melee damage.
- **Undead**: Generic term for all Enemy types; refers to the living dead theme of the game.
- **Arena**: The bounded graveyard — the play space with tombstones, fences, and themed elements that contain the Player and Enemies.
- **Round**: A wave of undead Enemies that must be eliminated to advance.
- **Wave_Manager**: The Game component responsible for spawning and controlling Rounds.
- **Combat_System**: The component that calculates and applies damage between Player and Enemies; manages both melee combat and (post-MVP) ranged combat.
- **Melee_Attack**: The Player's close-range attack using his staff/shovel; the only attack mode available in the MVP.
- **Melee_Range**: The maximum distance in pixels at which the Player's Melee_Attack can hit an Enemy.
- **Projectile**: An object fired by the Player (post-MVP or advanced rounds) that travels in a straight line and deals damage on hitting an Enemy.
- **Health_Bar**: The visual indicator of an Enemy's remaining hit points, visible only when the Enemy has taken damage.
- **HUD**: The interface layer overlaid on the game that displays status information to the user (health, round, score, etc.).
- **Auth_Service**: The backend component responsible for registration, login, and user session management, implemented on Amazon Cognito.
- **User_Profile**: The record persisted in DynamoDB that stores a user's account data, statistics, and friend list.
- **Leaderboard_Service**: The backend component that manages global and friend rankings, stored in DynamoDB.
- **Friends_Service**: The backend component that manages friend requests, friend lists, and friend leaderboard queries.
- **API_Gateway**: The AWS API Gateway service that exposes the backend REST endpoints.
- **Lambda**: The AWS Lambda functions that implement the backend business logic.
- **CDN**: Amazon CloudFront that serves the frontend static assets.
- **Pathfinding**: The navigation algorithm that Enemies use to reach the Player within the Arena.
- **Boss**: A special high-resistance undead Enemy (e.g., giant zombie or undead lord) that appears at the end of specific rounds (post-MVP feature).
- **Asset**: A graphic or audio resource in pixel art format used by the Game; includes graveyard sprites, guard, undead, and themed sound effects.

---

## Requirements Index

| Domain | File | Requirements |
|--------|------|-------------|
| Gameplay Core | [gameplay-core.md](requirements/gameplay-core.md) | Req 1-5 |
| Wave System & HUD | [wave-system.md](requirements/wave-system.md) | Req 6-7 |
| Game Session | [game-session.md](requirements/game-session.md) | Req 8 |
| User Authentication | [user-authentication.md](requirements/user-authentication.md) | Req 9 |
| Social & Leaderboards | [social-leaderboards.md](requirements/social-leaderboards.md) | Req 10-11 |
| Platform & Mobile | [platform-mobile.md](requirements/platform-mobile.md) | Req 12, 14 |
| Infrastructure & Security | [infrastructure-security.md](requirements/infrastructure-security.md) | Req 13, 16 |
| Asset Management | [assets.md](requirements/assets.md) | Req 15 |
| Post-MVP | [post-mvp.md](requirements/post-mvp.md) | Req 17-19 |

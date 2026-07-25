# Requirements: Gameplay Core

> **Related:** [Design](../design/gameplay-core.md) | [Tasks](../tasks/gameplay-core.md)

---

### Requirement 1: Guard Movement

**User Story:** As a graveyard guard, I want to move my character freely around the arena using keyboard or touch controls, so that I can strategically reposition and avoid the undead while preparing to attack in melee.

#### Acceptance Criteria

1. WHEN the player presses a cardinal directional input (WASD or arrow keys for North, South, East, West; or the on-screen joystick displaced more than 10% of its maximum radius), THE Game SHALL move the Graveyard_Guard in the corresponding direction at a constant speed of 200 pixels per second.
2. WHEN the player's position plus the next movement step exceeds the Arena boundary, THE Game SHALL clamp the player's position to the boundary before rendering, preventing any movement outside the edges.
3. WHILE the player is moving, THE Game SHALL animate the Graveyard_Guard sprite using the corresponding directional walk animation.
4. WHILE the player is stationary, THE Game SHALL display the Graveyard_Guard idle animation.
5. THE Game SHALL accept simultaneous directional inputs to produce diagonal movement; the resulting velocity vector SHALL be normalized to 200 pixels per second (not 283 px/s).
6. WHERE the Game is running on a mobile device, THE Game SHALL render an on-screen virtual joystick of at least 80 pixels radius in the lower-left region of the screen, positioned at least 16 pixels from the left and bottom edges and occupying no more than 20% of the screen width.

---

### Requirement 2: Guard Melee Attack System (MVP)

**User Story:** As a graveyard guard, I want to attack nearby undead with my melee weapon (staff or shovel), so that I can defend myself from the horde at close range.

#### Acceptance Criteria

1. WHEN the player activates an attack input (mouse click on desktop, tap on mobile, spacebar or on-screen attack button), THE Combat_System SHALL execute a Melee_Attack centered on the Graveyard_Guard's current position, affecting all Enemies within Melee_Range.
2. THE Combat_System SHALL define the Graveyard_Guard's Melee_Range attack as 64 pixels from the player's center.
3. THE Combat_System SHALL define the Enemies' melee attack range as 48 pixels from their center, which SHALL be strictly less than the player's Melee_Range (64 pixels).
4. THE Game SHALL play the Graveyard_Guard's melee swing animation when a Melee_Attack is executed, completing the animation in no more than 400 milliseconds.
5. WHEN a Melee_Attack is executed and one or more Enemies are within Melee_Range, THE Combat_System SHALL apply 30 damage points to each Enemy within range simultaneously.
6. WHEN a Melee_Attack is executed and no Enemies are within Melee_Range, THE Combat_System SHALL play the swing animation without applying any damage; no error or additional effect SHALL be triggered.
7. THE Combat_System SHALL rate-limit the player's attack to one Melee_Attack every 600 milliseconds; attack inputs received before the cooldown expires SHALL be silently ignored.
8. WHERE the Game is running on a mobile device, THE Game SHALL render an on-screen attack button of at least 64 × 64 pixels positioned within 16 pixels of the right and bottom edges of the screen.

---

### Requirement 3: Undead Behavior (Pathfinding and Movement)

**User Story:** As a graveyard guard, I want the undead to actively chase me through the graveyard, so that the game presents a constant and growing threat that forces me to keep moving and attacking.

#### Acceptance Criteria

1. WHILE a Round is active, THE Pathfinding_System SHALL update each Enemy's direction toward the player's current position at a minimum frequency of 10 times per second.
2. WHILE a Round is active, THE Game SHALL move each Enemy (zombie/skeleton) toward the player at a base speed of 80 pixels per second.
3. WHEN an Enemy collides with the Arena boundary, THE Pathfinding_System SHALL recalculate a valid direction that keeps the Enemy within the Arena; IF no valid direction toward the player exists (e.g., the Enemy is cornered), THEN THE Pathfinding_System SHALL allow the Enemy to remain stationary until the player moves to a position where a valid path exists, at which point the Enemy SHALL immediately resume movement toward the player.
4. WHEN the centers of multiple Enemies are within 32 pixels of each other, THE Pathfinding_System SHALL apply a separation force to push them apart; IF the separation force would push an Enemy outside the Arena boundary, THE Game SHALL clamp the Enemy's position to remain within the Arena.
5. WHILE an Enemy is more than 48 pixels from the player, THE Combat_System SHALL prevent the Enemy from inflicting melee damage on the player.
6. WHILE no Round is active, THE Combat_System SHALL prevent all Enemies from inflicting melee damage on the player, regardless of distance.

---

### Requirement 4: Undead Damage and Health System

**User Story:** As a graveyard guard, I want to see the undead health bars when I hit them and watch them collapse when they reach zero health, so that I can gauge the effectiveness of my combat against the horde.

#### Acceptance Criteria

1. THE Combat_System SHALL initialize each standard Undead Enemy (zombie or skeleton) with 100 hit points upon spawning.
2. WHEN an Enemy takes damage for the first time, THE Game SHALL display the Enemy's Health_Bar above its sprite.
3. WHILE an Enemy's hit points are greater than 0 and less than maximum, THE Game SHALL update the Health_Bar width proportionally to the ratio of current hit points over maximum hit points.
4. WHEN an Enemy's hit points reach 0 or below, THE Game SHALL immediately start the Enemy's death/collapse animation and remove it from the Arena no later than 300 milliseconds after the death animation starts; the Health_Bar SHALL be hidden when the death animation begins.
5. WHEN an Enemy's hit points reach 0 or below, THE Game SHALL increment the player's score by exactly 10 points for that Enemy, regardless of overkill damage.
6. WHEN an Enemy is removed from the Arena, THE Game SHALL destroy the associated Health_Bar.

---

### Requirement 5: Guard Damage

**User Story:** As a graveyard guard, I want to lose health when the undead scratch or bite me, so that survival requires actively managing positioning and attack timing.

#### Acceptance Criteria

1. WHILE an Enemy is within 48 pixels of the player, THE Combat_System SHALL inflict 10 damage points to the Graveyard_Guard every 1000 milliseconds per Enemy (each Enemy applies its own damage tick independently).
2. WHEN a game session begins, THE Combat_System SHALL set the Graveyard_Guard's hit points to 100; the player's hit points SHALL NEVER fall below 0.
3. IF the player's hit points reach 0 after a damage calculation, THEN THE Game SHALL trigger the game-over sequence within 500 milliseconds.
4. WHILE a Round is active, THE HUD SHALL display the player's current hit points as a numeric value and as a health bar.
5. IF the player's hit points reach 0, THEN THE Game SHALL record the current Round number as the last Round reached in that session.

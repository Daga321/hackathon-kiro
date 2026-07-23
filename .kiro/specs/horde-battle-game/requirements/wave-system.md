# Requirements: Wave System & HUD

> **Related:** [Design](../design/wave-system.md) | [Tasks](../tasks/scenes.md)

---

### Requirement 6: Round System — Undead Hordes (Wave Manager)

**User Story:** As a graveyard guard, I want to face growing waves of undead that increase in number each round, so that the game becomes progressively more challenging as the night advances.

#### Acceptance Criteria

1. WHEN the game session begins, THE Wave_Manager SHALL start at Round 1 and spawn 5 Enemies.
2. WHEN a Round begins, THE Wave_Manager SHALL spawn all Enemies for that Round at random positions along a 32-pixel-wide strip on the interior of the Arena boundary, with each spawn point at least 100 pixels from the player's current position (measured center to center).
3. WHEN all Enemies in a Round are eliminated, THE Wave_Manager SHALL trigger a 3-second inter-round pause before starting the next one.
4. WHEN the inter-round pause ends, THE Wave_Manager SHALL increment the Round counter by 1 and set the number of Enemies to the previous Round's count plus 3.
5. WHILE a Round is active, THE HUD SHALL display the current Round number and the remaining Enemy count.
6. WHILE the inter-round pause is active, THE Game SHALL display a "Round [N] incoming" notification where [N] is the next Round number, for the full 3 seconds.
7. THE Wave_Manager SHALL support a minimum of 50 consecutive Rounds without requiring a game restart.

---

### Requirement 7: In-Game HUD Interface

**User Story:** As a player, I want a clear HUD showing my health, score, and round information, so that I can make informed decisions during combat.

#### Acceptance Criteria

1. WHILE a Round is active, THE HUD SHALL simultaneously display the player's current hit points, the current Round number, the remaining Enemy count, and the player's current score.
2. THE HUD SHALL remain legible at viewport widths between 360 and 1920 pixels, with a minimum font size of 12 pixels and a contrast ratio of at least 4.5:1 against the background (WCAG AA).
3. WHEN the player's hit points fall below 30% of their maximum hit points, THE HUD SHALL render the health bar and numeric health value in red.
4. WHEN the player's hit points return to 30% or above, THE HUD SHALL revert the health bar and numeric value to the default color.
5. WHEN the player's score increases, THE HUD SHALL update the score display within one rendered frame.
6. THE HUD SHALL NOT occlude more than 10% of the Arena play area at any supported viewport size.
7. WHEN a Round starts, THE HUD SHALL display the correct Round number, Enemy count, and player hit points before the first Enemy action occurs.

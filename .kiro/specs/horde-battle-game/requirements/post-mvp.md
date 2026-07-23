# Requirements: Post-MVP Features

> **Related:** These features are planned for after MVP completion.

---

### Requirement 17: Undead Variety — Post-MVP

**User Story:** As a graveyard guard, I want to face different types of undead with distinct movement patterns and abilities in advanced rounds, so that the game remains entertaining as the night progresses.

#### Acceptance Criteria

1. WHERE the variant enemies feature is enabled, THE Wave_Manager SHALL introduce a second Undead type (fast skeleton) with a movement speed of 140 pixels per second starting from Round 10.
2. WHERE the variant enemies feature is enabled, THE Wave_Manager SHALL introduce a ranged Undead type (bone thrower) that maintains a distance of 200 pixels from the player and fires bone projectiles toward the player at 2-second intervals, starting from Round 15.
3. WHERE the variant enemies feature is enabled, THE Combat_System SHALL assign to each Undead type distinct hit point and damage values as defined in the enemy configuration file.

---

### Requirement 18: Undead Bosses — Post-MVP

**User Story:** As a graveyard guard, I want to face a powerful undead boss at the end of certain rounds, to experience a culminating challenge that tests my accumulated skills as a graveyard defender.

#### Acceptance Criteria

1. WHERE the boss feature is enabled, THE Wave_Manager SHALL spawn an Undead Boss (e.g., Giant Zombie or Undead Lord) as the last Enemy of every tenth Round (Rounds 10, 20, 30, etc.).
2. WHERE the boss feature is enabled, THE Combat_System SHALL initialize the Undead Boss with 1000 hit points and a melee damage of 25 points per hit.
3. WHERE the boss feature is enabled, THE Game SHALL display a differentiated Boss Health_Bar at the top of the screen, in addition to the standard Health_Bar above the Boss sprite.
4. WHERE the boss feature is enabled, WHEN the Undead Boss is killed, THE Game SHALL award the Graveyard_Guard 500 bonus points.

---

### Requirement 19: Ranged Attack System — Post-MVP

**User Story:** As a graveyard guard, I want to unlock ranged attacks (throwing holy water, firing a flare gun, etc.) in advanced rounds, so that I can deal with large undead hordes from a safer distance as the game progresses.

#### Acceptance Criteria

1. WHERE the ranged attack feature is enabled, THE Combat_System SHALL allow the Graveyard_Guard to execute a Ranged_Attack by activating the secondary attack input (right-click on desktop, dedicated ranged attack button on mobile).
2. WHERE the ranged attack feature is enabled, THE Combat_System SHALL spawn a Projectile at the player's position aimed toward the cursor position on desktop or the touch point on mobile at the moment of input.
3. WHERE the ranged attack feature is enabled, THE Combat_System SHALL assign each Projectile a travel speed of 400 pixels per second and a maximum range of 400 pixels.
4. WHERE the ranged attack feature is enabled, THE Projectile range (400 pixels) SHALL always exceed the Enemy's melee attack range (48 pixels).
5. WHERE the ranged attack feature is enabled, WHEN a Projectile collides with an Undead Enemy, THE Combat_System SHALL apply 25 damage points to the Enemy and destroy the Projectile.
6. WHERE the ranged attack feature is enabled, THE Combat_System SHALL rate-limit Ranged_Attacks to one Projectile every 500 milliseconds; inputs received before the cooldown expires SHALL be silently ignored.

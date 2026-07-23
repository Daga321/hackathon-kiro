# Requirements: Game Session

> **Related:** [Design](../design/scenes-flow.md) | [Tasks](../tasks/scenes.md)

---

### Requirement 8: Game Over Condition

**User Story:** As a player, I want a clear game-over screen when I die, showing my final stats and options to submit my score or play again, so that I have closure and motivation to improve.

#### Acceptance Criteria

1. WHEN the game-over sequence is triggered, THE Game SHALL pause all gameplay and display a game-over overlay screen within 500 milliseconds.
2. THE Game SHALL display on the game-over screen: the final Round reached, total Enemies killed, and total score.
3. IF a User is authenticated, THEN THE Game SHALL display a "Submit Score" button on the game-over screen.
4. WHEN the User activates the "Submit Score" button, THE Leaderboard_Service SHALL persist the score, Round number, and timestamp in the User_Profile in DynamoDB.
5. WHEN the User activates the "Play Again" button, THE Game SHALL reset the player's hit points to 100, set the Round counter to 1, clear all Enemies, and start Round 1.
6. IF the Leaderboard_Service submission fails due to a network error, THEN THE Game SHALL display an error message and retain the "Submit Score" button for the User to retry.
7. IF the Leaderboard_Service submission fails due to a non-network error, THEN THE Game SHALL hide the "Submit Score" button and display a generic error message; the failure SHALL be logged silently without exposing internal details.
8. WHEN the Leaderboard_Service submission succeeds, THE Game SHALL disable the "Submit Score" button and display a confirmation message to prevent duplicate submissions.

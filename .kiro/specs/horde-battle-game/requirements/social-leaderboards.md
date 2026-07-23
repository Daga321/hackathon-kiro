# Requirements: Social & Leaderboards

> **Related:** [Design](../design/backend-api.md) | [Tasks](../tasks/backend-leaderboard.md) | [Tasks](../tasks/backend-friends.md)

---

### Requirement 10: Global Rankings

**User Story:** As a player, I want to see a global leaderboard with the best scores, so that I can compare my performance with players worldwide.

#### Acceptance Criteria

1. THE Leaderboard_Service SHALL maintain a global ranking ordered by highest Round reached, using total score as the tiebreaker.
2. WHEN the global leaderboard is requested, THE Leaderboard_Service SHALL return the top 100 entries from the global ranking.
3. WHEN a User submits a score, THE Leaderboard_Service SHALL update the global ranking within 5 seconds; IF the update fails, THE Leaderboard_Service SHALL log the error and return HTTP 500 to the requester.
4. WHEN the global leaderboard is displayed, THE Game SHALL show for each entry: rank position, username, highest Round reached, and total score.
5. WHEN a User views the global leaderboard, THE Game SHALL highlight the User's own entry whether it appears within the top 100 or outside it (displayed at the bottom of the list if outside the top 100).
6. THE Leaderboard_Service SHALL reject score submissions that do not include a valid session token, returning HTTP 401.

---

### Requirement 11: Friends List

**User Story:** As a player, I want to add friends and see their scores in a dedicated leaderboard, so that I can compete directly with people I know.

#### Acceptance Criteria

1. WHEN an authenticated User sends a friend request using a valid username, THE Friends_Service SHALL create a pending friendship relationship in DynamoDB.
2. WHEN the recipient User accepts the friend request, THE Friends_Service SHALL mark the relationship as confirmed and make both Users appear in each other's friend lists.
3. WHEN a User rejects a friend request, THE Friends_Service SHALL delete the pending relationship from DynamoDB.
4. WHEN an authenticated User requests their friend list, THE Friends_Service SHALL return all confirmed friends including each friend's username and highest Round reached.
5. WHEN an authenticated User requests the friends leaderboard, THE Leaderboard_Service SHALL return a ranking of the User's confirmed friends ordered by highest Round reached, with total score as the tiebreaker.
6. WHEN the friends leaderboard is displayed, THE Game SHALL show for each entry: rank position, username, highest Round reached, and total score.
7. IF a User removes a friend, THEN THE Friends_Service SHALL delete the confirmed relationship and immediately exclude that User from both parties' friend leaderboards.

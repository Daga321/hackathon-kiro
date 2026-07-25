# Requirements: Platform & Mobile Support

> **Related:** [Design](../design/infrastructure.md) | [Tasks](../tasks/mobile-responsive.md)

---

### Requirement 12: Mobile Device Support

**User Story:** As a mobile player, I want the game to be fully playable on my phone or tablet, so that I can enjoy it without needing a keyboard or mouse.

#### Acceptance Criteria

1. THE Game SHALL render at the device's native viewport size without horizontal scrolling on screens with a minimum width of 360 pixels.
2. THE Game SHALL scale the Arena and HUD proportionally to fill the available viewport while preserving the game's aspect ratio; areas not covered by scaled content SHALL be filled with letterbox or pillarbox bars.
3. WHERE the Game is running on a touch device, THE Game SHALL accept touch events as input equivalent to keyboard and mouse.
4. THE Game SHALL display on-screen controls (virtual joystick and attack button) only on touch devices.
5. WHILE on-screen controls are displayed, THE Game SHALL ensure they respond to touch input and produce the corresponding game action within one rendered frame.
6. WHEN device orientation changes, THE Game SHALL pause gameplay, recalculate the layout, resize the Arena and HUD within 200 milliseconds, and then resume gameplay.
7. HUD touch targets (buttons) SHALL have a minimum size of 44 × 44 pixels; the virtual joystick and attack button SHALL have a minimum touch target of 48 × 48 pixels at all viewport sizes.
8. The combined screen area occupied by the virtual joystick and attack button SHALL NOT occlude more than 20% of the Arena play area.

---

### Requirement 14: Client Performance and Compatibility

**User Story:** As a player, I want the game to run smoothly on modern browsers without installation, so that I can start playing immediately.

#### Acceptance Criteria

1. THE Game SHALL maintain a minimum frame rate of 60 frames per second on desktop browsers (Chrome 120+, Firefox 120+, Safari 17+) during Rounds with up to 30 simultaneous Enemies.
2. THE Game SHALL maintain a minimum frame rate of 30 frames per second on mobile browsers (Chrome for Android 120+, Safari for iOS 17+) during Rounds with up to 20 simultaneous Enemies.
3. THE Game SHALL load and reach an interactive state within 5 seconds on a 10 Mbps connection.
4. THE Game SHALL NOT require any browser plugin or native installation to run.
5. IF a browser does not support WebGL, THEN THE Game SHALL display a message indicating that a WebGL-compatible browser is required and provide a link to download a compatible browser.

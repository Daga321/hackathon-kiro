# Tasks: Mobile & Responsive

> **Related:** [Requirements](../requirements/platform-mobile.md)

---

> ⚠️ **Note:** Tasks 16-17 (Mobile & Responsive) are referenced in the dependency graph but have not yet been fully detailed in the implementation plan. The following structure is reserved for when the tasks are expanded.

- [ ] 16. Implement mobile responsive layout
  - [ ] 16.1 Implement viewport scaling
    - Scale Arena and HUD proportionally to fill viewport while preserving aspect ratio
    - Add letterbox/pillarbox bars for uncovered areas
    - Support minimum viewport width of 360 px without horizontal scrolling
    - _Requirements: 12.1, 12.2_
  - [ ] 16.2 Implement orientation change handling
    - Pause gameplay on orientation change
    - Recalculate layout and resize Arena + HUD within 200 ms
    - Resume gameplay after resize
    - _Requirements: 12.6_
  - [ ] 16.3 Implement touch target compliance
    - HUD buttons minimum 44×44 px touch targets
    - Virtual joystick and attack button minimum 48×48 px touch targets
    - Combined on-screen controls ≤ 20% of Arena play area
    - _Requirements: 12.7, 12.8_

- [ ] 17. Implement WebGL fallback messaging
  - [ ] 17.1 Detect WebGL support
    - Check for WebGL context availability on game boot
    - If unsupported: display message + link to compatible browser
    - Do not attempt to render game without WebGL
    - _Requirements: 14.5_

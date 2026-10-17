# render

Phaser scenes, tilemap layers, sprites and camera. Reads snapshots from the worker and never changes game state.

- **Public API:** `src/render/index.ts`: `startRenderer(parent)` boots Phaser into an element and returns the game.
- **State owned:** none of the game's; only view state (camera, selection).
- **Rules:** may import Phaser, worker protocol types and content art names.
- **Tests:** covered by the browser smoke (`tests/browser`).

# render

Phaser scenes, tilemap layers, sprites and camera. Reads snapshots from the worker and never changes game state.

- **Public API:** `src/render/index.ts`: `startRenderer(parent, {onHover, onZoom, onSelect})` boots Phaser with the valley scene and returns a `Renderer` (`setMapSize`, `applyChunks`, `zoomStep`, `mark` (the inspected tile's corner marks), `thumbnail` (a 112 by 80 JPEG of the view for the save list, '' on failure), `fps`, `destroy`). `onSelect` fires on a tap or click that did not end a drag or pinch; `ZOOMS` (½, 1, 2, 3; ½ is an overview below the 32 px rule); type `Hover`.
- **Drawing:** one tilemap layer (a `TilemapGPULayer` on WebGL, a plain layer on Canvas) from the packed `tiles-base` sheet; a changed chunk rewrites only its tiles. Chunks that arrive before the scene is ready are held. A position hash picks each tile's picture variant: a picture choice, never state.
- **Camera:** drag to pan, wheel or pinch to zoom on fixed steps, WASD and arrows; bounded by the map.
- **State owned:** none of the game's; only view state (camera, selection).
- **Rules:** may import Phaser, worker protocol types and content art names.
- **Tests:** covered by the browser smoke (`tests/browser`).

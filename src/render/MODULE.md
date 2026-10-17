# render

Phaser scenes, tilemap layers, sprites and camera. Reads snapshots from the worker and never changes game state.

- **Public API:** `src/render/index.ts`: `startRenderer(parent, {onHover, onSelect})` boots Phaser with the valley scene and returns a `Renderer` (`setMapSize`, `applyChunks`, `zoomStep`, `mark` (the inspected tile's corner marks), `thumbnail` (a 112 by 80 JPEG of the view for the save list, '' on failure), `fps`, `destroy`). `onSelect` fires on a tap or click that did not end a drag or pinch; type `Hover`.
- **Drawing:** two plain tilemap layers (not Phaser's `TilemapGPULayer`, whose shader mis-reads tile indices on some phones): ground from the packed `tiles-base` and `tiles-world` sheets, one tileset after the other, and features (trees, bushes, herbs, boulders) from `sprites-nature` over it; a changed chunk rewrites only its tiles. Chunks that arrive before the scene is ready are held. A position hash picks each tile's picture variant: a picture choice, never state.
- **Camera:** drag to pan, wheel, pinch or the +/− buttons to zoom on fixed steps (¼, ½, 1, 2, 3; below 1 is an overview under the 32 px rule, VR-37) plus a lowest step that fits the whole map on screen, refitted on resize; WASD and arrows; bounded by the map.
- **State owned:** none of the game's; only view state (camera, selection).
- **Rules:** may import Phaser, worker protocol types and content art names.
- **Tests:** covered by the browser smoke (`tests/browser`).

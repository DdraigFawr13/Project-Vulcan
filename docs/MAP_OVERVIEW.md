# The map drawn by chunk, and the overview

Phase 6W Slice 2 (V-013, V-030, V-094). View only (V-015, V-041): nothing here changes game state. Mock-up form answered by Morgan on 2026-11-20: https://claude.ai/artifact/E1SVwfdi4GfMpt7DwDohVE (every answer was the recommended one; no notes).

## What changes

- **Chunks near the camera.** The render keeps tile layers only for the chunks (16 by 16, `CHUNK`) near the camera, not whole-map layers. Nothing you see at 3× to ½× changes.
- **The overview below ½×.** Zoomed out past ½×, the map shows one small picture instead of tiles. Between 3× and ½× the tiles still draw.
- **Its look: tile colours.** Each tile is painted in the average colour of its own art, trees darkening the ground, water and snow from their own art, so soils, clay and V-094's looks still show and zooming in has no jump. The picture is refreshed from changed chunks, so building, digging and farming show on it.
- **Levels below.** Each level gets its own overview; unknown rock stays black as now (V-030), with veins as today.
- **Colonists.** Each colonist on the level on screen is a small ember dot on the overview, moving as they walk.
- **Tapping it.** A tap on the overview glides the view in to 1× centred on that spot, instead of opening a tile sheet (today a tap at any zoom selects a tile: `src/render/scene.ts`, the `pointerup` handler).

## Numbers

Baseline measured on main 30ea14b with the 6W design thread's `phone-bench.cjs` (390 px, CPU 4× slower, production build, seed anvil valley 1, two runs each, averaged):

- Screen memory: 28.0 MB at 150 tiles, 58.5 MB at 250.
- Frames a second at normal zoom: 18.4 at 150, 12.5 at 250.
- Frames a second zoomed right out: 6.2 at 150, 2.8 at 250.

Done when (PHASE_6W Slice 2) at 250 tiles: memory 30.8 MB or less, 16.6 frames or more at normal zoom and 5.5 or more zoomed out. The bench, the mock-up pictures and the script that drew them are in project files `vulcan/p6w-slice2/` (not committed).

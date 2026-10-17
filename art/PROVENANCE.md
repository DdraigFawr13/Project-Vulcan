# Art provenance

One line per asset group: path, how it was made, date, licence of any input (SAFE-05). Placeholder art is drawn by script unless a line says otherwise.
- `art/src/tiles-base/`: drawn by `tools/draw-tiles-base.mjs` from `art/palette.gpl` (both original to this repo), 2026-10-17; no outside inputs.
- `art/src/tiles-world/`: drawn by `tools/draw-nature.mjs` from `art/palette.gpl` (both original to this repo), 2026-10-17; no outside inputs.
- `art/src/sprites-nature/`: drawn by `tools/draw-nature.mjs` from `art/palette.gpl` (both original to this repo), 2026-10-17; no outside inputs.
- `water.shore.*` (47 frames) and `water.deep.*` (16) in `tiles-world`, `spring.1` in `sprites-nature`: drawn by `tools/draw-water.mjs` from `art/palette.gpl` and the `tiles-base` water tiles, 2026-10-17; no outside inputs.
- `tile.slate.1`, `tile.limestone.1`, `tile.sandstone.1`, `log.fallen.1`: drawn by `tools/draw-nature-rock.mjs` (called from `draw-nature.mjs`), 2026-10-17; no outside inputs.
- `tile.earth.1`, `tile.clay.1`, `tile.groundwater.1`, `tile.cave-floor.1`, `tile.stairs-down.1`, `tile.stairs-up.1`, `tile.stairs.1`, `tile.shaft.1` in `tiles-world`: drawn by `tools/draw-underground.mjs` (called from `draw-nature.mjs`) from `art/palette.gpl`, 2026-10-17; no outside inputs.
- `vein.copper.1`, `vein.tin.1`, `vein.iron.1`, `vein.sulphur.1`, `vein.gold.1`, `vein.silver.1`, `vein.gems.1`, `vein.obsidian.1` in `sprites-nature`: drawn by `tools/draw-underground.mjs` from `art/palette.gpl` (seven entries added for P1.3: malachite, sulphur, gold, silver, gem purple, gem purple light, gem red), 2026-10-17; no outside inputs.

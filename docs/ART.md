# Placeholder art plan

Flat-shaded pixel art in the muted palette, readable at 32 px, nothing drawn before its milestone needs it. Each sheet is shown to Morgan as an artifact before it lands.

| Milestone | Sheet | Contents |
| --- | --- | --- |
| P0.4 | `tiles-base` | grass, dirt, sand, gravel, stone floor, rock wall, darkness, shallow and deep water; selection and designation overlays |
| P1.1 to P1.3 | `tiles-world`, `sprites-nature` | biome floors, snow, ice, ore veins, aura, stairs, shaft, shore autotile (47-tile blob, `water.shore.<mask>`) and deep water inside shallow (16 frames, `water.deep.<mask>`), both by `tools/draw-water.mjs` (a deep tile on a bank draws its shore frame, so it shows shallow; rare, as lake rims are shallow); trees, bushes, boulders, herbs, spring marker |
| P1.4 | `tiles-world` | ice over lake water (47 shore frames `ice.shore.<mask>`, 16 deep `ice.deep.<mask>`, `tile.ice.1`) and a core and ring glow for each of the six schools (`aura.<school>.core`, `aura.<school>.1`), by `tools/draw-ice.mjs` |
| P2.1, P2.4 | `sprites-people`, `items` | one body per race, 4 facings, 2 walk frames, tinted hair and clothing overlays, carried-item slot; icons for logs, stone, ores, ingots, food, tools, weapons, cloth, leather, herbs |
| P3.2 | `buildings` | slim walls by material, a band a third of a tile wide autotiled by the four sides it joins (`build.wall-<material>.<mask>`, north 1, east 2, south 4, west 8), floors with half and quarter frames for under a wall's open side (`build.floor-<material>`, `.half.<side>`, `.q.<corner>`), doors in an east-west or north-south run (`.h`, `.v`), stair plan ghosts, by `tools/draw-buildings.mjs` |
| P3.6 | `buildings` | the hearth, an open ring of stones that is also the outdoor campfire: `furn.hearth` (cold), `furn.hearth.lit.1` to `.3` (flames, cycled by the page), `furn.hearth.banked` (embers), by `tools/draw-hearth.mjs` |
| P4.1 | `buildings` | wattle and daub walls (`build.wall-daub.<mask>`: the timber band in pale clay), by `tools/draw-buildings.mjs` |
| P4.7 | `buildings`, `items` | field furrows (`field.plan`, `.sown`, `.ripe.<crop>`, `.fallow`), `item.turnips`, `item.seed`, `item.cloak` |
| P4.5 | `buildings`, `items` | forge with bellows, anvil block, quench tub, smelter with bellows, charcoal clamp (2 by 2, `furn.clamp.<quarter>`, smoking `.lit.<quarter>` and `.<1-3>`), charcoal, four ingots, twelve tools, by `tools/draw-metal.mjs` (Bundle 3; the waterwheel and its power lines move to P5.11, V-085) |
| UI reskin | `ui` | Hearth and Page controls (docs/UI_STYLE.md): `ui.plank` bar strip, `ui.iron` and `ui.iron.on` button plates, `ui.oak-frame` page frame with iron corners, `ui.paper` texture; 9-slice, drawn at 1 art px to 2 CSS px |
| Phase 5 onward | later | animals, crops, sickbed, loom, creatures, dragon, fire, caravan |

Layout: `art/src/<sheet>/<name>.png` packed by `tools/pack-sheet` into `public/art/<sheet>.png` and `<sheet>.json`. Naming: `<category>.<name>[.<variant>][.<facing>][.<frame>]`, for example `tile.grass.2`, `wall.stone.n-e`, `person.dwarf.s.1`, `item.ingot.bronze`. Content refers to art only by name. The final art (V-034: AI-made images Morgan picks from, cleaned to the palette) replaces files in `art/src` with the same names and sizes; the packer rebuilds and nothing else changes. Every asset's source and licence go in `art/PROVENANCE.md` (SAFE-05).

Each phase file says which rows it needs. Asset sources and licences: `art/PROVENANCE.md`.

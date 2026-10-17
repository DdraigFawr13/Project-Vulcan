# Placeholder art plan

Flat-shaded pixel art in the muted palette, readable at 32 px, nothing drawn before its milestone needs it. Each sheet is shown to Morgan as an artifact before it lands.

| Milestone | Sheet | Contents |
| --- | --- | --- |
| P0.4 | `tiles-base` | grass, dirt, sand, gravel, stone floor, rock wall, darkness, shallow and deep water; selection and designation overlays |
| P1.1 to P1.3 | `tiles-world`, `sprites-nature` | biome floors, snow, ice, ore veins, aura, stairs, shaft, river autotile (47-tile blob); trees, bushes, boulders, herbs |
| P2.1, P2.4 | `sprites-people`, `items` | one body per race, 4 facings, 2 walk frames, tinted hair and clothing overlays, carried-item slot; icons for logs, stone, ores, ingots, food, tools, weapons, cloth, leather, herbs |
| P3.2 | `buildings` | autotiled walls by material, doors, floors, bed, table, chair, chest, shelf, carpentry bench |
| P4.5 | `workshops` | charcoal clamp, smelter, smithy, anvil, bellows, waterwheel (2 frames), power lines |
| Phase 5 onward | later | animals, crops, sickbed, loom, creatures, dragon, fire, caravan |

Layout: `art/src/<sheet>/<name>.png` packed by `tools/pack-sheet` into `public/art/<sheet>.png` and `<sheet>.json`. Naming: `<category>.<name>[.<variant>][.<facing>][.<frame>]`, for example `tile.grass.2`, `wall.stone.n-e`, `person.dvergar.s.1`, `item.ingot.bronze`. Content refers to art only by name. Morgan's art pass replaces files in `art/src` with the same names and sizes; the packer rebuilds and nothing else changes. Every asset's source and licence go in `art/PROVENANCE.md` (SAFE-05).

Each phase file says which rows it needs. Asset sources and licences: `art/PROVENANCE.md`.

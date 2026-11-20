# Phase 6W: The wide valley

A short phase between 6B and 6C that makes exploring a need, from Morgan's message of 2026-11-20 (seed button, bigger map, hidden ores, underground dangers) and their reply to the first numbers: "we definitely want to drive exploration as a requirement". Morgan took every recommendation on the design form https://claude.ai/artifact/BCdH5tdVBB7SFSNrTsVsqa and added two notes: "have them find interesting things as well on occasion", and bears den in the cliffs, not underground (V-192, V-193).

## Status

- [x] Design form answered, 2026-11-20 (V-192, V-193)
- [ ] Slice 1, a dice button for seeds (screens)
- [ ] Slice 2, the map drawn by chunk, with an overview picture (screens)
- [ ] Slice 3, a bigger, patchier valley (engine)
- [ ] Slice 4, known land and scouting (engine)
- [ ] Slice 5, trips, camps and finds (engine)
- [ ] Slice 6, the known map on screen (screens)
- [ ] Slice 7, hidden ores and prospecting (engine)
- [ ] 6W balance and review

## Why

Measured on main v6.144 (three game years, four seeds; tables on the form): 87 to 95% of colonist hours fall within 20 tiles of the green, 6 to 11% of the map is ever walked on, and trees, stone, water and an ore stain lie 1 to 10 tiles from the start. At 250 tiles the worker barely slows, but a slowed phone doubles screen memory and loses a third of its frames, because the render keeps whole-map layers.

## Design (VR-62)

- **Seed dice (Slice 1).** A dice button beside every seed box (title New game, Saves, picker) rolls a readable two-word seed from a content word list (`ember-hollow`). It replaces the picker's random letters; UI only (GAME-01).
- **Drawing by chunk (Slice 2).** The render keeps only the chunks near the camera as tile layers. Zoomed below the overview line, it shows one small picture of the map (a pixel or two per tile, refreshed from changed chunks). Memory and frame rate at 250 tiles must sit within 10% of today's 150 on the slowed-phone bench. This lands before the map grows.
- **The wide valley (Slice 3, V-013 amended).** The surface becomes 250 by 250, and the valley layout keeps the ranges' size, so the mountains are 60 to 100 tiles off. Resources are thin and patchy: the green keeps water and enough wood and stone for a first winter, and nothing else is placed near it. Veins lose their `near` clusters. Each valley is drawn rich in some goods and poor in others (`terrain.json` dials), and felled woods regrow slowly so near trees run out.
- **Known land (Slice 4, V-192).** The surface gets a `known` layer, like the levels below (V-030). A tile becomes known when a colonist sees it (within `sight` tiles on open ground, farther from a height) and stays known. Every search for wood, stone, food, game, herbs, sites and veins reads known tiles only. House size counts known material (amends V-055). When the known supply of a good runs under its stock level, or a metal is wanted with no known vein, the colony wants a scout. A **Scouting** row on the Work sheet sets how keen the colony is. Curious, restless and hardy colonists take it up first, and nobody is sent by name or to a tile (V-041). The scout picks the nearest unknown edge in the direction of the need. Setting out and each find write lines naming the need.
- **Trips and finds (Slice 5).** A trip longer than half a day takes food and a bedroll and camps out. Cold, a fall, wolves or losing the way make stories; others worry when someone is late. Finds are content entries found by walking near them: cave mouths, springs, old-growth groves, clay banks, fishing pools, lookouts, aura spots (Phase 7), and bear dens in cliff faces (Morgan's note). Now and then a scout finds something odd: a content table of small curios, each a tale and some a memory (Morgan's q1 note). A pedlar or stranger may name a direction ("copper in the east hills"), which gives a tale but no tile. Old-world ruins from the Story Generator history come later (f3).
- **The known map on screen (Slice 6).** Unknown surface draws faded, not black. Finds get a small marker and a tile-sheet line saying who found them and when. The Scouting row sits on the Work sheet, and the ledger shows trips and camps.
- **Hidden ores (Slice 7, amends V-087 and V-030).** There are no stains on the ground. Underground, a vein stays dark like any unknown rock until a tunnel passes beside it. Search tunnels start from known caves or water. In the mountains, a prospector walking beside a rock face may spot a seam in it. Odds come from mining skill, luck (a novice can stumble on one) and the vein's rocks (`features.json`). The find writes a line with who, where and what. Ore in a face is reached by a shaft beside it until 6F's adits; ore below is tunnelled to.
- **Underground dangers (design only, V-193).** These are not built in 6W. Bad air, getting lost when the light runs out, and miners' beliefs (knockers, charms, a shrine at the shaft head) join 6F's cave-ins and mine floods. Cave beasts and something old that wakes on the deepest level come with Phase 8's fighting, and bears stay in cliff dens on the surface. Heat near obsidian comes later.

Levers (V-041): the Scouting row and the stock levels behind each need; the player never picks a tile, trip or person.

## Slices

Each slice is built in a fresh thread after its mock-up form is answered (VR-74). Slice 1 can go at any time. Slice 2 lands before Slice 3, and Slices 4 to 7 follow in order. Slice 7 may run beside 5 or 6. A slice over 1,200 lines splits (VR-58). Multi-seed tables live in mock-up and balance scripts, never tests.

### Slice 1: a dice button for seeds

Mock-up: UI. Done when: every seed box has the dice rolling a two-word seed from content; `npm run test:browser` passes.

- Reading list: `docs/UI_STYLE.md`; `src/ui/MODULE.md`

### Slice 2: the map drawn by chunk

Mock-up: UI (the overview at 390 px). Done when: the slowed-phone bench (390 px, CPU 4x) at 250 tiles is within 10% of 150 for memory and frames, at both normal zoom and zoomed out, measured on a production build.

- Reading list: `docs/DECISIONS.md` V-013 V-030 V-094; `src/render/MODULE.md`; `src/worker/MODULE.md`; `docs/UI_STYLE.md`

### Slice 3: a bigger, patchier valley

Mock-up: Engine (a four-seed table of the nearest tree, stone, water, mountain and each ore, with map pictures). Done when: `npm run map:stats` passes on every seed at 250 tiles, the map tests' done-whens still hold, and the save of a fresh world is under 2 MB.

- Reading list: `docs/DECISIONS.md` V-013 V-014 V-083 V-087; `src/engine/map/MODULE.md`; `src/engine/wild/MODULE.md`

### Slice 4: known land and scouting

Mock-up: Engine (three years on four seeds: share of the map known, hours beyond 40 tiles, scouting trips and the need behind each). Done when: a test shows a colony whose known wood runs out sends a scout who makes new wood known, with the lines tracing to the stock level, and that no search reads an unknown tile.

- Reading list: `docs/DECISIONS.md` V-041 V-055 V-083 V-174; `src/engine/map/MODULE.md`; `src/engine/people/MODULE.md`; `src/engine/paths/MODULE.md`; `src/engine/goods/MODULE.md`

### Slice 5: trips, camps and finds

Mock-up: Engine (sample trip, camp and find lines on two seeds). Done when: a test shows a trip over half a day camps with a bedroll and food, and a find writes a line and a tale.

- Reading list: `docs/DECISIONS.md` V-155 V-169 V-192; `src/engine/tales/MODULE.md`; `src/engine/wild/MODULE.md`; `src/engine/map/MODULE.md`

### Slice 6: the known map on screen

Mock-up: UI. Done when: unknown ground shows faded at 390 px, finds have markers and tile-sheet lines, the Scouting row works while paused, and `npm run test:browser` passes.

- Reading list: `docs/UI_STYLE.md`; `src/render/MODULE.md`; `src/ui/MODULE.md`; `src/worker/MODULE.md`

### Slice 7: hidden ores and prospecting

Mock-up: Engine (five years on four seeds: the first ore found, where, by whom, and the days to the first ingot). Done when: no stain layer remains; a test shows an unseen vein stays unknown until a tunnel passes beside it; a test shows a prospector beside a rock face may spot a seam, with the line.

- Reading list: `docs/DECISIONS.md` V-030 V-087 V-094 V-193; `src/engine/mine/MODULE.md`; `src/engine/map/MODULE.md`; `src/render/MODULE.md`

### 6W balance and review

The `balance-check` skill over five years on four seeds, then the `phase-review` skill. Done when: on every seed, colonists walk on at least a quarter of the map by year 3, and at least one seed's colony struggles for want of something it has not yet found, with its line (failure is fine; the colonies should differ).

## Phase done (playtest)

Roll a dice seed on a phone. The valley starts mostly faded; a scout goes out when the near wood runs short and finds a grove, and a later trip camps in the hills and finds a cave mouth and a bear's den. Copper is wanted and unfound until a prospector spots it in a limestone face 80 tiles off. Zoomed out, it stays smooth.

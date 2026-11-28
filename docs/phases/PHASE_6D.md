# Phase 6D: The growing town

A short phase after 6C and before magic (Phase 7): the town gains a plan as it grows. Stages from camp to market town, a hall for the elder, the moot and the lord, a market on the green, homes that line up into streets, works that answer the strains of a bigger place, and a town that can shrink and fall to ruin. From Morgan's message of 2026-11-20 (a hall for meetings and the lord, a marketplace in front of it, streets and works that change with size). Morgan took every recommendation on the design form https://claude.ai/artifact/XJoia4VWd2cYTvzRYCWVrm (V-244). The spec's own forks are on the spec form (V-245).

It also carries three problems found since: the town layout does not work (Morgan, 2026-11-23); far workers walk most of the day, anvil's haulers walking to a clay bank 100 to 145 steps out for every load (V-231's leftovers); and grown-ups stand idle 14 to 59% of their work hours, 99.9% of it "looked for work, found none" (time-use audit #214, carried here by V-243 q8).

## Status

- [x] Design form answered, 2026-11-20 (V-244)
- [ ] Spec form answered (V-245)
- [ ] Slice 1, stages and streets (engine)
- [ ] Slice 2, work by its ground (engine)
- [ ] Slice 3, the hall and the moot (engine)
- [ ] Slice 4, the town on screen, part 1 (screens)
- [ ] Slice 5, growing pains (engine)
- [ ] Slice 6, the pedlar and the market (engine)
- [ ] Slice 7, names, ruin and the fall (engine)
- [ ] Slice 8, the town on screen, part 2 (screens)
- [ ] 6D balance and review

## The rule all of this keeps (V-041, V-049)

The player never places a building or marks a tile. The town grows because colonists feel a need (the hall is too small, the well has a queue, a lane is dark) and choose where to answer it. Levers stay the ones the player knows: the Build sheet's rows, stock levels, priorities and laws, plus one new law, Town ways. Every new piece comes with a line saying who wanted it and why, and the Build sheet shows the strain behind each want.

## Design (VR-62)

Detail, with what each system owns, reads, fails on and tests: `docs/GROWING_TOWN.md`.

- **Stages and streets (Slice 1).** A `town` system holds the stage: Camp, Hamlet, Village, Market town, each reached by what stands and who lives there (content `town.json`). A stage opens wants, never builds. From the stage the spec form q2 picks, siting a home adds a door on a road or lane and a wall beside a neighbour, so homes line up; with no road-side plot left the colony plans a lane; the most walked road from the home road to the green becomes the High Street. The Town ways law (Wherever suits / Along the lanes / Set out from the square) is weighed by builders like every law.
- **Work by its ground (Slice 2).** Trades gather in quarters: noisy and smelly ones at the edge, crafts near those who work them, and work whose ground is far (clay, spec form q1) set up by that ground, so only finished goods walk to town.
- **The hall and the moot (Slice 3).** The hall grows in three steps (first house, an added room when the moot overflows, a built hall on the edge of the green facing it). The moot meets weekly (spec form q4): the elder vote is counted there, grudges and petitions are heard, a changed law is talked over; who stays away and why is a line. The elder's chair (a heard grudge fades faster); the charter and chronicle on the hall's shelf. Slack-season works (spec form q5).
- **Growing pains (Slice 5).** Strains colonists feel bring works: a queue at the well, a second well; the midden's smell, cesspits then a drain; thatch too close, a gap between rows; strays in a field, a pound; dark lanes, lamps at the hall door and the market cross; a crossing walked many times a day, stepping stones then a bridge. Each want cites its strain; the player's Build rows decide the order.
- **The pedlar and the market (Slice 6).** First a pedlar's pitch on the green a few times a year, swapping what the store holds above the stock levels for what the colony lacks. Then the lord's market right (a new favour ladder step): a market day, more carts, travellers who ask to stay (answered by the Strangers law), the green paved as the square with stalls and a market cross where the stocks stand. Coin waits for Phase 9.
- **Names, ruin and the fall (Slice 7).** The town names itself at Village from its own story (spec form q3); lanes take names from what is on them. A town can shrink: the stage drops back with a line, empty homes stand cold then fall to ruin (a place remembered in tales), a market right taken back empties the square, a hall nobody meets in goes quiet.
- **On screen (Slices 4 and 8).** The stage under the colony's name and in recaps; the Town ways row; the Build sheet's new rows with their strains; the hall page (who came to the moot, who stayed away, why); street names on the map; the market page; art for the hall, square, stalls, cross, lanes, wells, cesspits, pound, lamps, stepping stones, bridge and ruins.

Levers (V-041): the Town ways law (new, Laws sheet); the Build sheet's rows (Hall, Wells, Lanes and works, Market, each 1 to 4); stock levels (what the pedlar may take); the Strangers, Punishment and Feasts laws; trade priorities. Nobody is picked to go to the moot, trade or build.

Left out on purpose: drawing the plan or placing plots (breaks V-041), a fixed grid of plots, colonists' own stalls selling to each other (V-148), coin and prices (Phase 9). Later: beating the bounds, a bell, old lanes against new (form x6 to x8).

## Slices

Each slice gets a mock-up form answered by Morgan, then a fresh build thread (VR-74). One lane: every engine slice moves where people walk, so they build one after another. A slice over 1,200 lines splits (VR-58). Multi-seed tables live in mock-up and balance scripts, never tests.

### Slice 1: stages and streets

Mock-up: Engine (four years on the six balance valleys: stage reached and when, homes on a road, gaps between homes, lanes and High Street laid, Town ways answers; layout pictures from `npm run map:render`). Done when: a home sited at the street stage has its door on a road or lane, with its line; the stage line cites what it waited on; Town ways answers are law events; `npm run check` green.

- Reading list: `docs/DECISIONS.md` V-041 V-049 V-050 V-054 V-124 V-244; `src/engine/build/MODULE.md`; `src/engine/law/MODULE.md`; `docs/GROWING_TOWN.md`

### Slice 2: work by its ground

Mock-up: Engine (anvil/1 and two more valleys, three years: haul walking, the clay haul's steps a load, where the kiln and yards stand). Done when: a far clay bank gets its yard with a line, and anvil/1's hauling walk falls against the 6C baseline.

- Reading list: `docs/DECISIONS.md` V-096 V-129 V-230 V-231; `src/engine/land/MODULE.md`; `src/engine/build/MODULE.md`; `docs/TOOLS_AND_SMITHY.md` (siting); `docs/GROWING_TOWN.md`

### Slice 3: the hall and the moot

Mock-up: Engine (three years on four valleys: moots held, who came, who stayed away and why, petitions heard, the hall's steps). Done when: the elder vote is counted at a moot with a line; someone with a grudge may stay home, with a line; the hall want cites the moot's overflow.

- Reading list: `docs/DECISIONS.md` V-119 V-146 V-158 V-159 V-160; `src/engine/colony/MODULE.md`; `docs/STRANGERS_AND_HOMES.md` (the hall); `docs/GROWING_TOWN.md`

### Slice 4: the town on screen, part 1

Mock-up: UI at 390 px (the stage under the colony's name, Town ways row, Build sheet Hall and Lanes rows, the hall page, lanes and the hall drawn). Done when: the Town ways law is set while paused and `npm run test:browser` passes with the new checks in their own spec.

- Reading list: `docs/UI_STYLE.md`; `src/ui/MODULE.md`; `src/worker/MODULE.md`; `src/render/MODULE.md`; `docs/ART.md`

### Slice 5: growing pains

Mock-up: Engine (six years on the balance valleys: each strain felt, what it brought and when). Done when: a well queue brings a second well whose line cites the minutes waited; every new work's want names its strain. Over 1,200 lines it splits: wells, cesspits and lamps; then crossings, the pound and the gap between rows.

- Reading list: `docs/DECISIONS.md` V-072 V-131 V-244; `src/engine/build/MODULE.md`; `src/engine/lamp/MODULE.md`; `src/engine/paths/MODULE.md`; `docs/GROWING_TOWN.md`

### Slice 6: the pedlar and the market

Mock-up: Engine (six years on four valleys: pedlars, what was swapped, the market right, market days, settlers). Done when: a pedlar swaps only above the stock level, with a line naming both sides; the market right is a favour ladder step.

- Reading list: `docs/DECISIONS.md` V-148 V-173 V-236 V-242; `src/engine/lord/MODULE.md`; `src/engine/goods/MODULE.md`; `src/engine/band/MODULE.md` (strangers); `docs/LORD_AND_ASKS.md`; `docs/GROWING_TOWN.md`

### Slice 7: names, ruin and the fall

Mock-up: Engine (ten years on four valleys, one of them made to shrink: names, stage drops, ruins). Done when: a stage drop cites the deaths or leavings behind it; an empty home turns to ruin with a line and a tale.

- Reading list: `docs/DECISIONS.md` V-242 V-244; `src/engine/tales/MODULE.md`; `src/engine/colony/MODULE.md`; `docs/GROWING_TOWN.md`

### Slice 8: the town on screen, part 2

Mock-up: UI at 390 px (strains on the Build sheet, the market page, street names, art beside its neighbours). Done when: every new building draws, `npm run test:browser` passes.

- Reading list: `docs/UI_STYLE.md`; `docs/ART.md`; `src/ui/MODULE.md`; `src/render/MODULE.md`

### 6D balance and review

Three years on the six balance valleys (V-243) with `npm run timeuse` beside the counts, against the 6C baseline (spec form q6). Balance aims for divergent, story-rich runs; a town that never earns a market, or falls back to a hamlet, is a story (north star, 2026-11-20). Then the `phase-review` skill.

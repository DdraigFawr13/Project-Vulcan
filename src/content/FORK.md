# Content fork

Vulcan's content started as a copy of the Story Generator's (DECISIONS V-008) and is Vulcan's own from here: edit `data/` directly and log each deliberate change below. The table is the copy as made; `tools/fork-content.mjs` writes it.

<!-- fork:start (written by tools/fork-content.mjs) -->
Source: DdraigFawr13/Story-Generator at `7866aea6e529ea486cef39083c30726f72d2c5cd` (2026-10-17).

| File | From | Entries at fork |
| --- | --- | --- |
| calendar.json | src/engine/core/clock.ts | 5 |
| tiers.json | src/engine/people/tiers.ts | 6 |
| biomes.json | src/content/biomes.ts | 2 |
| resources.json | src/content/resources.ts | 15 |
| weather.json | src/content/world.ts | 4 |
| races.json | src/content/races.ts | 8 |
| cultures.json | src/content/cultures.ts | 14 |
| names.json | src/content/names.ts | 5 |
| schools.json | src/content/abilities.ts | 6 |
| abilities.json | src/content/abilities.ts | 38 |
| awakenings.json | src/content/awakenings.ts | 2 |
| lore.json | src/content/lore.ts | 13 |
| faiths.json | src/content/faiths.ts | 19 |
| great-works.json | src/content/great-works.ts | 19 |
| creatures.json | src/content/creatures.ts | 9 |
| dragons.json | src/content/dragons.ts | 28 |
| items.json | src/content/items.ts | 22 |
| needs.json | src/content/life.ts | 8 |
| traits.json | src/content/life.ts | 10 |
| memories.json | src/content/life.ts and five other files | 49 |
| jobs.json | src/content/jobs.ts | 13 |
| conditions.json | src/content/health.ts | 17 |
| ailments.json | src/content/health.ts | 2 |
| diseases.json | src/content/diseases.ts | 3 |
<!-- fork:end -->

Not forked: the Story Generator's history simulation (234 event templates, chronicle and play-by-play text, history pacing, settlement, site, politics, society, family, threat and steward tuning, notables, biographies, battles, annals, map layers). Since P1.6 (V-031) Vulcan runs that engine as the `story-generator` package, pinned by commit in package.json, with its own tables for all of these; `src/engine/region/story.ts` lays Vulcan's races and cultures over the package's, so edits to those two files here reach the world's history too. Code comments in the source files don't carry into JSON; read them in the source file at the commit above.

## Changes since the fork

- 2026-10-17 · P0.3 · `events.json` added, Vulcan's own and not forked: one ledger template per event type (`world.begun`, `command.applied`, `command.refused` and the calendar's day, month and season lines). `tools/fork-content.mjs` writes only the forked files, so it never touches this one.
- 2026-10-17 · Morgan · Races are plain fantasy races: ids `tylwyth`, `dvergar` and `cewri` became `elf`, `dwarf` and `giant` (names were already Elf, Dwarf, Giant) everywhere they are referenced. The Fomori race is gone; the Fomori culture is now orc sea-reavers (its nearest race in stats). Culture ids and names are unchanged; the Gwyllion summary now says wild elves. Races: human, elf, dwarf, orc, giant, halfling, goblin.
- 2026-10-17 · Morgan · Eight generic fantasy creatures added beside the Welsh ones: giant spider brood, harpy flock, ogre (beasts); troll, griffin, basilisk, manticore (great); hydra (legendary). Their numbers are first guesses placed between forked creatures of similar danger (beasts 5 to 10, great beasts 45 to 90, the hydra 250) and are untuned; the harpy flock keeps to land biomes because water biomes have no wildness.
- 2026-10-17 · Morgan · Shared place-name syllables (`names.json` starts, middles, ends) now pool every culture's place syllables, not only the Welsh and Norse set: 299 starts, 73 middles, 199 ends.
- 2026-10-17 · P1.3 · `items.json` gains the underground's yields: copper, tin, iron, gold and silver ore, sulphur, rough gems and obsidian (tin was missing from the fork, and bronze needs it). Their `per` copies the forked generic `ore` and is untuned until Phase 4.

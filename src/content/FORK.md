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

Not forked: the Story Generator's history simulation (234 event templates, chronicle and play-by-play text, history pacing, settlement, site, politics, society, family, threat and steward tuning, notables, biographies, battles, annals, map layers). It drives a 250-year history engine Vulcan doesn't have; the Phase 9 worldgen and history port (V-017) can fork it then. Code comments in the source files don't carry into JSON; read them in the source file at the commit above.

## Changes since the fork

- 2026-10-17 · Morgan · Races are plain fantasy races: ids `tylwyth`, `dvergar` and `cewri` became `elf`, `dwarf` and `giant` (names were already Elf, Dwarf, Giant) everywhere they are referenced. The Fomori race is gone; the Fomori culture is now orc sea-reavers (its nearest race in stats). Culture ids and names are unchanged. Races: human, elf, dwarf, orc, giant, halfling, goblin.
- 2026-10-17 · Morgan · Eight generic fantasy creatures added beside the Welsh ones: giant spider brood, harpy flock, ogre (beasts); troll, griffin, basilisk, manticore (great); hydra (legendary). Their numbers sit inside the range of the forked beasts of the same tier and are untuned.
- 2026-10-17 · Morgan · Shared place-name syllables (`names.json` starts, middles, ends) now pool every culture's place syllables, not only the Welsh and Norse set: 299 starts, 73 middles, 199 ends.

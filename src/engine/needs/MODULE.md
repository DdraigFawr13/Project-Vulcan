# needs

Needs and mood (P2.2): food, rest, warmth and recreation, each 0 to life.json `scale`, and the mood they make.

- **Public API:** `index.ts`: `needsSystem`, `NEEDS_TABLES`, `needOf(world, person, need)`, `moodOf(world, person)`, `changeNeed(content, row, by)` (held between 0 and the scale), `crossed(ctx, person, row, def)` (writes the line when a need crosses its warning line; the mind calls it after a meal).
- **Hourly:** each need falls its `fall`, except: rest rises `sleep.bedroll` (on their own laid-out bedroll) or `sleep.ground` while asleep (`doing: sleep` and not walking); warmth rises `warmth.rise` while the felt temperature is at least `warmth.comfort`, else falls `perDegree` for each degree short (felt: the tile's temperature (weather `tileTemperature`) on the surface, `warmth.below` underground, `warmth.bedroll` warmer asleep in one); recreation rises `relax.gain` while relaxing, `relax.company` more with someone else relaxing within `relax.reach` tiles. Eating happens in the people's mind (people/mind.ts), on the minute.
- **Mood:** the needs' mean weighted by `weight`, worded by `mood` (first whose `at` it reaches). A better word must be earned by `again` over its threshold, so it does not flicker.
- **Events:** emits `need.low` when a need goes under `low` (citing the weather spell for warmth, else the need's last line, at first the arrival), `need.met` when it is back to `low + again` (citing the low line), and `mood.changed` (way, word) citing the lowest need's last line. Each has the person as actor.
- **State owned:** tables `need` (person, need, value, low (1 while under the line), line) and `mood` (person, value, word, line), laid out in `init` after the people. No system state.
- **Invariants:** whole numbers only; reads the people's `doing` and `path` and the weather's `temp` and `spell`, writes no other system's rows.
- **Tests:** `needs.test.ts` (a week on three seeds keeps every need above its line with no warning lines, rations go down, the band sleeps on its bedrolls; hunger and cold write lines citing the arrival and the spell, and the mood falls).

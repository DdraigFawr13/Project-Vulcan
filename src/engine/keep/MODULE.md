# keep

Food spoiling by place and warmth (P5.12).

- **Public API:** `index.ts`: `keepSystem` (daily, after the flock), `KEEP_TABLES`, `dailyOf(content, kind)` (an item's own loss a day: `spoilPerDay`, else `spoilPerMonth` over 28 days; 0 for what is not food), `rateOf(world, content, item, floors)` (a stack's loss a day where it lies now), `placeOf(world, item, floors)` (`open`, `store` (home store), `house` (a built house's floor), `walled` (a store of a kind), `below` (under ground)), `floorsOf(world, content)` (house floor tiles, worked out once per call: never look rooms up per item).
- **Daily (`spoil.ts`):** each stack lying on a tile (not carried) owes `count × rate` in millionths plus its `rot` (goods item field); whole units are taken (goods `takeFrom`), the rest stays in `rot`. Rate = the item's own × `keep.place[place]` × the first `keep.warmth` step its temperature (tile plus fire heat; below ground `keep.below`) is under; a cooked meal keeps at its own rate anywhere. Each loss adds to this week's `spoilage` row for its store (a store of a kind's id, 0 the home store, -1 the open).
- **Weekly (`system.ts`):** every `keep.week` days, one `keep.spoiled` line per store that lost food (place, count, what: "5 turnips and 2 fish", most first), citing the store's built line (the home store's set-up line); food lost in the open is one `keep.spoiledOpen` line citing the first stack's line. Then the week's rows are cleared.
- **Read by others:** people `haul.ts` carries food that spoils past its plate (the open spoils twice as fast) and carries what loses at least `keep.haulFirst` a day as if `keep.haulBonus` tiles nearer. The worker shows each food stack's loss a month where it lies and a store's loss this week and the three before.
- **State owned:** table `spoilage` (store, kind, count, made). No system state.
- **Invariants:** a stack never loses more than it holds; `rot` stays under a million; no RNG.
- **Tests:** `keep.test.ts` (open faster than walled, walled faster than below, frost slower, a meal at its own rate; whole units and the rest carried; one line a week per store naming what spoiled and citing the store).

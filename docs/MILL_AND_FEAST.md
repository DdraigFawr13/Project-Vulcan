# The mill and harvest home

5B Bundle 4 (P5.11, proposal P1; V-041, V-133, V-150). Engine code in `src/engine/build/mill.ts`, `build/feast.ts`, `people/mill.ts` and `people/feast.ts`; content `buildings.mill`. Nobody is ordered: the levers are the Mill heading's Miller and Baker rows, the Flour plate, and one Send back for the mill.

## Build side

`mill.ts`, content `buildings.mill`, tables `mill` (x, y, w, h, wheel, state, line, built, why, sent, stones, stood) and `grind` (day, quern, mill minutes; `noteGrind`, `quernToday`). Once grain is in store a `quern` piece is planned by the hall's hearth, else any room's (`build.quernPlanned`). Daily: when the quern took over `want` minutes a day (mean of `days`), a mill is sited on the running water within `near` of the green nearest the granary (`build.millNeeded` with the reason; walls by `placeEdge`, millstones inside, wheel tile in the water, trees on the way marked) and `build.millBuilt` when it stands. `turning(world, mill)`: built and its wheel's water not frozen; `mill.stood` / `mill.turns` follow the ice. Once flour stood at its plate on `bake.oven.days` days, an `oven` piece is planned 2 to 4 tiles from the mill's door (`build.ovenPlanned`). `sendBack {mill}` once, before building begins. `feast.ts`, table `feast` (line, year, state, start, there, eaten): `finishReaping` calls the year's harvest home when no field is sown or ripe and no crop can still be sown this year (`lastOfYear`, `callFeast`); people/feast.ts holds it. API: `millOf`, `millsOf`, `turning`, `noteGrind`, `quernToday`, `feastOf`.

## People side

`mill.ts`, the Mill heading's Miller (`mill`) and Baker (`bake`, the cooking skill) rows after Cook; content `buildings.mill`. Nobody is ordered. While flour (with what others are grinding) is under its plate, a free able person fetches a batch of grain (`from`) and grinds it at the mill's millstones while `turning`, else at a quern while a whole batch fits in its `quern.most` minutes today (one person at a piece at a time) (`work.tookUpMilling`, `food.ground`). While bread is under `bake.perPerson` a person, a free able person fetches flour and a firewood and bakes at the oven, else the nearest built hearth (`work.tookUpBaking`, `food.baked`). Bread counts toward cooking's meals. `feast.ts` `feasting`: once the harvest home is called, everyone not starving goes after work to the hall (else round the first hearth); when all who can come are there, or a quarter hour before bed with nobody still walking to it (else up to an hour past bed, `HARD_STOP`; `mind.ts` keeps their evening open), each eats the best food (the most filling cooked food, then the most filling food), one `hall.feast` line and a shared memory.

## Rivers freeze too (V-150)

Streams and the river count frost like lakes, with their own dials (`seasons.ice.stream`, `ice.river`); springs never freeze. When half the river's tiles are frozen, `weather.riverFrozen` (once), then `weather.riverThawed` when none are. A mill's wheel stands while its own tile is frozen.

## Tests

`src/engine/build/mill.test.ts` (slow tier, one anvil run of about 200 days): quern and mill unordered, the wheel in running water beside a side, one send-back then refusal, the harvest home citing the year's last harvest with everyone there, the mill grinding and an oven planned, and a frozen wheel sending grinding back to the quern. `src/engine/map/map.test.ts`: water freezes in a year on every seed, never a spring.

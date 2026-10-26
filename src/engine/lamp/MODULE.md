# lamp

Daylight by month, and candlelight after dusk (P5.13).

- **Public API:** `index.ts`: `daylightAt(content, tick)` (first light and dusk, minutes of the day), `isDark(content, tick)`, `lightClass(content, job)` (`out`, `dark`, `dim` or `candle`), `lit(ctx, person, job)` (whether they may work on this minute; lights and burns the room's candle), `canLight(world, content, job)` (for taking work up after dusk), `lightsOf`, `litRooms(world)` (a tile of each room with a candle burning, for the map), `lampSystem`, `LAMP_TABLES`.
- **Daylight:** content `lamp.daylight` gives first light and dusk at the middle of each month; each day blends linearly towards the neighbouring month's.
- **Light classes (content `lamp`):** `dark` work goes on after dusk (tending, the flock's folding, the smith at a forge that lights itself); `dim` work is done at a fire, whose own light serves (cooking, healing); `candle` work needs a candle burning in the room of its workplace (`at`: the furniture kind, the bench for carpentry); anything else is outdoor work and stops at dusk. Below ground is always dark, so nothing there changes. people `jobs.ts` asks `lit` and `canLight`; `mind.ts` gives free time to someone with no work they can do in the dark.
- **Candles:** a worker who stands in an unlit workplace room after dusk lights a candle from the store (the first kind in `lamp.candles` there is: tallow before wax), with a `lamp.lit` line citing their taking up and the Candles plate. It burns one minute for each minute someone works in the room, however many, until its `minutes` are spent. With none in store, or a workplace in no room, `lamp.dark` is written once a day for the room and they leave off, and look for other work they can do in the dark. The walk to the store for the candle is not modelled.
- **State owned:** table `light` (room key: its lowest tile index, or minus the workplace's id when it stands in no room; kind, left, used, line, dark). No system state.
- **Events:** `lamp.lit`, `lamp.dark`. Daily, spent rows with no recent went-dark line are dropped.
- **Invariants:** reads build (rooms, pieces), goods (store, plates); no RNG.
- **Tests:** `lamp.test.ts` (the lit-workshop test: a lit workshop works after dusk, an unlit one stops with a line; daylight blends by day).

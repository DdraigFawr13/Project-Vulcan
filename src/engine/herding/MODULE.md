# herding

The people's side of the wild valley and the flock (P5.4a, P5.4b, Phase 5 Bundle 3, V-041, V-109, V-111): hunting, fishing, tracks, fighting or fleeing the pack, herding and the watch fire. Uses `band` for walking, skills and priorities; the animals themselves are `wild` and `flock`.

- **Public API:** `index.ts`: `attacksMinute`, `endHunt`, `fishing`, `herdWatch`, `herding`, `hunting`, `isWatchFire`, `lateUntil`, `predatorRung`, `syncLures`, `takeUpFishing`, `takeUpHerding`, `takeUpHunting`, `tracksMinute`, `watching`.
- **The wild valley, the people's side (P5.4a):** hunting, fishing, tracks and the midden's draw: see `docs/WILD_AND_FLOCK.md`.
- **Fight or flee (V-109, V-111):** see `docs/WILD_AND_FLOCK.md`.
- **Herding (Phase 5 Bundle 3, V-041):** `herd.ts`, `herdtask.ts`, the Herding row: `docs/HERDING.md`.
- **The watch fire (Bundle 6):** `watch.ts`, from `herd.ts` `herdWatch`: within `flock.watch.nights` of a pack sign the best-placed fit herder sits up by a fire at the fold (`flock.watchLit`, wild `setWards`), sleeping late after (`lateUntil` in `mind.ts`); too little firewood or nobody gives `flock.noWatch`.
- **Events:** `work.tookUp*` for hunting, fishing and herding; the hunt, fight, flee and watch lines in content `events.json` (see the docs above).
- **State owned:** the person fields its jobs use (`job` `hunt`, `fish`, `herd`, `task`, `target`); no tables of its own.
- **Tests:** `wild.test.ts` (slow tier: hunting, fishing, standing or fleeing, the pack's attack, tracks, the midden); `herd.test.ts` (slow tier); `watch.test.ts` (a watch turns the pack).

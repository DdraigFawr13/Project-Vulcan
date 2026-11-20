# Phase 6T: Time and recaps

More control over the pace of play: a speed list up to 6×, jumps of a month, a season or a year for everyone, a sheet that says what pauses or slows play, and season and year recaps that tell the colony's story. Morgan's request on 2026-11-20 and the answers on the form (https://claude.ai/artifact/RETz7a9XZi6qU77p3ghhMu, saved as `answers`): every recommendation except two. Question 1 became a speed drop-down up to 6×, and question 5 became Slow drops to 1× and stays there (V-191). This runs beside 6B. It is not part of 6B's bundles.

## Status

- [x] Spec, 2026-11-20 (V-191)
- [x] Slice 1: speeds, jumps and what stops play (worker, content, screen), 2026-11-20; anvil year 1: 8 Next event stops with the defaults (4 Pause, 4 Slow)
- [ ] Slice 2: the chronicle (engine)
- [ ] Slice 3: recaps on screen

## Design (VR-62)

- **Speeds.** `Speed` runs from 0 to 6. In ticks a second: 1× 10, 2× 30, 3× 100, 4× 200, 5× 400, 6× 800. A year at each speed takes about 806, 269, 81, 40, 20 and 10 minutes (483,840 ticks in a year). A device that can't keep up runs as fast as it can, as today (`MAX_CATCH_UP_MS`). The bar keeps the pause plate and has one speed plate that shows the current speed ("3× ▾"). Tapping it opens a list of the six speeds, each a 42 px plate. Keys 1 to 6 still set the speed directly. On a phone the bar becomes ❚❚, speed ▾, ▸▸▾, Ledger, ⋯, so Ledger keeps its word label.
- **Jumps (amends V-082).** ▸▸ opens a Jump ahead tray under the bar (mock-up picture 1) with four large plates: Next event, A month, A season, A year. Each plate names where it lands, which is the first day of the next month, season or year at 00:00. Jumps leave test mode and work in normal play. Every tick still runs on the way. While a jump runs, the alert line shows a progress bar with where it lands and a Stop plate (picture 2). Stop leaves the game paused. A jump ends early, paused, on any line whose kind is set to Pause. Next event is today's skip, but it ends on Pause or Slow kinds rather than on every notable line. On a desktop the four jumps sit in the bar's tray just the same.
- **What stops play.** Each notable event in `events.json` gets a `stop` kind, a content field, so a new event joins a kind with no code: `death` (died, festered, grave), `attack`, `food` (food gone, hungry winter), `family` (born, wed), `comings` (stranger, left, sent away, came back), `sickness`, `quarrel` (defy, faction, petition), `danger` (pack at the edge, blight, frost-killed), `mood` (needs, moods), `works` (built, sited, waiting) and `world` (seasons, weather, firsts). The What stops play sheet (from the tray, and from ⋯) shows one row per kind with Pause, Slow and Note. Pause stops the game. Slow drops to 1× and stays there (V-191). Note only adds the line to the alerts. The defaults are Pause for death, attack and food; Slow for family, comings, sickness, quarrel and danger; Note for everything else. At 1× to 6×, play now reacts to these settings; today it never pauses. The settings are kept on the device (`localStorage`, as `dawn.ts` does), so they hold for every game. The page sends them to the worker as a setting, not a command (V-041), because they change how time runs, not what colonists do.
- **The chronicle (engine).** A new `annals` system writes one recap at each season's turn and one at the year's turn, whether recaps are switched on or off. Each recap is kept in a save table, so the same seed always gives the same recap. A recap is built from three things: the season's lines of importance 3, plus the notable lines of kinds other than `mood`; the tales held at the season's end; and counts of people, homes, stores and levels. Each line it uses has its text kept, so the recap outlives sealed days (V-177). A season recap has a title taken from its most important line and sections in a fixed order: who came, who we lost, births and weddings, what was built, troubles, who leads, then the numbers, then what people say. Each section is one short paragraph made from content templates in `annals.json`, and lines of the same kind join into one sentence ("Two stone axes broke"). Every sentence cites the line it came from, so "why?" works. The year recap gives each season a paragraph, then the year in numbers (came, died, born, homes), what people say and whose year it was (the person named in the most kept lines). A plain chronicle tells what happened. Its last section quotes tales as people hold them now, bent or not. No LLM is involved (GAME-03).
- **Recaps on screen.** With season recaps on, a season's turn pauses the game and opens the recap page (picture 3): a paper page with Turn off recaps and Carry on, where Carry on resumes at the earlier speed. The year recap replaces winter's season recap. With recaps on, a year jump shows only the year recap when it lands, and that season's recaps go straight to the Chronicle. Season recaps and year recaps have separate switches on the What stops play sheet; both are on by default. The Ledger gets a Chronicle tab with every recap, newest first. On the night a recap opens, the dawn page holds back.

Levers (V-041): none are added. Speed, jumps and stop settings are the player's clock, not orders, and recaps only show.

## Milestones

Slices 1 and 2 build in parallel, each in a fresh thread (Morgan 2026-11-20 15:24). Slice 3 starts after both have merged. A slice estimated at over 1,200 lines splits into an engine PR and a screen PR (VR-58). The mock-ups are already approved on the form. Each PR shows a 390 px screenshot of every changed screen (VER-06).

### Slice 1: speeds, jumps and what stops play

Done when: the speed list sets 1× to 6× and keys 1 to 6 work; a jump of each span lands on the first day of the next one, with no test mode; a jump stops early on a planted death and leaves the game paused; Slow drops to 1× and stays; on anvil's year 1, Next event stops 11 times or fewer with the default settings (measured today: 3 Pause and 8 Slow, against 696 notable lines); the browser test covers the tray, the progress bar, Stop and the sheet at 390 px with no overflow; every notable event has a `stop` kind, checked by content validation.

- Reading list: `docs/DECISIONS.md` V-026 V-041 V-082 V-191; `src/worker/MODULE.md`; `src/worker/pace.ts`; `src/ui/MODULE.md`; `src/ui/hud.ts`

### Slice 2: the chronicle (engine)

Done when: a recap is written at each season's turn and at the year's turn on four seeds (anvil, smoke, tallow, ledger-1). The PR shows one year of recap text from each seed. Every sentence cites a ledger line. The recaps survive a save and load unchanged. The determinism test covers the recap table. Season turns add no more than 5 % to check:full.

- Reading list: `docs/DECISIONS.md` V-036 V-155 V-177 V-191; `src/engine/log/MODULE.md`; `src/engine/tales/MODULE.md`; `src/engine/calendar/MODULE.md`

### Slice 3: recaps on screen

Done when: a season's turn at 3× pauses and opens the recap, and Carry on resumes at 3×; Turn off recaps and both switches are kept on the device; a year jump shows only the year recap; the Chronicle tab lists every recap; "why?" in a recap opens the chain; the 390 px browser check passes.

- Reading list: `docs/DECISIONS.md` V-191; `src/ui/MODULE.md`; `src/ui/dawn.ts`; `src/ui/sheets.ts`; this spec

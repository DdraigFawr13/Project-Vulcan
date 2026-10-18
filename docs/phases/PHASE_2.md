# Phase 2: Colonists and work

Goal: people who act on their own. Entry: Phase 1 done and signed off by Morgan (2026-10-18). Plan source: the project file `vulcan/plan/phases/PHASE_2.md`. Control stays indirect (V-015): nothing on any Phase 2 screen moves or orders one colonist.

## Status

- [x] P2.0 Engine groundwork (merged 2026-10-18 in two PRs: engine #18, archive and worker in the second). `npm run budget`, ten years at 30 people (measured, about 16 s): 1.52 M lines written; 3,189 recent lines and 3,037 stubs held; ledger in memory 0.66 MB (budget 2); save 1.68 MB (4); standby clone 17 ms median (25); archive 16.6 MB gzipped (40); midnight tick 2.7 ms mean (5)
- [ ] P2.1 Title screen, the band and their arrival
- [ ] P2.2 Needs and basic mood (P2.2 to P2.4 run as one bundle in one thread, VR-61)
- [ ] P2.3 Pathfinding across levels
- [ ] P2.4 Jobs, hauling, items and stockpiles
- [ ] P2.5 Schedules, work priorities, skills by use
- [ ] P2.6 Colonist bar, inspector tabs, alert feed
- [ ] P2.7 Skip ahead

Taste board (VR-56): https://claude.ai/artifact/4WdMASnMFnvDcBryD132KJ. Morgan took every recommendation (2026-10-18), binding every Phase 2 UI mock-up: colonists are small full figures in three-quarter view with four facings and two walk frames (P2.1); the play screen has a portrait strip with mood rings under the top bar, a one-line alert ticker with a count badge, and a skip button after 1x 2x 3x, with no PAUSED word (P2.6, P2.7); the title screen shows the last valley dimmed behind Continue (valley and date) and New game (P2.1); needs show as bars with a warning line, a word and "why?" (P2.2, P2.6); work priorities on a phone are one colonist at a time with a 1 to 4 stepper per job, the grid on desktop (P2.5); a crash shows a plain sentence, the day kept, and a RESCUE row in Saves. Later rules: why? ends at a plain "older record" line, and players never see raw type ids.

## Milestones

### P2.0 Engine groundwork

A ledger policy (moves and routine ticks are not lines); the ledger kept as the last `ledger.recentDays` game days in full, older days sealed at midnight into gzipped NDJSON segments in IndexedDB, with stubs for older lines the world still cites, so "why?" ends at "older record"; typed entity tables with one id counter, checked generically by the save check; a rescue save slot written from the standby copy on any engine error; per-tick and per-system timing behind `?debug`. Mock-up: engine. Done when: `npm run budget`, a synthetic ten-year run at 30 colonists (V-027), stays within its memory and save budgets, in a table.

- Reading list: `docs/ARCHITECTURE.md#event-log`, `#save`, `#tick`; `src/engine/log/MODULE.md`; `src/engine/sim/MODULE.md`; `src/worker/MODULE.md`; `src/persist/MODULE.md`

### P2.1 Title screen, the band and their arrival

Title screen with Continue and New game. Five colonists (V-016) from race and culture content: attributes, skills with fixed potential, traits, names; an arrival screen; the `sprites-people` sheet. Mock-up: UI. Done when: ten seeds give ten distinct bands, each with someone able to build and cook.

- Reading list: `docs/DECISIONS.md` V-016; `docs/ART.md` row P2.1; `src/content/MODULE.md`; `src/ui/MODULE.md`; `src/render/MODULE.md`

### P2.2 Needs and basic mood

Hunger, sleep, warmth and recreation, and a mood from them. A need crossing its warning line is a ledger line; its fall each tick is not. Mock-up: engine. Done when: a colonist with food and a bed keeps every need above its warning line for a week.

- Reading list: `src/engine/log/MODULE.md`; `src/engine/weather/MODULE.md`; the needs content

### P2.3 Pathfinding across levels

Chunked A* over the surface and the levels below, through stairs and shafts. Mock-up: engine. Done when: path queries stay under the tick budget with five walkers on the full map.

- Reading list: `docs/ARCHITECTURE.md#map`; `src/engine/map/MODULE.md`

### P2.4 Jobs, hauling, items and stockpiles

Jobs from designations, hauling; items with stacks and quality; stockpile zones with filters; the `items` sheet. Mock-up: UI. Done when: felled logs reach the matching stockpile without an order to any individual.

- Reading list: `docs/DECISIONS.md` V-015; `docs/ART.md` row P2.4; `src/engine/map/MODULE.md`; `src/ui/MODULE.md`

### P2.5 Schedules, work priorities, skills by use

Schedules, a work priority grid, skills that grow by use. Mock-up: UI. Done when: raising a priority changes who takes the job within an hour of game time.

- Reading list: `src/ui/MODULE.md`; the jobs content

### P2.6 Colonist bar, inspector tabs, alert feed

Colonist bar, selection, inspector tabs (needs, skills, ledger); an alert feed naming who, what and where. Mock-up: UI. Done when: every need change in the inspector links to the event that caused it.

- Reading list: `src/ui/MODULE.md`; `src/render/MODULE.md`; `src/worker/MODULE.md`

### P2.7 Skip ahead

Run as fast as the device allows until a notable event (a content list), then pause on it (V-026). Mock-up: UI. Done when: skipping a quiet season stops on the first notable event, and the ledger matches a run at 3x.

- Reading list: `docs/DECISIONS.md` V-026; `src/worker/MODULE.md`

## Phase done (playtest)

Five colonists, a food pile and firewood; set priorities and watch a game week pass without anyone starving.

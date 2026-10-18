# Decisions

Locked decisions, all made by Morgan in the planning thread on 2026-10-17 unless dated otherwise. Don't reopen one without new evidence (WS-07); a change updates this table in the same PR. The pillars they serve are in the project plan, `PLAN.md` §1 (see AGENT_BRIEF).

| ID | Decision |
| --- | --- |
| V-001 | Browser game: Phaser 4 + TypeScript + Vite (Phaser 4 chosen over 3 on 2026-10-17, pinned at 4.2.1). Repo `DdraigFawr13/Project-Vulcan`, owned by Morgan. |
| V-002 | Deterministic seeded simulation in a Web Worker at a fixed tick; renderer and UI on the main thread. |
| V-003 | Top-down 2D pixel art, 32 px tiles, muted earthy palette. Claude makes placeholder art; Final art is AI-made images Morgan picks from (V-034). |
| V-004 | Local saves in IndexedDB; saves move between devices as files, not cloud saves (V-032). Event log exportable as NDJSON; optional sql.js export later. |
| V-005 | Process as AI-Master-Instructions and the Story Generator: phase spec of at most two pages approved by Morgan before code; mock-up round before a build; PRs of 300 to 1,500 lines, one milestone each; squash-merge on green CI; merged branches deleted. |
| V-006 | Engine purity: no DOM, `Date`, `Math.random`, transcendental `Math` (sin, pow, log and the like, which can differ between browsers), timers or I/O in `src/engine` or `src/content`; named RNG streams; every state change emits an event with cause links. A boundaries check in CI enforces it. |
| V-007 | Content over code. Locked decisions live in `docs/DECISIONS.md`. |
| V-008 | Content is a forked copy of the Story Generator raws (cultures, races, names, 336-day calendar of 12 months of 28 days, creatures, items, abilities, six schools, tiers None to Legendary, awakenings, lore, faiths, great works, dragons). Vulcan tunes its own copy. |
| V-009 | Default site is a Gwerin valley. |
| V-010 | The full feature list (World, Economy, Colonists, Threats, Meta, Magic) is in scope. Nothing is cut except the mod loader (V-035); the phases set the order. |
| V-011 | Optional local Ollama hook: asynchronous, text only, never changes game state. No API key or backend ever required. |
| V-012 | Budget: Morgan about 10 hours a week; Claude builds in threads. No deadline. |
| V-013 | Map: surface 150 by 150 tiles. Size is a world parameter, so a larger map can be added later without code changes. |
| V-014 | Four underground levels below the surface (five z-levels in all), each generated lazily when first reached. Depth is a parameter for later growth. |
| V-015 | Combat is real time with pause and fully indirect: colonists decide to fight, flee or hide from traits, skills, morale, laws and standing orders. There is no drafting and no unit command. |
| V-016 | Five starting colonists. |
| V-017 | SUPERSEDED by V-031 (2026-10-18): the lighter generator from P1.5 is replaced by the Story Generator's own world in P1.6. |
| V-018 | Hosting: Vercel, production from `main` only, branch previews off, as the Story Generator (default picked 2026-10-17). |
| V-019 | In a fight the player may still pull standing levers (alarm bell, guard posts, militia law, safe zone) but never moves, drafts or targets anyone (P8.2). |
| V-020 | Each phase end goes live on the site from `main` as a playable build; the game is called launched only once every phase is in. |
| V-021 | Project-Vulcan PR #1 is closed with a comment; its deterministic engine core, clock and event log are copied into the new layout in P0.3, reviewed against V-006. |
| V-022 | Game audit, 2026-10-18 (V-022 to V-035): a thin slice of the people pillar is in the first playable (P4.8): colonists remember events, one law (work hours), each obeys or refuses with a reason. |
| V-023 | Simple fields and a cooking fire are in Phase 4 (P4.7); Phase 5 deepens farming and cooking. |
| V-024 | Predators come with hunting in Phase 5, met by a simple fight-or-flee choice that the Phase 8 combat core grows. |
| V-025 | No win ending: optional ambitions from the great works content (P9.6); failure stays a story. |
| V-026 | A skip-ahead speed (run until a notable event, then pause) comes in Phase 2 (P2.7). A year is 80 real minutes at 3x. |
| V-027 | Target colony size: about 30 people by year 10; performance and memory budgets are set for that. |
| V-028 | Wanderers and refugees join from the world's sites, each with a reason from its record (P5.9). |
| V-029 | Phone first: every UI mock-up is designed at phone width (390 px), then desktop (RULES VR-57). |
| V-030 | Underground fog: caves and water stay hidden until mining opens next to them; veins stay visible once a level is reached (P4.1). |
| V-031 | The Story Generator's world and history engine is used as a package (approved as a dependency, SAFE-03), with an adapter from Vulcan's content. It replaces P1.5's lighter generator in P1.6, behind the region map screen merged in P1.5 (six to eight neighbours, three valleys to pick, game palette, Region button), which Morgan likes; later phases build on that screen. P9.3 keeps the world's history running during play. |
| V-032 | Saves move between devices as downloaded save files (P10.2); no cloud saves, so no backend (V-011). |
| V-033 | Sound: ambient valley sound and a few effects in Phase 10 (P10.7), each licensed. |
| V-034 | Final art: AI-made images Morgan picks from, each batch's credit cost approved first (SAFE-04), cleaned to the palette and art names (P10.5). |
| V-035 | No mod loader at launch (P9.6 now holds ambitions). |
| V-036 | Ledger policy (P2.0, 2026-10-18; narrows V-006's "every state change emits an event"): a ledger line is a change a player would read or trace (something made, found or decided, a threshold crossed, someone hurt, a law weighed); steps walked, needs falling each tick and work progress change state without a line. The running world keeps a game week of lines in full; older days are sealed into an archive, and lines the world still cites stay as stubs. |
| V-037 | UI look "Hearth and Page" (Morgan, 2026-10-18): controls are pixel oak and iron at the tiles' grain, reading surfaces are paper pages in a book face; tap targets at least 40 px, text at least 11 px, sheets at most 40% of a phone screen. Rules in `docs/UI_STYLE.md`. |
| V-038 | Food in Phase 2 (phase review, 2026-10-18): no stopgap. The cart's 240 preserved food lasts 27.8 days for five on every seed tested, so the phase's one-week playtest passes; after that the band is hungry until food work arrives, and the playtest page says so. Whether foraging joins Phase 3 is Morgan's call (asked on the review's card). |

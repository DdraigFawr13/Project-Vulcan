# Decisions

Locked decisions, all made by Morgan in the planning thread on 2026-10-17 unless dated otherwise. Don't reopen one without new evidence (WS-07); a change updates this table in the same PR. The pillars they serve are in the project plan, `PLAN.md` §1 (see AGENT_BRIEF).

| ID | Decision |
| --- | --- |
| V-001 | Browser game: Phaser 3 + TypeScript + Vite. Repo `DdraigFawr13/Project-Vulcan`, owned by Morgan. |
| V-002 | Deterministic seeded simulation in a Web Worker at a fixed tick; renderer and UI on the main thread. |
| V-003 | Top-down 2D pixel art, 32 px tiles, muted earthy palette. Claude makes placeholder art; Morgan does an art pass later. |
| V-004 | Local saves in IndexedDB; cloud saves later. Event log exportable as NDJSON; optional sql.js export later. |
| V-005 | Process as AI-Master-Instructions and the Story Generator: phase spec of at most two pages approved by Morgan before code; mock-up round before a build; PRs of 300 to 1,500 lines, one milestone each; squash-merge on green CI; merged branches deleted. |
| V-006 | Engine purity: no DOM, `Date`, `Math.random`, timers or I/O in `src/engine` or `src/content`; named RNG streams; every state change emits an event with cause links. A boundaries check in CI enforces it. |
| V-007 | Content over code. Locked decisions live in `docs/DECISIONS.md`. |
| V-008 | Content is a forked copy of the Story Generator raws (cultures, races, names, 336-day calendar of 12 months of 28 days, creatures, items, abilities, six schools, tiers None to Legendary, awakenings, lore, faiths, great works, dragons). Vulcan tunes its own copy. |
| V-009 | Default site is a Gwerin valley. |
| V-010 | The full feature list (World, Economy, Colonists, Threats, Meta, Magic) is in scope. Nothing is cut; the phases set the order. |
| V-011 | Optional local Ollama hook: asynchronous, text only, never changes game state. No API key or backend ever required. |
| V-012 | Budget: Morgan about 10 hours a week; Claude builds in threads. No deadline. |
| V-013 | Map: surface 150 by 150 tiles. Size is a world parameter, so a larger map can be added later without code changes. |
| V-014 | Four underground levels below the surface (five z-levels in all), each generated lazily when first reached. Depth is a parameter for later growth. |
| V-015 | Combat is real time with pause and fully indirect: colonists decide to fight, flee or hide from traits, skills, morale, laws and standing orders. There is no drafting and no unit command. |
| V-016 | Five starting colonists. |
| V-017 | World map: a lighter Vulcan generator (the valley among named neighbouring sites) at first; the full Story Generator worldgen and history port comes in Phase 9. |
| V-018 | Hosting: Vercel, production from `main` only, branch previews off, as the Story Generator (default picked 2026-10-17). |
| V-019 | In a fight the player may still pull standing levers (alarm bell, guard posts, militia law, safe zone) but never moves, drafts or targets anyone (P8.2). |
| V-020 | Each phase end goes live on the site from `main` as a playable build; the game is called launched only once every phase is in. |
| V-021 | Project-Vulcan PR #1 is closed with a comment; its deterministic engine core, clock and event log are copied into the new layout in P0.3, reviewed against V-006. |

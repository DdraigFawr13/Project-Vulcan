# Phase 0: Foundations and repo setup

Goal: a repo that builds, tests, deploys and runs an empty deterministic world in a worker. Entry: the project plan approved (2026-10-17). Plan source: the project file `vulcan/plan/phases/PHASE_0.md`.

## Status

- [x] P0.1 Repo setup (PR #2, merged 2026-10-17)
- [x] P0.2 Content fork (merged 2026-10-17)
- [x] P0.3 Engine core (merged 2026-10-17)
- [x] P0.4 Worker loop, map and art pipeline (merged 2026-10-17)
- [ ] P0.5 Saves, export and debug inspector
- [ ] Phase review, then playtest with Morgan

## Milestones

### P0.1 Repo setup

Scaffold, checks, CI, docs, toolkit, agents and skills; PR #1 closed with its engine core kept for P0.3. Mock-up: none (the plan was the mock-up). Done when: CI green, `npm run check` under 60 s, the live deploy shows the empty valley at the merge commit (waits on Morgan connecting Vercel).

- Reading list: `docs/ARCHITECTURE.md`, `docs/RULES.md`, `docs/TOOLKIT.md`

### P0.2 Content fork

`tools/fork-content` copies the Story Generator raws at a pinned revision into `src/content/data/`, recorded in `src/content/FORK.md`; schemas and validators; `contentHash`. Mock-up: engine (a table of forked files, entry counts and the hash). Done when: the validator passes on the fork and fails on a broken sample entry.

- Reading list: `docs/ARCHITECTURE.md#layers`, `src/content/MODULE.md`, `docs/DECISIONS.md`

### P0.3 Engine core

Types, `sfc32` RNG streams, scheduler, `emit` with template check, command queue, salvaged from PR #1's `src/engine/core` where it meets V-006 (fetch it with `git show f054061:<path>`). Mock-up: engine (sample event lines with causes). Done when: one determinism test gives identical logs for the same seed and commands after a game month.

- Reading list: `docs/ARCHITECTURE.md#rng`, `src/engine/MODULE.md`, `docs/templates/MODULE.md`, `tools/check-boundaries.mjs`

### P0.4 Worker loop, map and art pipeline

Worker loop and protocol; speeds and pause; a flat 150 by 150 map drawn from snapshots; camera; `palette.gpl`, `tools/pack-sheet` and the `tiles-base` sheet. Mock-up: UI. Done when: 60 fps on the production build at 3x; pause stops the tick.

- Reading list: `docs/ARCHITECTURE.md#worker-protocol`, `src/worker/MODULE.md`, `src/render/MODULE.md`, `src/render/index.ts`, `docs/ART.md`, `src/engine/index.ts`

### P0.5 Saves, export and debug inspector

IndexedDB save and load, NDJSON export, a debug inspector with "why?" links. Mock-up: UI. Done when: save, reload and continue gives the same log as an unbroken run.

- Reading list: `docs/ARCHITECTURE.md#save`, `src/persist/MODULE.md`, `src/ui/MODULE.md`, `src/worker/index.ts`, `src/engine/index.ts`

## Phase done (playtest)

New game from a seed, run a game month at 3x, save, reload, export; the same seed twice gives identical logs.

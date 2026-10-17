# Agent instructions

Vulcan (working title "Ledger"): a RimWorld-style colony sim in the Story Generator's world, where colonists interpret laws rather than obey them. TypeScript, Phaser 4, Vite; the simulation runs deterministically in a Web Worker. Vercel deploys from `main`.

Shared rules come from AI-Master-Instructions through CLAUDE.md (`.claude/master/RULES.md`, layers `core`, `stacks/node-web`, `project-types/game`). Don't edit synced files; see `.ai-master.json`.

## Start here (read only these, then your reading list)

1. [docs/AGENT_BRIEF.md](docs/AGENT_BRIEF.md): one page of binding rules, flow, commands.
2. [docs/CODEMAP.md](docs/CODEMAP.md): every module, its purpose and exports.
3. The current `docs/phases/PHASE_N.md`: its Status section and the reading list of your milestone.
4. [docs/LESSONS.md](docs/LESSONS.md) entries for your area.

Open [docs/RULES.md](docs/RULES.md), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TOOLKIT.md](docs/TOOLKIT.md) and [docs/ART.md](docs/ART.md) only at the section you need.

## Local checks (run before pushing)

- While iterating: `npm run test:related -- <changed files>`.
- Every push: `npm run check` (AI-master drift, format, typecheck, boundaries, size limits, code map, reading cost, unit tests, build), with step timings against its 60 s budget.
- UI or render changes: also `npm run test:browser`.
- Map or terrain changes: `npm run map:stats` (the seed table against Phase 1's done-whens; seeds in `src/engine/map/seeds.ts`) and `npm run map:render` (PNGs in `tmp/maps/`, not committed), as the `map-check` skill says.
- After adding or changing a module's `index.ts` or `MODULE.md`: `npm run codemap`.

Cloud sessions: the synced session hook installs Node 24.19.0 and npm 11.9.0 and sets `PLAYWRIGHT_CHROMIUM_PATH`. Don't download Node or browsers by hand.

## What CI runs

`ci.yml`: `core` (the same steps as `npm run check`) and `browser` (Chromium smoke on the production build), target under 5 minutes. It runs once, when a PR is marked ready for review, and never on a draft or on `main` after a merge (RULES VR-54). So: open PRs as drafts, push freely, run the checks locally, and mark ready only when the PR is done. A push to a ready PR re-runs CI. `prune-merged-branches.yml` deletes merged branches until GitHub's auto-delete setting is on.

## Overrides

Master rules this project deliberately changes; the same entries are in `.ai-master.json`.

- **CTX-01, CTX-02, CTX-03**: no HANDOFF.md. Sessions start from AGENT_BRIEF and the phase spec; status lives in the phase spec's Status section, the project plan's phase table and CHANGELOG, updated at each milestone merge.
- **SRC-04**: DECISIONS is a one-line table; the decisions were made in Morgan's planning thread and serve the pillars in the project plan's §1.
- **GAME-05**: old saves need not load before launch.

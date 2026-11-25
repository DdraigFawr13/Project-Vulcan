# Agent instructions

Project Vulcan (working title): a RimWorld-style colony sim in the Story Generator's world, where colonists interpret laws rather than obey them. TypeScript, Phaser 4, Vite; the simulation runs deterministically in a Web Worker. Vercel deploys from `main`.

Shared rules come from AI-Master-Instructions through CLAUDE.md (`.claude/master/RULES.md`, layers `core`, `stacks/node-web`, `project-types/game`). Don't edit synced files; see `.ai-master.json`.

## Start here (read only these, then your reading list)

1. [docs/AGENT_BRIEF.md](docs/AGENT_BRIEF.md): one page of binding rules, flow, commands.
2. [docs/CODEMAP.md](docs/CODEMAP.md): every module, its purpose and exports.
3. The current `docs/phases/PHASE_N.md`: its Status section and the reading list of your milestone.
4. [docs/LESSONS.md](docs/LESSONS.md) entries for your area.

Open `docs/RULES.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `TOOLKIT.md` and `ART.md` only at the section you need. Any screen work reads `docs/UI_STYLE.md` first.

## Local checks (run before pushing)

- While iterating: `npm run test:related -- <changed files>`.
- Every push: `npm run check` (test-traps warnings, drift, format, types, boundaries, limits, shape ratchet, code map, reading, quick tests, build). Before ready: `npm run check:all` on the final commit (a hook refuses the ready mark otherwise) and `npm run test:browser` once (VR-67). CI runs `npm run check:all`.
- Shape ratchet (`npm run shape`, `-- --list` names the offenders): long or tangled functions, copied helpers and contracts over 6 KB may not grow in number; after a refactor lowers one, run `npm run shape -- --update`. Before adding a helper, search for an existing one (the `refactor` skill).
- Coverage: `npm run coverage` (full suite with V8 coverage, then one line per system) at each phase review; not part of `npm run check` or CI.
- Test time budgets (VR-67): `npm run check` under 40 s; `npm run check:full` under 120 s (V-200).
- UI or render changes: also `npm run test:browser`.
- Map or terrain changes: `npm run map:stats` (the seed table against Phase 1's done-whens; seeds in `src/engine/map/seeds.ts`) and `npm run map:render` (PNGs in `tmp/maps/`, not committed), as the `map-check` skill says.
- After adding or changing a module's `index.ts` or `MODULE.md`: `npm run codemap`.

Cloud sessions: the synced session hook installs Node 24.19.0 and npm 11.9.0 and sets `PLAYWRIGHT_CHROMIUM_PATH`. Don't download Node or browsers by hand.

## What CI runs

`ci.yml`: `core` (`npm run check:all`) and `browser` (the browser tests on the production build, in Playwright's image), target under 5 minutes. It runs once, when a PR is marked ready, never on a draft or on `main` (VR-54): open PRs as drafts, push freely, check locally, mark ready only when done. A push to a ready PR re-runs CI. `prune-merged-branches.yml` deletes merged branches until GitHub's auto-delete setting is on.

## Overrides

Master rules this project deliberately changes; the same entries are in `.ai-master.json`.

- **CTX-01, CTX-02, CTX-03**: no HANDOFF.md. Sessions start from AGENT_BRIEF and the phase spec; status lives in the phase spec's Status section, the project plan's phase table and CHANGELOG, updated at each milestone merge.
- **SRC-04**: DECISIONS is a one-line table; the decisions were made in Morgan's planning thread and serve the pillars in the project plan's §1.
- **GAME-05**: old saves need not load before launch.

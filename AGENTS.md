# Agent instructions

Project Vulcan, working title **Ledger**: a browser-only colony sim in the Dwarf Fortress spirit where colonists interpret the player's laws rather than obey them. TypeScript engine in a Web Worker, canvas viewer, no server.

Shared rules come from AI-Master-Instructions and load through CLAUDE.md (`.claude/master/RULES.md`, layers `core`, `stacks/node-web`, `project-types/game`). Don't edit synced files; see `.ai-master.json`. Conventions follow Story-Generator, the sister project.

## Read first

1. `docs/HANDOFF.md`: current state and next step.
2. `docs/DECISIONS.md`: settled rules. Don't reopen them.
3. `docs/LESSONS.md`: entries for the area you are about to work in.
4. The current milestone spec in `docs/milestones/`; `docs/CONCEPT.md` for the design; `docs/ARCHITECTURE.md` for layers and the code map.

## Working style

- One milestone per branch and PR. Each milestone gets a spec of at most two pages in `docs/milestones/` that the owner approves before the build; its status section is updated when it lands.
- Ask the owner on design forks (what colonists believe, what a law means, what the player sees). Pick defaults for small forks and record them in the spec.
- Tuning is time-boxed: three runs per question with `npm run run-sim`, then a numbers table and a question.

## Local checks (run before pushing)

- Every push: `npm run check` (format, typecheck, boundaries, unit tests, build).
- UI or browser-test changes: also `npm run test:browser`.
- Headless run: `npm run run-sim -- --seed vulcan --days 5` (one line per day, last chronicle lines).
- After a sync: `node .claude/master/sync.mjs --check`.

Cloud sessions: the synced session hook installs Node 24.19.0 and npm 11.9.0 and sets `PLAYWRIGHT_CHROMIUM_PATH`. Don't download Node or browsers by hand.

## What CI runs

- **CI** (`ci.yml`): `core` (AI-master drift check, format, typecheck, boundaries, unit tests, build) and `browser` (Chromium smoke against the production build) on every PR and `main` push.
- **Delete merged PR branches** (`prune-merged-branches.yml`, synced).
- No deploy yet. When one is wanted, Vercel from `main` only (WEB-04).

## Project rules

- `src/engine` and `src/content` are pure: no DOM, `Date`, `Math.random`, timers, I/O, `**` or transcendental `Math`. `npm run boundaries` enforces it (D-002, D-003).
- Every random draw comes from a named stream (`streamFor(world, 'name')`); iterate colonists in id order.
- Every state change a player would notice emits an event from `src/content/events.ts`, with cause links to the events behind it. Event text never invents facts.
- Tunable numbers live in `src/content/` with a one-line comment; new content is a data entry, not an engine special case.
- The sim never waits on a model. Any model text is optional, async and replaceable by template text (D-004).
- No runtime dependency without the owner's approval (D-005, D-006).

## Overrides

Master rules this project deliberately changes. Each line names the rule id and the reason; the same entry is in `.ai-master.json` "overrides".

- None.

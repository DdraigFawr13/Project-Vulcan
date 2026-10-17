# Decisions

Settled rules for this project. Not a changelog: an entry stays while the rule is in force. Change a rule here in the same change that changes the behaviour. Ideas stay Proposed until the owner approves them; retired entries are marked SUPERSEDED with a pointer, never deleted.

## D-001 Browser-only deterministic engine

- **Status:** Accepted (2026-10-17)
- **Decision:** TypeScript engine with a fixed tick in a Web Worker, canvas viewer, no server. Same seed and content give the same world and event log at any speed; pause and speed only change ticks per real second.
- **Why:** Morgan's architecture ([CONCEPT.md](CONCEPT.md)); real-time-with-pause needs no backend, and replayable runs are the basis for testing and for analysing exports.

## D-002 Seeded streams and a checked pure core

- **Status:** Accepted (2026-10-17)
- **Decision:** Randomness comes from named sfc32 streams derived from `(seed, name)` (`src/engine/core/rng.ts`, from Story-Generator). `src/engine` and `src/content` may not use DOM, clock, timers, I/O or `Math.random`; `npm run boundaries` enforces the layer table `engine ← content ← platform ← app`.
- **Why:** GAME-01; Story-Generator's proven setup, so adding a stream never reshuffles another.

## D-003 Safe math in the engine

- **Status:** Accepted (2026-10-17)
- **Decision:** The engine and content use `+ - * /`, `sqrt`, `floor`, `round`, `ceil`, `trunc`, `min`, `max`, `abs`, `sign`, `imul` only. No `sin`, `cos`, `exp`, `pow`, `log` or `**`.
- **Why:** Transcendental functions may differ between JS engines and break replays (Story-Generator ARCHITECTURE "Safe math").

## D-004 No model on the critical path

- **Status:** Accepted (2026-10-17), default chosen while hardware is unknown
- **Decision:** Build for the no-model option. Depth comes from rules and data tables. A local model (Ollama) may later enrich text through an optional, asynchronous hook (milestone 5); template text always fills the same slot, and model text never changes state.
- **Why:** No per-call API cost; GAME-03. Hardware (GPU or Apple Silicon) is not known yet, so nothing is planned around one.

## D-005 Event log storage

- **Status:** Proposed (2026-10-17)
- **Decision:** Milestone 1 keeps the log in memory in the worker and exports NDJSON (one event per line, `pandas.read_json(path, lines=True)`). Adding sql.js (about 1 MB of WebAssembly) waits for the owner's go-ahead, behind the existing `EventLog` interface.
- **Why:** SAFE-03 asks before any runtime dependency; nothing in milestone 1 queries the log, and NDJSON already serves the pandas workflow.

## D-006 No UI framework yet

- **Status:** Proposed (2026-10-17)
- **Decision:** The viewer is plain DOM and Canvas 2D with no runtime dependencies. Revisit when the inspector grows (milestone 2's beliefs and memories); React would match Story-Generator.
- **Why:** SAFE-03; milestone 1's UI is a few panels.

## D-007 Time scale

- **Status:** Accepted (2026-10-17)
- **Decision:** One tick is 6 game minutes: 10 ticks an hour, 240 a day. Speed 1× runs 10 ticks a second (a game day in 24 s); speeds are 1×, 2×, 5× and 10×.
- **Why:** Fine enough for walking one tile a tick on a 64×48 map, coarse enough to run years in seconds headless.

## D-008 Shared rules

- **Status:** Accepted (2026-10-17)
- **Decision:** AI-Master-Instructions v0.2.0 with layers `core`, `stacks/node-web` and `project-types/game`, no overrides. Toolchain versions match Story-Generator (Node 24.19.0, npm 11.9.0, TypeScript 7.0.2, Vite 8.3.4, Vitest 5.0.3, Playwright 1.64.0).
- **Why:** Morgan named the master and Story-Generator as the rules for this project. `game` fits better than `simulator`, whose SIM-05 safety rules are for industrial control; Ledger takes SIM-03 (events carry causes) as a project rule instead.

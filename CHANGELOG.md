# Changelog

One dated line per merged milestone.

- 2026-10-17 · P0.1 · Repo setup: Vite, Phaser 4 and strict TypeScript scaffold; `npm run check` with timings, boundaries, size limits, code map and reading-cost checks; CI; docs, toolkit, project agents and skills.
- 2026-10-17 · P0.2 · Content fork: 24 Story Generator content files copied at `7866aea` into `src/content/data/`, with schemas, a validator (shapes, ids, references, tier caps) and `contentHash`; races made generic, eight fantasy creatures added, place names drawn from every culture.
- 2026-10-17 · P0.3 · Engine core: named sfc32 RNG streams, the game clock (one tick a minute, 06:00 start), a scheduler with minute, hour, day and month cadences, `emit` with a template and slot check, a lever queue that stamps late commands on the next tick, replay from the command log, and the calendar's day, month and season lines; ledger templates in the new `events.json`.

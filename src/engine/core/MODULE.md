# core

The engine's shared vocabulary: world and event types, the named RNG streams, string hashes and the game clock.

- **Public API:** `index.ts`: `RngStream` (`int`, `between`, `chance`, `pick`, `weighted`), `streamFor(world, name)`, `deriveStreamState`, `nextUint32`, `hash128` (cyrb128, seeds a stream from `seed:name`), `hashString` (FNV-1a 32-bit digest), `clockAt(tick, calendar)`, `ticksPerMonth`, `START_TICK` (06:00 day 1), `TICKS_PER_HOUR`, `TICKS_PER_DAY`, `STREAMS` (with `smithing`, `wild`, `blight`), and the types `WorldState`, `SimEvent`, `Command`, `EngineContent`, `CalendarDef`, `StreamName`, `EventData`, `RngState`, `Clock`.
- **Events:** none.
- **State owned:** none; it defines the shapes. `WorldState.rng` holds each stream's four sfc32 words.
- **Invariants:** a stream's start depends only on `(seed, name)`, so a new stream never reshuffles the others; only 32-bit integer operations, identical in every JS engine. One tick is one game minute.
- **Tests:** exercised through `src/engine/engine.test.ts` (a stream's rolls differ by seed and replay exactly); no test of its own (VR-21, VR-22). RNG salvaged from PR #1 (commit f054061).

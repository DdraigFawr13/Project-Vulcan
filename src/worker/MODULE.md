# worker

The Web Worker that owns the engine, runs the tick loop and answers the main thread.

- **Public API:** `index.ts`: `spawnSimWorker()`, `TICKS_PER_SECOND`, and the protocol types `ToWorker`, `FromWorker`, `Speed`, `ClockView`, `ChunkView` (`protocol.ts`; DECISIONS V-002; ARCHITECTURE "Worker protocol"). `worker.ts` is the worker's entry; `pace.ts` the tick clock.
- **Messages in:** `init {seed, contentHash}` (a content mismatch stops the worker with an error naming both hashes; init and the future `load` both end in `adopt`: paused, everything resent), `setSpeed {speed}` (0 paused, 1 to 3), `command {tick, kind, data}`, `requestSnapshot`, and reserved for P0.5 `load {save}` and `export {kind}` (both end in the same state `init` would).
- **Messages out:** `ready {seed, contentHash, width, height}`; on each request, `events {batch}` (new ledger lines, if any) then `snapshot {tick, speed, clock, chunks}`; `error {message}`.
- **Tick scheduler:** wakes every 10 ms but trusts `performance.now()`, not the timer: each wake runs the whole ticks owed for the real time elapsed at the current speed (10, 30, 100 a second), carrying the fraction. At most 250 ms is caught up after a stall; the rest is dropped. Pausing drops the fraction, so the tick stops dead.
- **Snapshots:** pulled, never pushed: the page asks once per frame with at most one request in flight. Chunks go out when their `world.map.chunkVersions` entry differs from the last one sent (all of them the first time), as transferred `Uint8Array`s.
- **Rules:** the only place the engine is instantiated. Speed and pause are worker settings, never game commands. Any throw stops the loop and posts `error`; the page shows it and offers a reload.
- **Tests:** `pace.test.ts` (speeds, pause, catch-up cap); the browser smoke (pause stops the tick, 3x runs).

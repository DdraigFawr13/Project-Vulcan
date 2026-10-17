# worker

The Web Worker that owns the engine, runs the tick loop and answers the main thread. Empty until P0.4.

- **Public API:** `src/worker/index.ts`: the message protocol types (DECISIONS V-002; ARCHITECTURE "Worker protocol").
- **Rules:** the only place the engine is instantiated. Commands carry the tick they apply on.

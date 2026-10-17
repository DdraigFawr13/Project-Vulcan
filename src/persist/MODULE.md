# persist

Saves in IndexedDB and NDJSON export, on the main thread. Empty until P0.5.

- **Public API:** `src/persist/index.ts` (from P0.5).
- **Rules:** a save is `{version, seed, params, contentHash, tick, state, commandLog, eventLog}`; rebuilding from seed and command log must match (ARCHITECTURE "Save").

# map

The valley's ground: every surface tile and what it is made of.

- **Public API:** `index.ts`: `mapSystem` (lays the map out when a world begins), `CHUNK` (16), `chunksAcross(map)`, `chunksDown(map)`, `chunkTiles(map, cx, cy)` (one chunk's tiles as a `Uint8Array`, for the worker's snapshots).
- **Events:** emits `map.formed` (cites `world.begun`) once, at world creation; reads none.
- **State owned:** `world.map`: `width`, `height`, `tiles` (index into `content.terrain.kinds`, row by row) and `chunkVersions` (one counter per chunk, raised when a tile in it changes, so the worker sends only changed chunks).
- **Invariants:** size and starting ground come from `content.terrain.surface`; every tile names an existing kind. Flat ground until Phase 1, whose generator draws from the reserved `worldgen` stream. Which picture a tile shows is the renderer's choice, never state.
- **Tests:** `src/engine/engine.test.ts` (the determinism test also compares the map).

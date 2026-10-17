# map

The valley's ground: every surface tile and what it is made of.

- **Public API:** `index.ts`: `mapSystem` (lays the map out in `init` when a world begins from a seed, never on load), `setTile(ctx, x, y, kind)` (the only writer of a tile afterwards: it raises the chunk's version; the caller emits the event that explains the change), `CHUNK` (16), `chunksAcross(map)`, `chunksDown(map)`, `chunkTiles(map, cx, cy)` (one chunk's tiles as a `Uint8Array`, for the worker's snapshots).
- **Events:** emits `map.formed` (cites `world.begun`) once, at world creation; reads none.
- **State owned:** `world.map`: `width`, `height`, `tiles` (index into `content.terrain.kinds`, row by row) and `chunkVersions` (one counter per chunk, raised when a tile in it changes, so the worker sends only changed chunks).
- **Invariants:** size and starting ground come from `content.terrain.surface`; every tile names an existing kind (`setTile` checks; content allows at most 256 kinds, as tiles travel as bytes). Tiles are kind indices, so a save is only valid with the content it was made with (P0.5 `load` refuses a different `contentHash`). Generation belongs in `init`, not a cadence. Flat ground until Phase 1, whose generator draws from the reserved `worldgen` stream. Which picture a tile shows is the renderer's choice, never state.
- **Tests:** `src/engine/engine.test.ts` (the determinism test also compares the map).

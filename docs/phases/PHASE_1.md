# Phase 1: World and map

Goal: a valley worth settling. Entry: Phase 0 done and its playtest signed off by Morgan (2026-10-17). Plan source: the project file `vulcan/plan/phases/PHASE_1.md`.

## Status

- [x] P1.1 Surface terrain (merged 2026-10-17)
- [x] P1.2 Water (merged 2026-10-17)
- [ ] P1.3 Underground
- [ ] P1.4 Aura, seasons and weather
- [ ] P1.5 Lighter world map and site picker
- [ ] Phase review

Deferred: the `highlands` mountain layout (massifs inside the valley as well as on its rims, Morgan's 2026-10-17 "keep for later") is kept in `terrain.json` `generator.layouts` but unused; `generator.layout` stays `valley`. A later site type or the full worldgen port may use it.

## Milestones

Every milestone runs the `map-check` skill (`npm run map:stats` and `npm run map:render`) after its map change. The seed list is `src/engine/map/seeds.ts`; a seed that fails a done-when is fixed in the generator or answered with more seeds, never dropped.

### P1.1 Surface terrain

Elevation, climate, biomes, fertility, trees, bushes, herbs and stone from content (`terrain.json` generator dials and floors, the forked `biomes.json`, Vulcan's `features.json`), drawn from the `worldgen` stream in `mapSystem.init`; the start tile; `tiles-world` and `sprites-nature` sheets; inspector fields. Mock-up: engine (10-seed stats table and map renders). Done when: every seed in the list has at least 400 buildable tiles, 40 trees and 20 stone (rock or boulder) within 30 tiles of the start (a 61 by 61 square).

- Reading list: `docs/ARCHITECTURE.md#map`, `#rng`; `docs/DECISIONS.md` V-008, V-013; `docs/ART.md` row P1.1 to P1.3; `src/engine/map/MODULE.md`; `src/worker/MODULE.md`; `src/render/MODULE.md`

### P1.2 Water

Rivers, lakes, shallow and deep water, springs, carved from P1.1's elevation; shore autotile (47-tile blob). Mock-up: UI and engine (maps, numbers, in-game views). Done when: each seed has drinkable water within 30 tiles of the start; no river ends inland without a lake. Morgan's calls (2026-10-17): the main river stays shallow enough to wade for now; lakes a little larger. Whether springs freeze is P1.4's.

- Reading list: `src/engine/map/MODULE.md`; `docs/ART.md` row P1.1 to P1.3; `src/render/MODULE.md`; the map stats table (run it, don't read code)

### P1.3 Underground

Four lazy levels with veins by level (`docs/ARCHITECTURE.md#map`), stairs and shafts, a level (`z`) in `MapState`, `setTile`, `ChunkView` and `inspect` together; level switch in the camera. Mock-up: UI. Done when: copper and tin are reachable on every seed; a level not yet reached costs no memory.

- Reading list: `docs/ARCHITECTURE.md#map`; `docs/DECISIONS.md` V-014; `src/engine/map/MODULE.md`; `src/worker/MODULE.md`; `src/render/MODULE.md`

### P1.4 Aura, seasons and weather

Aura spots; seasons and daily weather from the forked `weather.json` with per-tile temperature, on the `weather` stream. Mock-up: engine. Done when: a year of weather per seed in a table; winter freezes still water.

- Reading list: `docs/ARCHITECTURE.md#rng`; `src/engine/calendar/MODULE.md`; `src/engine/map/MODULE.md`

### P1.5 Lighter world map

The valley among named neighbouring sites from content cultures; site picker before the world begins. Mock-up: UI. Done when: ten seeds give ten distinct, named neighbourhoods.

- Reading list: `docs/DECISIONS.md` V-017; `src/content/MODULE.md`; `src/ui/MODULE.md`

## Phase done (playtest)

Roll ten seeds, pick a site, walk the camera two levels down to a vein, watch a year of weather.

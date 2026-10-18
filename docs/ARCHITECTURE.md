# Architecture

Read only the section your phase file or reading list names.

## Layers

| Layer | Holds | Rule |
| --- | --- | --- |
| `src/engine/` | State, systems, pathfinding, jobs, economy, people, magic, threats, storyteller | Pure; id-order iteration; one RNG stream per system |
| `src/content/` | Forked raws plus Vulcan's own: tiles, buildings, recipes, jobs, laws, storyteller weights | Pure data with validators |
| `src/worker/` | Worker entry: owns the engine, runs the tick loop, answers messages | Only place the engine is instantiated |
| `src/render/` | Phaser scenes, tilemap layers, sprites, camera, selection | Reads snapshots, never mutates |
| `src/ui/` | Panels, inspector, ledger browser, priorities grid, laws, alerts | Sends commands, reads snapshots and events |
| `src/persist/` | IndexedDB saves, NDJSON export, later cloud and sql.js | Main thread only |
| `tools/` | Sheet packer, content fork and validator, headless runner, drama check | Node scripts |

## Worker protocol

Main to worker: `init {seed, contentHash}` (world params join in Phase 1), `load {save}`, `command {tick, kind, data}`, `setSpeed`, `requestSnapshot`, `save {auto}`, `export {kind}`, and the inspector's `inspect {x, y, z}` and `why {id}`, which only read the world: they never step it, emit or draw from an RNG stream. Commands are only indirect levers: designate, build, prioritise, zone, forbid, schedule, law, standing order (guard post, alarm, militia roster). Worker to main: `ready`, `snapshot {tick, speed, clock, chunks, reached}` (each chunk names its level `z`) (entities and alerts join with the phases that add them) at most once per frame, `events {batch}` in log order (rendered to text by the worker), `saved`, `loadRefused`, `exported`, `inspected`, `causes`, `error`. Commands carry the tick they apply on, so seed plus command stream replays a game exactly. Speed and pause are worker settings, never commands. Snapshots are pulled: the page sends `requestSnapshot` once per frame with at most one in flight, and changed chunks travel as transferred typed arrays. As built from P0.5: `src/worker/MODULE.md`.

## Tick

One tick is one game minute; 10 ticks per second at 1x (a game day in about 2.4 real minutes), 30 at 2x, 100 at 3x; pause at any time, with everything inspectable while paused. Fixed system order each tick; slow systems (weather, growth, aging, beliefs, storyteller) run hourly, daily or monthly. Calendar: 12 months of 28 days, four seasons of three months.

## Map

Surface 150 by 150 plus 4 underground levels of 150 by 150 (112,500 tiles at full depth), each underground level generated from seed and level index when a stair or shaft first reaches it (`MapState.levels`, null until then, so an unreached level costs no memory or save space). Tiles in 16 by 16 chunks with dirty flags, per level. Each mountain range's rock runs down beneath it, read from the surface rock as generated (`MapState.rock`, never changed by digging); the rest is bedrock bodies drawn once per seed; tunnels and caverns open deeper down. Level -1: earth, clay, groundwater. Level -2: copper and tin. Level -3: iron and sulphur. Level -4: gold, silver, gems, obsidian; one aura spot (P1.4, a cavern or obsidian seam) and cave creatures (Phase 8) later. The surface has 2 to 4 aura spots of distinct schools over a faint background (P1.4). Veins are features in the rock (`features.json` `vein`), visible once their level is reached (Morgan, 2026-10-17); from P4.1 caves and water stay hidden until mining opens next to them (V-030). As built from P1.3: `src/engine/map/MODULE.md`.

## RNG

`sfc32`, one stream per `(seed, name)`: `worldgen`, `veins`, `weather`, `wildlife`, `jobs`, `needs`, `health`, `social`, `beliefs`, `magic`, `combat`, `threats`, `storyteller`, `trade`. The levels below draw from sub-states of `veins` (`veins:<level>` for each level's own draws, `veins:bedrock` and `veins:warp` for the bedrock bodies every level shares), each derived afresh from the seed and never saved, so the order levels are reached in cannot change them. No other stream names are added.

## Event log

`{id, tick, type, actors[], subjects[], causes[], data}`; `emit` refuses a type without a content template. Append-only in the worker, streamed to the main thread, exported as NDJSON. From P2.0: moves and routine ticks are not events; the log is kept in day segments with a stub for any event still cited, so "why?" ends at "older record" rather than a gap (budget: about 30 colonists over ten years, V-027). Legends, storyteller, gossip, memory ledgers and the inspector all read this one log.

## Save

`{version, seed, params, contentHash, tick, state}` in IndexedDB with name and thumbnail; the command log and the ledger (truncatable) live in `state`, so each has one home. The worker checks version, content hash and shape before a save replaces the running world. As built from P0.5: `src/persist/MODULE.md`. Rebuilding from `seed + commandLog` is the determinism test. Old saves need not load before launch.

## Imports

`npm run boundaries` enforces: engine and content are pure; each layer imports only the layers its row allows (engine ← content ← worker ← render/persist ← ui); Phaser only in render and ui; a system folder is reached only through its `index.ts`. The Story Generator engine package (V-031) is imported only by the engine adapter P1.5 adds.

## Reading in pieces

Each layer and each system folder has a `MODULE.md` contract (at most 40 lines, template in `docs/templates/MODULE.md`); `docs/CODEMAP.md` lists them all with their exports. Read a neighbour's contract, not its code. `npm run limits` caps source files at 400 lines.

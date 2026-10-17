# Architecture

TypeScript, Vite and Canvas 2D in the browser, tested with Vitest and Playwright. No backend, accounts or API keys ([DECISIONS.md](DECISIONS.md) D-001).

## Layers

```
src/
  engine/     pure simulation: no DOM, Date, Math.random, timers or I/O
    core/     types, rng streams, event emitter, clock
    world/    map generation, path search, world creation
    colony/   the tick: regrowth, hearth, needs, choices, actions, stock conditions
    narrative/ event text from templates, task descriptions
  content/    data: tuning numbers, jobs, names, event types and templates
  platform/   the simulation worker, its host, the message protocol, the event log
  app/        the viewer: controls, canvas map, colonist list, inspector, chronicle
scripts/      boundaries check, headless run
```

`npm run boundaries` enforces the import table: `engine` imports only `engine`; `content` imports `engine` (types); `platform` imports `engine` and `content`; `app` may import all three. `engine` and `content` may not touch browser or nondeterministic globals, nor unsafe `Math` (D-003). No layer imports an external package yet.

## Engine

- **State.** One `WorldState` of plain data and typed arrays: tick, rng stream states, the tile map (terrain, feature, amount, regrowth, claims), colonists, the colony (store, hearth, stock, fuel) and the next event id.
- **Tick.** `step(world, content, n)` runs `n` ticks and returns their events. Each tick: bushes regrow, the hearth burns, then each colonist in id order updates needs, may be interrupted (collapse, starving), chooses if idle, and acts (one tile of walking or one tick of work). Stock conditions are checked last.
- **Choices.** In order: sleep when exhausted; eat when hungry (from the store, or straight from a bush when the store is empty); deliver what they carry; sleep at night; stoke the hearth when it is low (one stoker at a time); take the best-scoring job; chat when lonely; wander. A job's score is its priority × demand (1 at or below its stock target, 0 at twice it), plus a bonus for the job the colonist likes. Priority is where the law book plugs in (milestone 2).
- **Events.** `{ id, tick, type, actors, place, causes, data }`. `emit` refuses types missing from `src/content/events.ts`. Causes link earlier events: a meal cites the hunger, relighting the hearth cites it going out, a delivery cites the low-stock event it answered.
- **Text.** `renderEvent` fills content templates from event data; `describeTask` says what a colonist is doing. Text never adds facts. A model narrator (milestone 5) would only rewrite text, asynchronously, with the template as fallback (D-004).

## Platform and viewer

- `sim.worker.ts` owns the world. A 50 ms timer runs `10 × speed` ticks per real second (D-007), at most 200 per frame, then posts a frame: tick, colonists with an activity line, colony, map features and new events. Pause and step are messages; they change how many ticks run, never what a tick does.
- `event-log.ts` keeps every event (with its text) and exports NDJSON (D-005).
- `app/main.ts` draws the frame and the panels and sends control messages. It reads results only (GAME-02). Keys: space pauses, 1-4 pick a speed.

## Testing

Small unit tests on fixtures, one determinism test (same seed, any batch size, same world and log), an invariant run over five days, and one Chromium smoke. `npm run run-sim` prints daily numbers for tuning; it is a tool, not a gate.

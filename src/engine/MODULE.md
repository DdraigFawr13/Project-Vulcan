# engine

The pure, deterministic simulation: state, systems and the event log.

- **Public API:** `src/engine/index.ts` re-exports `core`, `log` and `sim`, plus `SYSTEMS` (the game's systems in tick order) and `createSim(content, systems = SYSTEMS)`. The worker builds one `Sim` from the content layer's `content`, then `createWorld`, `submitCommand` and `step`.
- **Layout:** one folder per system (`src/engine/<system>/`), each with `index.ts` as its only public surface and its own `MODULE.md`. Systems import each other only through `index.ts`. `core` (types, RNG, clock), `log` (ledger), `sim` (scheduler, lever queue) and `calendar` exist from P0.3; `map` (the surface tiles, sent to the screen in chunks) from P0.4.
- **Adding a system:** a `System` object (`sim/system.ts`) with an id, a cadence, at most one RNG stream from `STREAMS`, the event types it `emits`, its state as plain numbers and any command handlers; add it to `SYSTEMS` in tick order and its event templates to `src/content/data/events.json`.
- **Rules:** no DOM, `Date`, `Math.random`, timers, I/O or transcendental `Math`; named RNG streams; every state change emits an event with causes (DECISIONS V-006). Enforced by `npm run boundaries`. The engine never imports content; it is handed an `EngineContent`.
- **Saved state:** everything in `WorldState` (tick, map, event and command counters, RNG states, command log, pending commands, ledger, system state) is plain data; `replay(sim, seed, commandLog, tick)` rebuilds it.
- **Tests:** `engine.test.ts`, the one determinism test for the whole engine (VR-21), plus the calendar lines, late and unknown levers, and the template check.

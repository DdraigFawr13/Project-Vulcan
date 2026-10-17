# sim

The tick loop: runs each system when it is due, in a fixed order, and applies the player's levers on the tick they are stamped for.

- **Public API:** `index.ts`: `createSim(content, systems)` (checks ids and command kinds are unique), `createWorld(sim, seed)` (writes `world.begun`), `submitCommand(world, {tick, kind, data})` (returns the stamped command), `step(world, sim, ticks)` (returns the events written), `replay(sim, seed, commandLog, tick)`; types `Sim`, `System`, `SystemContext`, `Cadence`.
- **Events:** emits `world.begun`, `command.applied` (the cause a handler cites) and `command.refused` (no system handles the kind).
- **State owned:** `tick`, `nextCommandSeq`, `commandLog`, `pending`, `begunEvent`; `world.systems[id]` is created from each system's `initialState` and then owned by that system.
- **Tick order:** `tick += 1`; apply every pending command due, by tick then seq; then each system whose cadence (`minute`, `hour`, `day`, `month`) falls on the tick, in list order.
- **Invariants:** a command applies on `max(asked, tick + 1)`, never in the past and never dropped; seed plus `commandLog` replays the same ledger.
- **Tests:** `src/engine/engine.test.ts` (determinism, replay, late and unknown levers).

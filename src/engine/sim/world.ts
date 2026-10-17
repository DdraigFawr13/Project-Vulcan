// The world record and the simulation it runs under: content, templates and the system list.
import { START_TICK, type EngineContent, type WorldState } from '../core/index.ts';
import { emit, templatesOf, type Templates } from '../log/index.ts';
import type { System } from './system';

/** Everything a world runs under that is not saved state: content and code. */
export interface Sim {
  content: EngineContent;
  templates: Templates;
  /** Run in this order every tick they are due (docs/ARCHITECTURE.md "Tick"). */
  systems: readonly System[];
}

export function createSim(content: EngineContent, systems: readonly System[]): Sim {
  const ids = new Set<string>();
  const kinds = new Set<string>();
  for (const system of systems) {
    if (ids.has(system.id)) throw new Error(`System "${system.id}" is listed twice.`);
    ids.add(system.id);
    for (const kind of Object.keys(system.commands ?? {})) {
      if (kinds.has(kind)) throw new Error(`Command "${kind}" has two handlers.`);
      kinds.add(kind);
    }
  }
  return { content, templates: templatesOf(content.events), systems };
}

/** A new world at 06:00 on day 1, its first ledger line already written. */
export function createWorld(sim: Sim, seed: string): WorldState {
  const world: WorldState = {
    seed,
    tick: START_TICK,
    rng: {},
    nextEventId: 1,
    nextCommandSeq: 1,
    commandLog: [],
    pending: [],
    log: [],
    begunEvent: 0,
    systems: {},
  };
  for (const system of sim.systems) world.systems[system.id] = { ...system.initialState };
  world.begunEvent = emit(world, sim.templates, 'world.begun', { data: { seed } });
  return world;
}

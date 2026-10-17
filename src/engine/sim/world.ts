// The world record and the simulation it runs under: content, templates and the system list.
import { START_TICK, type EngineContent, type WorldState } from '../core/index.ts';
import { emit, templatesOf, type Templates } from '../log/index.ts';
import { contextFor, type System } from './system.ts';

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
      // Object.keys lists own keys only, so an inherited name such as "constructor" never counts.
      if (kinds.has(kind)) throw new Error(`Command "${kind}" has two handlers.`);
      kinds.add(kind);
    }
  }
  const templates = templatesOf(content.events);
  const core = ['world.begun', 'command.applied', 'command.refused'];
  const missing = [...core, ...systems.flatMap((s) => s.emits ?? [])].filter(
    (t) => !templates.has(t),
  );
  if (missing.length) throw new Error(`No template in content events for: ${missing.join(', ')}.`);
  return { content, templates, systems };
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
    map: {
      width: 0,
      height: 0,
      tiles: [],
      tileCauses: [],
      chunkVersions: [],
      elevation: new Int16Array(0),
      biomes: new Uint8Array(0),
      fertility: new Uint8Array(0),
      features: new Uint8Array(0),
      snow: new Uint8Array(0),
      water: new Uint8Array(0),
      rock: new Uint8Array(0),
      riverExit: '',
      startX: 0,
      startY: 0,
      climate: '',
      temperature: 0,
      rainfall: 0,
      levels: [],
    },
  };
  for (const system of sim.systems) world.systems[system.id] = { ...system.initialState };
  world.begunEvent = emit(world, sim.templates, 'world.begun', { data: { seed } });
  for (const system of sim.systems) system.init?.(contextFor(world, sim, system));
  return world;
}

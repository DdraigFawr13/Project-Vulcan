// The shape every engine system has: when it runs, which RNG stream it owns, which commands it
// handles. A system keeps its saved state in world.systems[id] as plain numbers.
import { streamFor } from '../core/index.ts';
import type { Command, EngineContent, RngStream, StreamName, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';
import { emit, type EventFields } from '../log/index.ts';
import type { Sim } from './world.ts';

export type Cadence = 'minute' | 'hour' | 'day' | 'month';

export interface SystemContext {
  world: WorldState;
  content: EngineContent;
  /** This system's own state, `world.systems[id]`. */
  state: Record<string, number>;
  /** This system's RNG stream; throws when the system declares none. */
  rng(): RngStream;
  emit(type: string, fields?: EventFields): number;
}

export interface System {
  id: string;
  every: Cadence;
  stream?: StreamName;
  /** Every event type it may emit; `createSim` checks each has a template before a tick runs. */
  emits?: readonly string[];
  initialState?: Readonly<Record<string, number>>;
  /** Keys of its state that hold ledger ids, so the seal keeps those lines as stubs. */
  refs?: readonly string[];
  /** The entity tables it owns, by kind, with their fields (`src/engine/entity/MODULE.md`). */
  tables?: Schemas;
  /** Runs once when a world is created from a seed, after `world.begun`, in list order; never
   * when a world is loaded from a save, which already holds what it laid out. */
  init?(ctx: SystemContext): void;
  run?(ctx: SystemContext): void;
  /** Handlers by command kind. `cause` is the `command.applied` event, for cause links. */
  commands?: Readonly<
    Record<string, (ctx: SystemContext, command: Command, cause: number) => void>
  >;
}

/** The view of the world a system's hooks get: its own state, its own dice, the ledger. */
export function contextFor(world: WorldState, sim: Sim, system: System): SystemContext {
  return {
    world,
    content: sim.content,
    // A world saved before this system existed gets its initial state on first use.
    state: (world.systems[system.id] ??= { ...system.initialState }),
    rng() {
      if (!system.stream) throw new Error(`System "${system.id}" has no RNG stream.`);
      return streamFor(world, system.stream);
    },
    emit: (type, fields) => emit(world, sim.templates, type, fields),
  };
}

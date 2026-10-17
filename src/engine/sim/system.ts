// The shape every engine system has: when it runs, which RNG stream it owns, which commands it
// handles. A system keeps its saved state in world.systems[id] as plain numbers.
import type { Command, EngineContent, RngStream, StreamName, WorldState } from '../core/index.ts';
import type { EventFields } from '../log/index.ts';

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
  run?(ctx: SystemContext): void;
  /** Handlers by command kind. `cause` is the `command.applied` event, for cause links. */
  commands?: Readonly<
    Record<string, (ctx: SystemContext, command: Command, cause: number) => void>
  >;
}

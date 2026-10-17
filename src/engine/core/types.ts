// World state and event shapes. The whole world is plain data (numbers, strings, arrays), so the
// worker can post it, P0.5 can save it and tests can compare it.
import type { RngState } from './rng';

/** The named RNG streams (docs/ARCHITECTURE.md "RNG"). A system draws only from its own. */
export const STREAMS = [
  'worldgen',
  'veins',
  'weather',
  'wildlife',
  'jobs',
  'needs',
  'health',
  'social',
  'beliefs',
  'magic',
  'combat',
  'threats',
  'storyteller',
  'trade',
] as const;
export type StreamName = (typeof STREAMS)[number];

export type EventData = Readonly<Record<string, string | number>>;

/** A ledger line (docs/ARCHITECTURE.md "Event log"). Causes are earlier event ids. */
export interface SimEvent {
  id: number;
  tick: number;
  type: string;
  actors: number[];
  subjects: number[];
  causes: number[];
  data: EventData;
}

/** A player lever, stamped with the tick it applies on. `asked` is the tick it was sent for. */
export interface Command {
  tick: number;
  asked: number;
  seq: number;
  kind: string;
  data: EventData;
}

export interface WorldState {
  seed: string;
  /** The last tick processed. One tick is one game minute. */
  tick: number;
  rng: Record<string, RngState>;
  nextEventId: number;
  nextCommandSeq: number;
  /** Every command ever submitted, in submission order: with the seed, it replays the game. */
  commandLog: Command[];
  /** Commands not yet applied, sorted by tick then seq. */
  pending: Command[];
  /** The ledger, oldest first. */
  log: SimEvent[];
  /** The `world.begun` event, the root cause of the calendar's lines. */
  begunEvent: number;
  /** State owned by systems, by system id. Plain data only. */
  systems: Record<string, Record<string, number>>;
}

/** The forked calendar (src/content/data/calendar.json). */
export interface CalendarDef {
  daysPerMonth: number;
  monthsPerYear: number;
  seasons: readonly string[];
  monthNames: readonly string[];
}

/** The content the engine core reads. The worker passes the content layer's `content`. */
export interface EngineContent {
  calendar: CalendarDef;
  events: readonly { id: string; template: string }[];
}

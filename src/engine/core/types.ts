// World state and event shapes. The whole world is plain data (numbers, strings, arrays and typed
// arrays), so the worker can post it, P0.5 can save it and tests can compare it.
import type { RngState } from './rng.ts';

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
  /** The surface map, owned by the map system. */
  map: MapState;
}

/** The surface map: one terrain index per tile, row by row (docs/ARCHITECTURE.md "Map"). */
export interface MapState {
  width: number;
  height: number;
  /** Index into `EngineContent.terrain.kinds`, at `y * width + x`. */
  tiles: number[];
  /** The id of the ledger line that last changed each tile, at `y * width + x` (the inspector's
   * "last changed"). */
  tileCauses: number[];
  /** One counter per 16 by 16 chunk, row by row; it goes up whenever a tile in the chunk changes. */
  chunkVersions: number[];
  /** Height above the sea in metres, at `y * width + x`. Set once by the generator. The
   * generator's layers are typed arrays: still plain data to a structured clone, at a fifth of
   * the size of number arrays. */
  elevation: Int16Array;
  /** Index into `EngineContent.biomes.biomes`, at `y * width + x`. */
  biomes: Uint8Array;
  /** How well the ground grows crops, 0 to 100, at `y * width + x`. */
  fertility: Uint8Array;
  /** What grows or lies on each tile: 0 for nothing, else 1 + an index into
   * `EngineContent.features`. */
  features: Uint8Array;
  /** Where the settlers' cart stops: the generator's chosen start tile. */
  startX: number;
  startY: number;
  /** The valley's climate, drawn once per seed: mean temperature (degrees C) on the valley floor
   * and yearly rainfall (mm). */
  climate: string;
  temperature: number;
  rainfall: number;
}

type Range = readonly number[];

/** Ground kinds, the surface map's size and the generator's dials (src/content/data/terrain.json). */
export interface TerrainDef {
  surface: { width: number; height: number; ground: string };
  generator: {
    climates: readonly {
      id: string;
      name: string;
      weight: number;
      temperature: Range;
      rainfall: Range;
    }[];
    elevation: { floor: Range; relief: Range; lapse: number; axisNoise: number };
    noise: { cell: number; octaves: number };
    rock: { wall: number; scree: number; outcrops: number; outcropCell: number };
    swampLowland: number;
    lowlandRain: number;
    groves: { cell: number; low: number; high: number };
    start: { radius: number; buildable: number; wood: number; stone: number };
  };
  floors: Readonly<Record<string, string>>;
  kinds: readonly {
    id: string;
    name: string;
    art: string;
    variants: number;
    buildable?: boolean;
    stone?: boolean;
  }[];
}

/** The forked biome table (src/content/data/biomes.json); only the fields the map reads. */
export interface BiomesDef {
  biomes: readonly { id: string; name: string; fertility: number; forest?: boolean }[];
  rules: {
    temperatureBands: readonly number[];
    rainfallBands: readonly number[];
    table: readonly (readonly string[])[];
    alpineElevation: number;
    swampRainfall: number;
    swampMinTemp: number;
  };
}

/** Trees, bushes, herbs and boulders (src/content/data/features.json). */
export interface FeatureDef {
  id: string;
  name: string;
  kind: 'tree' | 'bush' | 'herb' | 'boulder';
  art: string;
  yields: string;
  amount: number;
  blocks?: boolean;
  density: Readonly<Record<string, number>>;
  nearRock?: { reach: number; density: number };
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
  terrain: TerrainDef;
  biomes: BiomesDef;
  features: readonly FeatureDef[];
}

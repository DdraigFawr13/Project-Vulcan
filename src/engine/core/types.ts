// World state and event shapes. The whole world is plain data (numbers, strings, arrays and typed
// arrays), so the worker can post it, P0.5 can save it and tests can compare it.
import type { PeopleDefs } from './people.ts';
import type { AuraDials, AuraSpot, SeasonsDef, WeatherDef } from './climate.ts';
import type { FeatureDef, WalkingDef } from './ground.ts';
import type { BuildingsDef, ItemDef, JobDef, LifeDef, WorkDef } from './life.ts';
import type { RngState } from './rng.ts';
import type { CultureDef, NamesDef, RegionDef } from './region.ts';

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
  'people',
  'craft',
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

/** An older line the world still points at, kept after its day was sealed (ARCHITECTURE "Event
 * log"): enough for "why?" to end at "older record" with its date. The whole line is in the
 * day's segment. */
export interface Stub {
  id: number;
  tick: number;
  type: string;
}

/** A sealed day of the ledger, handed to the worker to archive. */
export interface SegmentRef {
  /** The game day its lines belong to, counted from 0 at tick 0. */
  day: number;
  /** Unique to these lines in this world: the seed, the id range and a digest of the lines. */
  key: string;
  first: number;
  last: number;
}

/** A sealed day with its lines as NDJSON, oldest first: the export format. */
export interface Segment extends SegmentRef {
  text: string;
}

/** One row of an entity table: its id and the fields its table declares (plain values only). */
export interface EntityRow {
  id: number;
  [field: string]: number | string | number[];
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
  /** The ledger's recent days in full, oldest first; older days are sealed into segments. */
  log: SimEvent[];
  /** Older lines still cited by the world, by rising id (sealed days keep no other trace here). */
  stubs: Stub[];
  /** The sealed days, oldest first, as archive keys: the save names its archive, never holds it. */
  segments: SegmentRef[];
  /** Days sealed since the worker last took them; empty between the worker's runs. */
  sealed: Segment[];
  /** Entity tables by kind, each row's id rising (DECISIONS V-027). */
  entities: Record<string, EntityRow[]>;
  /** The next entity id, shared by every kind, so an actor or subject id names one thing. */
  nextEntityId: number;
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
  /** 1 where rock lies under snow (colder than the snow line), else 0. The tile keeps its rock. */
  snow: Uint8Array;
  /** Which body of water each tile belongs to (`WATER` below), else 0. Set once by the generator. */
  water: Uint8Array;
  /** The rock each tile showed when the valley was made (1 + a terrain index), else 0. Set once by
   * the generator: it is what runs down into the levels below, whatever is dug on the surface. */
  rock: Uint8Array;
  /** The map edge the main river leaves by: north, south, east or west. */
  riverExit: string;
  /** Where the settlers' cart stops: the generator's chosen start tile. */
  startX: number;
  startY: number;
  /** The valley's climate, drawn once per seed: mean temperature (degrees C) on the valley floor
   * and yearly rainfall (mm). */
  climate: string;
  temperature: number;
  rainfall: number;
  /** The valley floor's height (m): temperatures are for it, colder with height above it. */
  floor: number;
  /** The faint background aura of each surface tile, 0 to `aura.base`. */
  aura: Uint8Array;
  /** The strong aura spots, surface ones from the start and level ones as they are reached. */
  auraSpots: AuraSpot[];
  /** Freezing degree-days on each still-water tile (the weather's ice count); 0 elsewhere. */
  ice: Uint8Array;
  /** What colonists have built on each surface tile (P3.1): 0 for nothing, else 1 + an index into
   * `EngineContent.buildings.parts`. A stair is a tile kind instead (it leads down). */
  built: Uint8Array;
  /** The levels below, index 0 for level 1 down: null until stairs or a shaft first reach one
   * (DECISIONS V-014), so a level nobody has reached costs no memory and no save space. */
  levels: (LevelState | null)[];
}

/** One level below the surface, the same size as it, made from the seed when first reached. */
export interface LevelState {
  /** Index into `EngineContent.terrain.kinds`, at `y * width + x`. */
  tiles: Uint8Array;
  /** The id of the ledger line that last changed each tile: at first, the line that reached it. */
  tileCauses: Int32Array;
  /** 0, or 1 + an index into `EngineContent.features` (a vein in the rock). */
  features: Uint8Array;
  /** One counter per chunk, as on the surface. */
  chunkVersions: number[];
}

/** The bodies of water in `MapState.water`, by their code: 0 is dry land. */
export const WATER = ['', 'stream', 'river', 'lake', 'spring'] as const;

export type Range = readonly number[];

/** How a valley's mountains are placed and shaped (terrain.json `generator.layouts`). */
export interface MountainLayout {
  count: Range;
  radius: Range;
  height: Range;
  rimShare: number;
  rim: Range;
  inside: number;
  /** The chance a mountain's long axis follows the valley's, so rim ranges run along the walls. */
  align: number;
  rough: Range;
  stretch: Range;
  warp: number;
  warpCell: number;
}

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
    moisture: { cell: number; low: number; span: number };
    ridges: { cell: number; weight: number };
    rocks: readonly { kind: string; weight: number }[];
    /** Which entry of `layouts` shapes the valley's mountains. */
    layout: string;
    /** Mountain layouts: `valley` (ranges along the rims) and `highlands` (massifs inside too). */
    layouts: Readonly<Record<string, MountainLayout>>;
    rock: {
      screeKind: string;
      /** The picture the renderer lays over snow-capped rock. */
      snowArt: string;
      snowline: number;
      /** Snow lies only on the highest `snowTop` share of the rock, so ranges keep bare flanks. */
      snowTop: number;
      /** Rock starts this many metres above the valley floor, within `wall` (shares of the map). */
      line: number;
      wall: Range;
      scree: number;
      outcrops: number;
      outcropCell: number;
    };
    valleyFloor: number;
    alpine: string;
    swamp: string;
    swampLowland: number;
    lowlandRain: number;
    groves: {
      cell: number;
      low: number;
      high: number;
      oldGrowth: { cell: number; share: number; factor: number };
      glades: { share: number; factor: number };
    };
    /** Rivers, streams, lakes and springs: see the schema in src/content/schemas-world.ts. */
    water: {
      tilt: number;
      jitter: number;
      meander: number;
      meanderCell: number;
      mountainFoot: number;
      mountainRain: number;
      floorRain: number;
      flowRain: number;
      streamFlow: number;
      riverFlow: number;
      /** Rivers three wide past `riverFlow` times this. */
      widenFlow: number;
      wideFlow: number;
      /** Squared reach of a wide river's disc. */
      wideReach: number;
      /** Width flow is scaled by swellMin + swellSpan times the swell noise. */
      swellMin: number;
      swellSpan: number;
      widthCell: number;
      lakeDepth: number;
      lakeArea: number;
      /** Metres of hollow a lake basin still spreads through. */
      basinDepth: number;
      lakeGrow: number;
      /** Equal to lakeDepth by design: a lake's floor past its seed depth is deep, its rim shallow. */
      deepDepth: number;
      bankCell: number;
      marshWet: number;
      marshBank: number;
      beachBank: number;
      hills: number;
      shallow: string;
      deep: string;
      spring: string;
      beach: string;
      marsh: string;
    };
    aura: AuraDials;
    /** The levels below (src/content/schemas-world.ts has the meaning of each dial). */
    underground: {
      depth: number;
      roots: { reach: number; perLevel: number; warp: number; fine: number };
      warpCell: number;
      bodies: { count: Range; bend: number; bendCell: number; fine: number; fineCell: number };
      earth: {
        soil: string;
        clay: string;
        groundwater: string;
        foot: number;
        footNoise: number;
        soilCell: number;
        clayReach: number;
        clayShare: number;
        wetShare: number;
      };
      caves: {
        kind: string;
        tunnels: Range;
        caverns: Range;
        length: Range;
        turn: number;
        swing: number;
        wide: number;
        cavernCell: number;
      };
      stairsDown: string;
      stairsUp: string;
      stairs: string;
      shaft: string;
    };
    start: {
      woodItem: string;
      stoneItem: string;
      radius: number;
      buildable: number;
      wood: number;
      stone: number;
    };
  };
  floors: Readonly<Record<string, string>>;
  kinds: readonly {
    id: string;
    name: string;
    art: string;
    variants: number;
    buildable?: boolean;
    stone?: boolean;
    water?: 'shallow' | 'deep';
    drinkable?: boolean;
    marker?: string;
    solid?: boolean;
    /** P2.3: walking cost per tile, 1 when left out (shallow water, marsh, scree slower). */
    walk?: number;
  }[];
  /** P2.3: how people walk (src/engine/paths). */
  walking: WalkingDef;
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
    /** Biomes that need frost-free winters, and what they become without them. */
    frostFree: { fallback: Readonly<Record<string, string>> };
  };
}

/** The forked calendar (src/content/data/calendar.json). */
export interface CalendarDef {
  daysPerMonth: number;
  monthsPerYear: number;
  seasons: readonly string[];
  monthNames: readonly string[];
}

/** The content the engine core reads. The worker passes the content layer's `content`. */
export interface EngineContent extends PeopleDefs {
  calendar: CalendarDef;
  /** `notable`: when a line is an alert and a skip stop (P2.6, log/notable.ts). */
  events: readonly { id: string; template: string; notable?: Readonly<Record<string, string>> }[];
  terrain: TerrainDef;
  biomes: BiomesDef;
  features: readonly FeatureDef[];
  weather: readonly WeatherDef[];
  seasons: SeasonsDef;
  /** The six schools of magic (forked schools.json): aura spots name theirs. */
  schools: readonly { id: string; name: string }[];
  /** The region around the valley (P1.5): its dials, and the forked cultures, races and names. */
  region: RegionDef;
  cultures: readonly CultureDef[];
  names: NamesDef;
  /** P2.2: needs, the daily round and the cart (life.json), and the forked items. */
  life: LifeDef;
  items: readonly ItemDef[];
  /** P2.4: the colony's work (work.json) and the forked jobs. */
  work: WorkDef;
  jobs: readonly JobDef[];
  /** P3.1 and P3.2: the parts colonists build (buildings.json). */
  buildings: BuildingsDef;
}

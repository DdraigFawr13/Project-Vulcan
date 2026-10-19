// The messages between the page and the simulation worker (docs/ARCHITECTURE.md "Worker protocol").
// Speed and pause are worker settings, not game commands, so they never enter the command log.
// Saving, exporting and the inspector's questions only read the world: answering them never
// steps it, writes a ledger line or draws from an RNG stream.
import type { Command, EventData, RegionSite, RegionValley } from '../engine/index.ts';
import type { SaveFile } from './save.ts';
import type { BuildView, HouseView, PieceView, PlanView, RoomView } from './protocol-build.ts';

/** 0 is paused; 1, 2 and 3 run 10, 30 and 100 game minutes a second. */
export type Speed = 0 | 1 | 2 | 3;
export const TICKS_PER_SECOND: Readonly<Record<Speed, number>> = { 0: 0, 1: 10, 2: 30, 3: 100 };

export type ToWorker =
  /** A plain seed rolls its region and offers its valleys (`picker`); a valley seed
   * (`<seed>/<n>`) begins that valley at once. */
  | { type: 'init'; seed: string; contentHash: string }
  /** Begins valley `site` (1 to 3) of the region on offer. */
  | { type: 'settle'; site: number }
  /** Asks for the running world's region map (the Region panel); a plain-seed world has none. */
  | { type: 'region' }
  /** Starts from a save instead of a seed and ends in the same state; a save that fails its
   * check is refused (`loadRefused`) and the running world carries on untouched. */
  | { type: 'load'; save: unknown }
  | { type: 'command'; tick: number; kind: string; data?: EventData }
  /** Any speed, pause included, also ends a skip. */
  | { type: 'setSpeed'; speed: Speed }
  /** Skip ahead (P2.7): run as fast as the device allows until a notable line, then pause. */
  | { type: 'skip' }
  /** The page asks once per screen frame, with at most one request waiting. */
  | { type: 'requestSnapshot' }
  /** Asks for the running world as a save; `auto` is echoed back for the page's autosave slot, and
   * `standby` for the copy the page holds to write at once if the tab closes. */
  | { type: 'save'; auto: boolean; standby?: boolean }
  /** The whole ledger as NDJSON. */
  | { type: 'export'; kind: 'ndjson' }
  /** The inspector: one tile's record on level `z` (0 the surface, 1 to 4 below) and the ledger
   * line that last changed it. */
  | { type: 'inspect'; x: number; y: number; z?: number }
  /** "why?": a ledger line's causes back to the world's first line. */
  | { type: 'why'; id: number };

/** The clock as the page shows it; the worker computes it from the tick and the content calendar. */
export interface ClockView {
  year: number;
  monthName: string;
  day: number;
  hour: number;
  minute: number;
  season: string;
}

/** One changed 16 by 16 chunk: its origin, level, size and terrain indices, row by row
 * (transferred). */
export interface ChunkView {
  x: number;
  y: number;
  /** 0 for the surface, 1 to 4 for the levels below. */
  z: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  /** 0 for a bare tile, else 1 + an index into content `features`. */
  features: Uint8Array;
  /** 1 where the rock is snow-capped; always 0 below the surface. */
  snow: Uint8Array;
  /** 1 where still water is frozen over; always 0 below the surface. */
  ice: Uint8Array;
  /** What is built on each tile (P3.1): 0 for nothing, else 1 + an index into content
   * `buildings.parts`; always 0 below the surface. */
  built: Uint8Array;
}

/** Today's weather in the valley, for the top bar. */
export interface WeatherView {
  /** The weather in words at today's temperature, e.g. "Snow falls". */
  words: string;
  /** Degrees C on the valley floor. */
  temperature: number;
}

/** A strong aura spot, for the map's glow: its school id and where it lies. */
export interface AuraView {
  school: string;
  x: number;
  y: number;
  z: number;
  strength: number;
}

/** A ledger line as the page shows it: the worker fills the text from content templates. */
export interface LedgerLine {
  id: number;
  tick: number;
  type: string;
  text: string;
  causes: number[];
  /** Whether "why?" has more to say than "the world began": false for world-generation lines. */
  why: boolean;
  clock: ClockView;
  /** An older line whose day is sealed: the "why?" chain and the tile's last change end here. */
  older?: true;
  /** Who the line is about (person ids), for a person's Ledger tab (P2.6). */
  actors?: number[];
  /** A notable line (content `events`): it goes in the alert feed, and skip ahead stops on it. */
  notable?: true;
  /** For a notable line about someone: where they stood as it was sent, and that place in words
   * ("at the camp", "12 tiles north of the camp"), for the alert feed and its Show button. */
  where?: { x: number; y: number; z: number; words: string };
}

/** How long ticks take (ms of worker time): mean and 95th percentile, and the slowest system. */
export interface TimingView {
  mean: number;
  p95: number;
  slowest: string;
  slowestMs: number;
}

/** One tile as the inspector shows it. */
export interface TileView {
  x: number;
  y: number;
  /** 0 for the surface, 1 to 4 below. */
  z: number;
  ground: string;
  /** Surface only, like elevation and fertility. */
  biome?: string;
  /** Metres above the sea. */
  elevation?: number;
  /** 0 to 100. */
  fertility?: number;
  /** The tile straight below: its ground, or that its level is not reached; absent on the deepest. */
  below?: string;
  /** The body of water the tile belongs to, e.g. "the river, flowing to the east edge". */
  water?: string;
  /** Whether the tile's water can be drunk; absent on dry land. */
  drinkable?: boolean;
  /** How the tile's water can be crossed, e.g. "can be waded"; absent on dry land. */
  crossing?: string;
  /** Surface only: degrees C at the tile today, colder with height. */
  temperature?: number;
  /** Surface water only: "frozen over" or "open water". */
  ice?: string;
  /** The tile's aura, e.g. "78, Mind (a spot: the still middle of a deep lake)" or "6 (faint)". */
  aura?: string;
  /** What grows or lies on the tile, with what it yields, e.g. "ash (25 logs)" or
   * "copper vein (20 copper ore)". */
  feature?: string;
  /** Where stairs or a shaft on the tile lead to a reached level; absent with no way up or down. */
  ways?: { up: boolean; down: boolean };
  chunkX: number;
  chunkY: number;
  /** The chunk's version: how many times a tile in it has been changed, plus one. */
  version: number;
  /** The line that last changed the tile, or its older record once its day is sealed. */
  changedBy?: LedgerLine;
  /** What lies on the tile (P2.4), e.g. "logs × 25", each with the line that made or brought it. */
  goods?: { text: string; made?: LedgerLine }[];
  /** Part of the store, with the line that set the tile up. */
  store?: { made?: LedgerLine };
  /** Test mode (`?debug`): a tree is marked here, a tree could be, or the store could take it. */
  marked?: true;
  tree?: true;
  open?: true;
  /** A part planned, built or to come down here (P3.1): see `PlanView`. */
  plan?: PlanView;
  /** The house or room this tile is part of (P3.7). */
  house?: HouseView;
  /** The room walls and a door close in around this tile (P3.3). */
  room?: RoomView;
  /** A piece of furniture planned or standing here (P3.4). */
  piece?: PieceView;
}

/** A tile spot, for the map's goods layer. */
export interface Spot3 {
  x: number;
  y: number;
  z: number;
}

/** What the map draws for goods (P2.4): items on the ground by art frame, the store's tiles and
 * test-mode marks. */
export interface GoodsView {
  items: (Spot3 & { frame: string })[];
  store: Spot3[];
  marks: Spot3[];
  /** Parts planned or to come down (P3.1), for the map's faint plan layer; built ones are in
   * the chunks' `built`. */
  plans: (Spot3 & { part: string; state: string; house: number })[];
  /** Furniture (P3.4): the art id and facing (the page picks the frame), planned ones faint. */
  furniture: (Spot3 & { art: string; facing: string; plan: boolean })[];
  /** Lit fires (P3.6) for the night's firelight: the glow's reach in tiles, dimmer when banked. */
  fires: (Spot3 & { radius: number; banked: boolean })[];
  /** Plans, parts and pieces someone is working now (P3.6): minutes done of the total, for the
   * progress bar. Apart from the lists above so the map redraws only when those change. */
  work: (Spot3 & { done: number; total: number })[];
}

/** One good's stock lever (P2.4): how much the colony has and wants, and the levels to pick. */
export interface StockView {
  good: string;
  name: string;
  have: number;
  want: number;
  level: string;
  levels: { id: string; word: string; count: number }[];
}

/** Yesterday's tally (P2.9): the date, logs felled, items carried into the store, berries
 * picked and food eaten. */
export interface YesterdayView {
  day: number;
  month: string;
  felled: number;
  hauled: number;
  picked: number;
  eaten: number;
}

/** The region map as the page draws it (engine `Region` less its cells). */
export interface RegionView {
  seed: string;
  width: number;
  height: number;
  /** Only the ranges written on the map, at their label cell. */
  ranges: { name: string; x: number; y: number }[];
  rivers: { name: string; path: (readonly [number, number])[] }[];
  sites: RegionSite[];
  valleys: RegionValley[];
  /** The fields `scale` times per cell: biome index into content biomes, height 0 to 255. */
  raster: { scale: number; width: number; height: number; biome: Uint8Array; height8: Uint8Array };
}

/** A valley on offer in the picker: the map its seed makes, in brief, with a thumbnail. */
export interface ValleyPreview {
  id: number;
  temperature: number;
  rainfall: number;
  /** The two commonest biomes with their shares, e.g. "grassland 44%". */
  biomes: string[];
  lakes: number;
  springs: number;
  /** The schools of its surface aura spots, by name. */
  aura: string[];
  /** Surface ground as terrain indices, biome indices, 1 where a tree stands, 1 under snow. */
  thumb: {
    width: number;
    height: number;
    tiles: Uint8Array;
    biomes: Uint8Array;
    trees: Uint8Array;
    snow: Uint8Array;
  };
}

/** A person as the page shows them (P2.1): words from content, numbers from their rows. */
export interface PersonView {
  id: number;
  name: string;
  race: string;
  raceName: string;
  cultureName: string;
  age: number;
  /** The settlement they came from ('' for a plain seed), how far and which way. */
  home: string;
  homeDays: number;
  homeDir: string;
  /** The trade's skill name. */
  trade: string;
  skills: { id: string; name: string; level: number; potential: number }[];
  /** Their three best skills, best first. */
  best: { id: string; name: string; level: number; potential: number }[];
  /** The band's must-have skills (building, cooking) they are able in. */
  able: string[];
  traits: { name: string; description: string }[];
  look: { hair: string; hairColour: string; clothes: string };
  x: number;
  y: number;
  z: number;
  /** The `people.arrived` line. */
  arrived: number;
}

/** One need or the mood as a bar (P2.2): filled to `share` %, the warning line at `line` %. */
export interface NeedView {
  name: string;
  share: number;
  line: number;
  /** The word for it now (Hungry, Fed, Content...); `low` while under its warning line. */
  word: string;
  low: boolean;
  /** The line that explains it, for "why?". */
  why: number;
  /** What feeds it now, in words (P3.5): "plain room", "own bedroom"; beauty and privacy only. */
  feeds?: string;
}

/** Where a person stands this tick (P2.3), sent with every snapshot so the screen can walk them,
 * with their mood, needs and what they are doing (P2.2) for the person panel. */
export interface WalkerView {
  id: number;
  x: number;
  y: number;
  z: number;
  mood: NeedView;
  needs: NeedView[];
  /** "Sleeping", "Eating", "Taking it easy"... */
  doing: string;
  /** The same in words from content (P2.9), with the line where they took the work up, if any. */
  now: { text: string; why?: number };
  /** Every skill with its level, potential and practice towards the next level, as a % (P2.5). */
  skills: { id: string; name: string; level: number; potential: number; practice: number }[];
  /** The Work sheet (P2.5): each kind of work, its level for them (1 first to 4 last) and word,
   * and the line where they declined it since it last changed. */
  work: {
    job: string;
    name: string;
    /** The skill the work uses, if any, for the sheet to show beside it. */
    skill?: string;
    level: number;
    word: string;
    declined?: number;
  }[];
}

export type FromWorker =
  | {
      type: 'ready';
      /** Whether the world began from a seed or was loaded from a save. */
      from: 'seed' | 'save';
      seed: string;
      contentHash: string;
      width: number;
      height: number;
      /** How many levels lie below the surface. */
      depth: number;
      /** The valley's name, or the seed for a world without a region. */
      place: string;
      /** Whether the world has not yet run a tick: the band has just arrived. */
      fresh: boolean;
      people: PersonView[];
    }
  | {
      type: 'snapshot';
      tick: number;
      /** The worker's clock (ms) up to which `tick` is run, so a rate can be timed without the
       * page's lag; not when it was sent, since a request answered before an overdue wake carries
       * that wake's ticks unrun. */
      at: number;
      speed: Speed;
      /** Skipping ahead; ends paused, on the tick that wrote a notable line. */
      skipping: boolean;
      /** The colony's day (P2.5): work from and until, and bedtime, in whole hours. */
      day: { workFrom: number; workTo: number; sleepFrom: number };
      clock: ClockView;
      /** Chunks changed since the last snapshot, on every reached level; the first one after
       * `ready`, and the first after a level is reached, carry all of that level's. */
      chunks: ChunkView[];
      /** Which levels below have been reached, index 0 for level 1. */
      reached: boolean[];
      weather: WeatherView;
      /** Every aura spot so far, on any reached level. */
      aura: AuraView[];
      /** Tick timing over the last 1,000 ticks run (P2.0), for the `?debug` line. */
      timing: TimingView;
      /** Everyone's place now (P2.3). */
      walkers: WalkerView[];
      /** Items, the store and marks (P2.4). */
      goods: GoodsView;
      stock: StockView[];
      /** The Build sheet's view (P3.7), when changed. */
      build?: BuildView;
      /** The day before's tally for the dawn page (P2.9); none on the first day. */
      yesterday?: YesterdayView;
    }
  /** New ledger lines in log order, posted just before the snapshot that follows them. */
  | { type: 'events'; batch: LedgerLine[] }
  | { type: 'saved'; auto: boolean; standby?: boolean; save: SaveFile; clock: ClockView }
  /** The save failed its check before anything was replaced; `reason` is shown to the player. */
  | { type: 'loadRefused'; reason: string }
  /** The ledger download: the archived days by key, oldest first, then the recent days' NDJSON. */
  | { type: 'exported'; kind: 'ndjson'; name: string; segments: string[]; text: string }
  /** Days the engine sealed since the last run, for the page to archive (P2.0). */
  | { type: 'segments'; items: { key: string; text: string }[] }
  | { type: 'inspected'; tile: TileView | undefined }
  /** The causes of line `id`, nearest first, each with its depth (1 is a direct cause). */
  | { type: 'causes'; id: number; lines: (LedgerLine & { depth: number })[] }
  /** The region of a plain seed and its valleys on offer, before any world begins. */
  | { type: 'picker'; seed: string; region: RegionView; valleys: ValleyPreview[] }
  /** The running world's region and which valley it settled; none for a world from a plain seed. */
  | { type: 'region'; region?: RegionView; site: number }
  /** The engine stopped. `commands` is the running world's whole command log, so the page can
   * add the levers given since its last standby copy to the rescue save. */
  | { type: 'error'; message: string; tick?: number; commands?: Command[] };

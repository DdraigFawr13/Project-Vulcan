// The messages between the page and the simulation worker (docs/ARCHITECTURE.md "Worker protocol").
// Speed and pause are worker settings, not game commands, so they never enter the command log.
// Saving, exporting and the inspector's questions only read the world: answering them never
// steps it, writes a ledger line or draws from an RNG stream.
import type { Command, EventData, RegionSite, RegionValley } from '../engine/index.ts';
import type { SaveFile } from './save.ts';

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
  | { type: 'setSpeed'; speed: Speed }
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
  chunkX: number;
  chunkY: number;
  /** The chunk's version: how many times a tile in it has been changed, plus one. */
  version: number;
  /** The line that last changed the tile, or its older record once its day is sealed. */
  changedBy?: LedgerLine;
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
    }
  | {
      type: 'snapshot';
      tick: number;
      /** The worker's clock when it sent this (ms), so a rate can be timed without the page's lag. */
      at: number;
      speed: Speed;
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

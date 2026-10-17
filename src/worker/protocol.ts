// The messages between the page and the simulation worker (docs/ARCHITECTURE.md "Worker protocol").
// Speed and pause are worker settings, not game commands, so they never enter the command log.
// Saving, exporting and the inspector's questions only read the world: answering them never
// steps it, writes a ledger line or draws from an RNG stream.
import type { EventData } from '../engine/index.ts';
import type { SaveFile } from './save.ts';

/** 0 is paused; 1, 2 and 3 run 10, 30 and 100 game minutes a second. */
export type Speed = 0 | 1 | 2 | 3;
export const TICKS_PER_SECOND: Readonly<Record<Speed, number>> = { 0: 0, 1: 10, 2: 30, 3: 100 };

export type ToWorker =
  | { type: 'init'; seed: string; contentHash: string }
  /** Starts from a save instead of a seed and ends in the same state; a save that fails its
   * check is refused (`loadRefused`) and the running world carries on untouched. */
  | { type: 'load'; save: unknown }
  | { type: 'command'; tick: number; kind: string; data?: EventData }
  | { type: 'setSpeed'; speed: Speed }
  /** The page asks once per screen frame, with at most one request waiting. */
  | { type: 'requestSnapshot' }
  /** Asks for the running world as a save; `auto` is echoed back for the page's autosave slot. */
  | { type: 'save'; auto: boolean }
  /** The whole ledger as NDJSON. */
  | { type: 'export'; kind: 'ndjson' }
  /** The inspector: one tile's record and the ledger line that last changed it. */
  | { type: 'inspect'; x: number; y: number }
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

/** One changed 16 by 16 chunk: its origin, size and terrain indices, row by row (transferred). */
export interface ChunkView {
  x: number;
  y: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  /** 0 for a bare tile, else 1 + an index into content `features`. */
  features: Uint8Array;
  /** 1 where the rock is snow-capped. */
  snow: Uint8Array;
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
}

/** One tile as the inspector shows it. */
export interface TileView {
  x: number;
  y: number;
  ground: string;
  biome: string;
  /** Metres above the sea. */
  elevation: number;
  /** 0 to 100. */
  fertility: number;
  /** What grows or lies on the tile, with what it yields, e.g. "ash (25 logs)". */
  feature?: string;
  chunkX: number;
  chunkY: number;
  /** The chunk's version: how many times a tile in it has been changed, plus one. */
  version: number;
  /** The line that last changed the tile; absent if it was trimmed from the ledger. */
  changedBy?: LedgerLine;
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
    }
  | {
      type: 'snapshot';
      tick: number;
      speed: Speed;
      clock: ClockView;
      /** Chunks changed since the last snapshot; the first one after `ready` carries them all. */
      chunks: ChunkView[];
    }
  /** New ledger lines in log order, posted just before the snapshot that follows them. */
  | { type: 'events'; batch: LedgerLine[] }
  | { type: 'saved'; auto: boolean; save: SaveFile; clock: ClockView }
  /** The save failed its check before anything was replaced; `reason` is shown to the player. */
  | { type: 'loadRefused'; reason: string }
  | { type: 'exported'; kind: 'ndjson'; name: string; text: string }
  | { type: 'inspected'; tile: TileView | undefined }
  /** The causes of line `id`, nearest first, each with its depth (1 is a direct cause). */
  | { type: 'causes'; id: number; lines: (LedgerLine & { depth: number })[] }
  | { type: 'error'; message: string };

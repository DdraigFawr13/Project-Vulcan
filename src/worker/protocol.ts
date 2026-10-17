// The messages between the page and the simulation worker (docs/ARCHITECTURE.md "Worker protocol").
// Speed and pause are worker settings, not game commands, so they never enter the command log.
import type { EventData, SimEvent } from '../engine/index.ts';

/** 0 is paused; 1, 2 and 3 run 10, 30 and 100 game minutes a second. */
export type Speed = 0 | 1 | 2 | 3;
export const TICKS_PER_SECOND: Readonly<Record<Speed, number>> = { 0: 0, 1: 10, 2: 30, 3: 100 };

export type ToWorker =
  | { type: 'init'; seed: string; contentHash: string }
  /** Reserved for P0.5: starts from a save instead of a seed and ends in the same state. */
  | { type: 'load'; save: unknown }
  | { type: 'command'; tick: number; kind: string; data?: EventData }
  | { type: 'setSpeed'; speed: Speed }
  /** The page asks once per screen frame, with at most one request waiting. */
  | { type: 'requestSnapshot' }
  /** Reserved for P0.5: NDJSON ledger export. */
  | { type: 'export'; kind: 'ndjson' };

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
}

export type FromWorker =
  | {
      type: 'ready';
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
  | { type: 'events'; batch: SimEvent[] }
  | { type: 'error'; message: string };

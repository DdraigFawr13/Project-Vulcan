// Messages between the UI thread and the simulation worker.

import type { Colony, Colonist, SimEvent } from '../engine/index.ts';

export const SPEEDS = [1, 2, 5, 10] as const;
export type Speed = (typeof SPEEDS)[number];

/** Ticks per real second at speed 1: one game hour a second, a day every 24 seconds. */
export const BASE_TICKS_PER_SECOND = 10;

export type ToWorker =
  | { type: 'init'; seed: string }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'speed'; speed: Speed }
  | { type: 'step'; ticks: number }
  | { type: 'export' };

export interface LoggedEvent extends SimEvent {
  text: string;
}

export interface ColonistView extends Colonist {
  activity: string;
}

export type FromWorker =
  | {
      type: 'world';
      seed: string;
      width: number;
      height: number;
      terrain: Uint8Array;
    }
  | {
      type: 'frame';
      tick: number;
      running: boolean;
      speed: Speed;
      colonists: ColonistView[];
      colony: Colony;
      feature: Uint8Array;
      amount: Uint8Array;
      /** Events since the previous frame, oldest first. */
      events: LoggedEvent[];
      eventCount: number;
    }
  | { type: 'export'; seed: string; ndjson: string };

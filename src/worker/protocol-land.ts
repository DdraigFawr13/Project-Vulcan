// The known map's views (6W Slice 6, V-213): the flags on found places, a find's tile page and the
// Ledger's Trips tab. Words from the worker; the page decides nothing (GAME-02).
import type { LedgerLine } from './protocol.ts';

/** A found place's flag on the surface. */
export interface FindMark {
  x: number;
  y: number;
}

/** A found place's rows on its tile page: "A wood", then find, found by, when and worked. */
export interface FindView {
  title: string;
  rows: [key: string, value: string][];
  /** The line that told of it. */
  line?: LedgerLine;
}

/** One trip: who went for what and how it stands, then its lines, oldest first; a camp's or a
 * find's line says where, for its Show button (the camera only). */
export interface TripView {
  /** "Edwin, for wood · home". */
  title: string;
  /** "Out 25 hours, 1 night camped · told of a wood". */
  sub: string;
  lines: (LedgerLine & { at?: { x: number; y: number } })[];
}

/** The Trips tab: whether anyone is out (or what sends a scout), then each trip, newest first. */
export interface TripsView {
  head: string;
  trips: TripView[];
}

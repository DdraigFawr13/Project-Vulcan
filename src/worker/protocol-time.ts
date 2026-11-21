// The player's clock (Phase 6T, V-191): speeds, jumps, what stops play and the recaps. Settings of
// the worker, never game commands, so none enters the command log (V-041).
import type { LedgerLine } from './protocol.ts';

/** 0 is paused; 1 to 6 run 10, 30, 100, 200, 400 and 800 game minutes a second. */
export type Speed = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const TICKS_PER_SECOND: Readonly<Record<Speed, number>> = {
  0: 0,
  1: 10,
  2: 30,
  3: 100,
  4: 200,
  5: 400,
  6: 800,
};
/** The running speeds, slowest first. */
export const SPEEDS = [1, 2, 3, 4, 5, 6] as const;

/** Next event runs to the next line set to Pause or Slow; the others to the first day of the next
 * month, season or year at 00:00, stopping early only on a Pause line. */
export type JumpSpan = 'next' | 'month' | 'season' | 'year';

/** What a notable line of a kind does to the clock: Pause stops it, Slow drops it to 1× and leaves
 * it there, Note only adds the line to the alerts. */
export type StopAct = 'pause' | 'slow' | 'note';

/** The player's setting per stop kind (content `stops`); a kind left out keeps its default. */
export type StopSettings = Readonly<Record<string, StopAct>>;

/** A jump under way: where it lands in words, and for a span how far it has come (0 to 1). */
export interface JumpView {
  span: JumpSpan;
  to: string;
  done?: number;
}

/** Where each jump would land from now: "1 Seedmonth", "1 Highsun, summer", "1 Thawmonth, Year 2". */
export interface LandingsView {
  month: string;
  season: string;
  year: string;
}

/** Which recaps pause play and open (V-191): the page's device switches, both on by default. */
export interface RecapSettings {
  season: boolean;
  year: boolean;
}

/** A recap as the page shows it (slice 3): the line above its title, the title, and its sections
 * in order, each with a heading (none for a year's season paragraphs) and sentences, each sentence
 * with the ledger lines it tells, for "why?". */
export interface RecapView {
  id: number;
  kind: 'season' | 'year';
  kicker: string;
  title: string;
  sections: { id: string; head?: string; sentences: { text: string; lines: LedgerLine[] }[] }[];
}

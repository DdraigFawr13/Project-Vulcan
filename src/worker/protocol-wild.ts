// The wire shapes of the wild valley (Phase 5A Bundle 2), split from protocol.ts: the animals the
// map draws, the page an animal opens, and the leftovers the Stock sheet counts.
import type { LedgerLine } from './protocol.ts';

/** A live animal on the surface, sent when any of them moves (like the walkers, V-110). */
export interface AnimalView {
  id: number;
  /** The art kind: `animal.<kind>.<e|w>.<0|1>`. */
  kind: string;
  x: number;
  y: number;
  facing: 'e' | 'w';
  /** On its way somewhere or running: the walk frames play. */
  moving: boolean;
}

/** The page of an animal's herd or of the predator pack, all words from the worker (GAME-02). */
export interface AnimalPage {
  id: number;
  /** "Red deer", "Wolf". */
  title: string;
  /** The line under the title: where the herd lies, or whose pack it is. */
  who: string;
  rows: [string, string][];
  /** Its last two lines, newest first, each with "why?". */
  lines: LedgerLine[];
}

/** What the kill leaves in the store (Stock sheet's Leftovers block) and the game and fish that
 * count as food. */
export interface LeftoversView {
  items: { item: string; name: string; have: number }[];
  game: number;
  fish: number;
}

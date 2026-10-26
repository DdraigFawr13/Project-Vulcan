// The wire shapes of what the map draws for goods, the Stock sheet (P2.4 onward), the metal works' tile pages and
// the item page (Bundle 3), split from protocol.ts.
import type { LedgerLine } from './protocol.ts';

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
  /** Rooms with a candle burning this minute (P5.13): the box round their tiles, for the glow. */
  lit: { x: number; y: number; w: number; h: number }[];
  /** Plans, parts and pieces someone is working now (P3.6): minutes done of the total, for the
   * progress bar, and who works it when it is a person's job (two cooks may share a hearth).
   * Apart from the lists above so the map redraws only when those change. */
  work: (Spot3 & { done: number; total: number; by?: number })[];
  /** Field tiles (P4.7) grouped by the art frame they show (planned, sown, ripe, fallow), as
   * tile indices (y * width + x); level 0 only. */
  fields: { frame: string; tiles: number[] }[];
  /** Shaft plans (planned or being sunk) on the surface, for the map's faint plan layer. */
  shafts: (Spot3 & { state: string })[];
  /** Bee skeps (P5.13): planned (`plan`), `empty` or with `bees`; drawn as `skep.<state>`. */
  skeps: (Spot3 & { state: string })[];
  /** Middens the colony sited (Bundle 2), drawn as `site.midden`. */
  middens: Spot3[];
  /** Graves (P5.8): dug until the day's end, then filled, with a marker or not; surface only. */
  graves: (Spot3 & { dug: boolean; marker: boolean })[];
  /** The burial ground's rectangle, for its hurdle edge. */
  burial: { x: number; y: number; w: number; h: number }[];
}

/** One good's stock lever (P2.4): how much the colony has and wants, and the levels to pick. */
export interface StockView {
  good: string;
  name: string;
  have: number;
  want: number;
  level: string;
  levels: { id: string; word: string; count: number }[];
  /** What the good is for, from content, shown under its plate. */
  note?: string;
  /** An ingot plate's line: what that metal is waiting on now. */
  status?: string;
  /** Which stores keep the good (5B Bundle 1), e.g. "Kept in the wood yard (9 tiles)." */
  kept?: string;
}

/** A tile page for the smelter, the charcoal clamp or the smithy (Bundle 3): words from the engine. */
export interface WorksView {
  /** "Smelter", "Charcoal clamp" or "Smithy". */
  name: string;
  /** What it is, why it lies here, what it makes and the like, key and value. */
  rows: [string, string][];
  /** Who is working it and what they are doing, with the line they took the work up at. */
  doing?: { who: string; text: string; why?: number } | undefined;
  /** Its lines, labelled "Built", "Planned", "Waiting". */
  lines: { label: string; line: LedgerLine }[];
  /** The mill (5B Bundle 4): its id, for its one Send back while nothing on it is built. */
  back?: number;
}

/** One step of an item's "Made from": the words before a tile button, the button, and the rest. */
export interface ItemStep {
  /** How far in: 0 for the last step before the item, deeper for what went into it. */
  depth: number;
  text: string;
  /** The mined step's tile, for a view-only button that centres the map on it (no command). */
  tile?: { x: number; y: number; z: number; label: string };
  after?: string;
}

/** The item page (P4.6): a tool or an ingot stack, and where it came from. */
export interface ItemView {
  id: number;
  /** "Fine iron axe", "Bronze ingots". */
  name: string;
  facts: [string, string][];
  steps: ItemStep[];
  /** The line that made or laid it, for "why?". */
  made?: LedgerLine;
}

/** A store tile's rows (5B Bundle 1): its name, what it takes, how full, and its lines. */
export interface StoreView {
  name: string;
  takes: string;
  holds: string;
  /** Food spoiled (P5.12): "this week so far 3 · weeks before 7, 11, 4". */
  spoiled?: string;
  made?: LedgerLine;
  built?: LedgerLine;
}

// The wire shapes of plans, houses, rooms and the Build sheet (P3.1, P3.7, P3.3, P3.8), split from protocol.ts.
import type { LedgerLine } from './protocol.ts';

/** A tile's house (P3.7): its name, why the colony chose the site, and whether it can be sent back. */
export interface HouseView {
  id: number;
  /** "cottage", or "cottage's second room". */
  name: string;
  /** `plan` or `built`. */
  state: string;
  /** The reason for the site, from the engine. */
  why: string;
  /** The plan can still be sent back: planned, never sent back before, nothing built on it. */
  back: boolean;
  /** "thatch, laid with the walls" while planned, "thatch (not drawn)" once built (V-056). */
  roof: string;
  /** The line that sited it; its "why?" leads to the need. */
  sited?: LedgerLine;
}

/** A room as the engine works it out (P3.3), each value in words. */
export interface RoomView {
  name: string;
  tiles: number;
  role: string;
  beauty: string;
  impressiveness: string;
  beds: string;
  /** "Warm, 14 °C · no hearth" (P3.6): the felt temperature at the tile and the room's hearth. */
  warmth: string;
}

/** A house or a room added to one, for the Build sheet and the map (P3.7, P3.8). */
export interface BuildRow {
  id: number;
  /** "cottage", or "cottage's second room". */
  name: string;
  /** The size's name: "cottage", or "room" for an added room. */
  size: string;
  /** `plan` or `built`. */
  state: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The house a room was added to; 0 for a house. */
  of: number;
  beds: number;
  /** Where it lies from the green: "west", "north-east". */
  dir: string;
  back: boolean;
  /** It replaced a plan sent back, so it cannot be sent back itself. */
  sent: boolean;
  why: string;
  /** Material brought and needed, per good. */
  mats: { good: string; have: number; cost: number }[];
}

/** A field on the Build sheet (P4.7): what the colony laid out, never a tile to pick (V-049). */
export interface FieldRow {
  id: number;
  /** "Barley field", or "Field" while no crop is chosen. */
  name: string;
  tiles: number;
  /** `plan`, `sown`, `ripe` or `fallow`, and the same in words ("planned", "sown", "ripe"). */
  state: string;
  words: string;
  /** Where it lies from the green: "east", "south-west". */
  dir: string;
  /** It can still be sent back: planned, nothing sown, not itself a replacement. */
  back: boolean;
  /** It replaced a plan sent back. */
  sent: boolean;
  why: string;
}

/** A tile's field (P4.7): each value in words from the engine's answers, for the tile page. */
export interface FieldView {
  id: number;
  name: string;
  /** "barley, ripe". */
  crop: string;
  /** "36 tiles, 18 tiles east of the green". */
  size: string;
  /** Sowing, growing or reaping progress, and what it will yield. */
  harvest: string;
  /** The seed kept back or still to be. */
  seed: string;
  /** What a frost does to it. */
  frost: string;
  /** Who is sowing or reaping it now. */
  here?: string;
  /** The reason it lies there. */
  why: string;
  /** Lines behind it: its latest, the taking up of its work and the one that laid it out. */
  last?: LedgerLine;
  took?: LedgerLine;
  sited?: LedgerLine;
}

/** The Build sheet (P3.7): the Houses level, the need, the green and every house and room; since
 * P4.7 also the Fields level, its need in tiles and every field. */
export interface BuildView {
  /** The Fields level (1 first to 4 last) and its word. */
  fieldWant: { level: number; word: string };
  /** "food for five through winter, about 60 tiles of crops. 36 laid out, 12 planned". */
  fieldNeed: string;
  /** No good soil outside the town ring fits a field. */
  noField: boolean;
  fields: FieldRow[];
  green: { x: number; y: number };
  want: { level: number; word: string };
  /** "5 people sleep under the open sky", or "none now". */
  need: string;
  /** No ground near the green fits a house. */
  noGround: boolean;
  houses: BuildRow[];
}

/** A tile of a part (P3.1, P3.2): what it is, how far it has got, who is on it and why. */
export interface PlanView {
  /** The part's content id and name, e.g. `wall-stone`, "stone wall". */
  part: string;
  name: string;
  /** `plan` (to build), `built`, or `down` (to come down). */
  state: string;
  /** Material brought, of the part's cost, and the material's name. */
  have: number;
  cost: number;
  good: string;
  /** The person building it or taking it down, and what they are doing now. */
  builder?: string;
  doing?: string;
  /** The plan's line (placed, or ordered down), and the line it was built under. */
  placed?: LedgerLine;
  built?: LedgerLine;
  /** The alert saying it waits: for material, or because the wall would shut someone in. */
  waiting?: LedgerLine;
}

/** A piece of furniture on a tile (P3.4, P3.5), each value in words from the engine's answers. */
export interface PieceView {
  /** The kind's content id and name, e.g. `bed`, "bed". */
  kind: string;
  name: string;
  /** `plan` while it is being made, `built` once it stands. */
  state: string;
  /** "plain, made by Brennwen": the quality word and the maker (built only). */
  quality?: string;
  /** A bed's owner: "Pedr's bed", or "nobody yet". */
  owner?: string;
  /** What it adds to its room's beauty: "0 to the room". */
  beauty?: string;
  /** A bed's rest against a bedroll. */
  rest?: string;
  /** A bed's privacy: "Pedr sleeps alone here", "3 sleep here". */
  privacy?: string;
  /** Planned: material brought, "2 of 4 logs here", its name ("logs", "stone"), and who is making
   * it and what they are doing. */
  wood?: string;
  good?: string;
  maker?: string;
  /** The bench (built): what it is making, who is at it and what comes next, and why. */
  bench?: { making: string; maker: string; next: string };
  /** A built hearth's fire (P3.6): where it is, whether it is lit, banked or out, its fuel left,
   * what it warms, and the line of its last change with a word for it. */
  fire?: {
    where: string;
    state: string;
    fuel: string;
    reach: string;
    last?: LedgerLine;
    lastLabel?: string;
  };
  /** The lines behind it: placed, made, and a bed's claiming. */
  placed?: LedgerLine;
  made?: LedgerLine;
  claimed?: LedgerLine;
}

/** A shaft plan on a tile (Bundle 2): each value in words from the engine's answers, for the tile page. */
export interface ShaftView {
  id: number;
  /** `planned` or `sinking`. */
  state: string;
  /** "a shaft with a ladder, down to level 3". */
  what: string;
  /** The reason it lies there, kept with the plan. */
  why: string;
  /** "about 4 hours a level, 12 in all, by whoever takes up Mining; 2 logs for the ladder". */
  work: string;
  /** Who is sinking it now. */
  here?: string;
  /** It can still be sent back: planned, not started, not itself a replacement. */
  back: boolean;
  /** The line that planned it; its "why?" leads to the plate. */
  placed?: LedgerLine;
}

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

/** The Build sheet (P3.7): the Houses level, the need, the green and every house and room. */
export interface BuildView {
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

// Ground definitions the map and the paths read: what lies on a tile, and how people cross it.
import type { Range } from './types.ts';

/** Trees, bushes, herbs and boulders (src/content/data/features.json). */
export interface FeatureDef {
  id: string;
  name: string;
  kind: 'tree' | 'bush' | 'herb' | 'log' | 'boulder' | 'vein';
  art: string;
  yields: string;
  amount: number;
  blocks?: boolean;
  clumps?: boolean;
  glades?: boolean;
  density: Readonly<Record<string, number>>;
  nearRock?: { reach: number; density: number };
  vein?: {
    level: number;
    per10k: number;
    size: Range;
    rocks: Readonly<Record<string, number>>;
    /** The colour word of its seam where it shows in a rock face ("rust", V-215); a vein
     * without one is never prospected for. */
    seam?: string;
  };
}

/** How people walk (terrain.json `walking`, P2.3): costs in tenths of a straight step. */
export interface WalkingDef {
  /** Stride gained per tick: 10 walks one straight tile of plain ground a game minute. */
  speed: number;
  /** A straight and a diagonal step on plain ground; a kind's `walk` multiplies them. */
  straight: number;
  diagonal: number;
  /** Climbing a flight of stairs, or a shaft's ladder, one level. */
  stairs: number;
  shaft: number;
  /** The `walk` of frozen lake water, which can be crossed while it holds. */
  ice: number;
  /** P5.10: a step on a road, in tenths of the step on plain ground. */
  road: number;
  /** Minutes a step through water nobody can stand in, out from where the ice melted under them. */
  wade: number;
}

/** P5.10 footfall (src/content/schemas-town.ts has the meaning of each dial; map/wear.ts). */
export interface WearDef {
  fade: number;
  stages: readonly number[];
  words: readonly string[];
  kinds: readonly string[];
}

/** P5.10 the Roads row (src/content/schemas-town.ts has the meaning of each dial). */
export interface RoadsDef {
  name: string;
  start: number;
  part: string;
  stretch: number;
  least: number;
  shortest: number;
  places: number;
}

/** The levels below (src/content/schemas-world.ts has the meaning of each dial). */
export interface UndergroundDials {
  depth: number;
  roots: { reach: number; perLevel: number; warp: number; fine: number };
  warpCell: number;
  bodies: { count: Range; bend: number; bendCell: number; fine: number; fineCell: number };
  earth: {
    soil: string;
    clay: string;
    groundwater: string;
    foot: number;
    footNoise: number;
    soilCell: number;
    clayReach: number;
    clayShare: number;
    wetShare: number;
  };
  caves: {
    kind: string;
    tunnels: Range;
    caverns: Range;
    length: Range;
    turn: number;
    swing: number;
    wide: number;
    cavernCell: number;
  };
  /** The most tiles one opening shows at once (V-030). */
  reveal: number;
  /** The picture of unknown ground below the surface (the renderer lays `<art>.1`). */
  fogArt: string;
  stairsDown: string;
  stairsUp: string;
  stairs: string;
  shaft: string;
}

/** A store kind (V-129): the goods it takes, its footprint and parts, and its line's words. */
export interface StoreKindDef {
  id: string;
  name: string;
  /** The goods in a line ("grain and seed"). */
  words: string;
  goods: readonly string[];
  w: number;
  h: number;
  /** The edge's part; none: the house wall rule (the most plentiful wall material). */
  wall?: string;
  /** The way in; none: a gap in the edge. */
  door?: string;
  floor?: string;
  from: string;
  to: string;
  /** Food: eating counts as using it at the home store. */
  eaten?: boolean;
  /** Dug one level under its larder, not sited on the surface (keep/cellar.ts). */
  below?: boolean;
}

/** How stores by kind are sited (build/stores.ts, goods/trips.ts). */
export interface StoresDef {
  days: number;
  save: number;
  near: number;
  /** How far from the green a store of an eaten kind may stand: food is eaten where it is kept. */
  eatenNear: number;
  most: number;
  apart: number;
  tries: number;
  kinds: readonly StoreKindDef[];
}

/** How rich the valley is and how its woods come back (terrain `generator.riches` and `regrow`;
 * src/content/schemas-ground.ts VALLEY_DIALS has the meaning of each dial). */
export interface ValleyDials {
  riches: {
    /** Shares of the usual density, drawn by weight; the first is poor, the last rich. */
    levels: readonly { share: number; weight: number }[];
    goods: readonly {
      id: string;
      yields?: readonly string[];
      veins?: boolean;
      rich: string;
      poor: string;
    }[];
  };
  regrow: { years: number; near: number };
  known: {
    sight: number;
    high: number;
    height: number;
    arrive: number;
    place: number;
    least: number;
  };
}

/** How a valley's mountains are placed and shaped (terrain.json `generator.layouts`). */
export interface MountainLayout {
  count: Range;
  radius: Range;
  height: Range;
  rimShare: number;
  rim: Range;
  inside: number;
  /** The chance a mountain's long axis follows the valley's, so rim ranges run along the walls. */
  align: number;
  rough: Range;
  stretch: Range;
  warp: number;
  warpCell: number;
}

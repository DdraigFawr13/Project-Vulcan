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
    near: number;
    rocks: Readonly<Record<string, number>>;
    /** Marks the surface above the vein with a stain (V-087). */
    stain?: boolean;
    /** The stain's colour on the surface, a #rrggbb string. */
    stainColour?: string;
    /** The stain's colour in words for the tile page ("rust"). */
    stainWord?: string;
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
  /** How much of its brightness a vein keeps when it glints through unknown ground (0 to 1). */
  fogVein: number;
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

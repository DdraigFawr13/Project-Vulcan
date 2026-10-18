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
}

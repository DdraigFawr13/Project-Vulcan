// The content the region around the valley reads (src/content/schemas-region.ts and the forked
// cultures, races and names files), for the lighter world map (P1.5, src/engine/region).

type Range = readonly number[];

/** The forked cultures (cultures.json): what the region's sites and names come from. */
export interface CultureDef {
  id: string;
  name: string;
  raceId: string;
  government: string;
  religion: { name: string };
  preferredBiomes: readonly string[];
  /** river, heights, plains, forest, deposit, aura, coast. */
  sitePreferences: readonly string[];
  names: {
    placeStarts: readonly string[];
    placeMiddles: readonly string[];
    placeEnds: readonly string[];
  };
}

/** The forked geographic names (names.json): syllables from every culture and name patterns. */
export interface NamesDef {
  starts: readonly string[];
  middles: readonly string[];
  ends: readonly string[];
  adjectives: readonly string[];
  patterns: Readonly<Record<string, readonly string[]>>;
}

/** Vulcan's region dials (region.json). */
export interface RegionDef {
  grid: { width: number; height: number };
  noise: {
    height: number;
    detail: number;
    rain: number;
    detailWeight: number;
    floor: number;
    stretch: number;
  };
  warmth: { north: Range; span: number; lapse: number; from: number };
  rain: { base: number; span: number; west: number };
  lake: number;
  mountain: number;
  alpine: number;
  rivers: { count: number; sources: number; minLength: number; apart: number; twist: number };
  ranges: { min: number; label: number };
  valleys: {
    count: number;
    inset: number;
    spacing: number;
    walls: number;
    reach: number;
    low: Range;
    dry: number;
  };
  sites: { count: Range; inset: number; spacing: number; near: number };
  daysPerCell: number;
  kinds: Readonly<Record<string, string>>;
  vales: readonly string[];
}

// The content the region around the valley reads (src/content/schemas-region.ts and the forked
// cultures, races and names files), for the region map (P1.5, src/engine/region) over the Story
// Generator's world (P1.6).

type Range = readonly number[];

/** The forked cultures (cultures.json): what the region's sites and names come from. */
export interface CultureDef {
  id: string;
  name: string;
  raceId: string;
  government: string;
  /** What the people value, 0 to 10 (`kin` weighs on strangers, P5.9). */
  values: Readonly<Record<string, number>>;
  religion: { name: string };
  preferredBiomes: readonly string[];
  /** river, heights, plains, forest, deposit, aura, coast. */
  sitePreferences: readonly string[];
  names: {
    givenStarts: readonly string[];
    givenEnds: readonly string[];
    /** Whole given names by sex (`f`, `m`), where the tongue has its own. */
    givenNames?: Readonly<Record<string, readonly string[]>>;
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
  world: {
    size: number;
    years: number;
    frame: Range;
    land: number;
    metres: number;
    warp: number;
    tries: number;
    apart: number;
    races: Readonly<Record<string, string>>;
  };
  mountain: number;
  rivers: { count: number; minLength: number };
  ranges: { label: number };
  valleys: {
    count: number;
    inset: number;
    spacing: number;
    clear: number;
    walls: number;
    reach: number;
    low: Range;
    dry: number;
  };
  sites: { count: Range; inset: number; near: number };
  history: { importance: number; length: number };
  daysPerCell: number;
  kinds: Readonly<Record<string, string>>;
  vales: readonly string[];
  valesBy: Readonly<Record<string, readonly string[]>>;
}

// The content the weather and aura spots read (src/content/schemas-climate.ts and the `aura` dials
// in terrain.json), and the aura spots kept in the map.

/** A forked weather kind (src/content/data/weather.json). */
export interface WeatherDef {
  id: string;
  name: string;
  seasonWeights: Readonly<Record<string, number>>;
}

/** Vulcan's seasons file: how the weather kinds play out day by day. */
export interface SeasonsDef {
  months: readonly number[];
  change: number;
  jitter: number;
  rainfall: number;
  kinds: readonly {
    weather: string;
    shift: number;
    wet: number;
    words: readonly { below: number; words: string }[];
  }[];
  snowMelt: number;
  snowShare: number;
  /** Freezing degree-days a lake's shallow and deep tiles need to freeze; running water (V-150)
   * freezes later: `stream` and `river` tiles need their own counts. Springs never freeze. */
  ice: {
    shallow: number;
    deep: number;
    stream: number;
    river: number;
    thaw: number;
    cap: number;
    over: number;
  };
}

export type AuraSite = 'peak' | 'spring' | 'wood' | 'lake' | 'cavern' | 'obsidian';

/** terrain.json `generator.aura`. */
export interface AuraDials {
  base: number;
  cell: number;
  strength: readonly number[];
  radius: number;
  falloff: number;
  count: readonly number[];
  spacing: number;
  margin: number;
  peakShare: number;
  wood: { reach: number; trees: number };
  lake: number;
  cavern: { reach: number; open: number };
  deepLevel: number;
  sites: readonly { site: AuraSite; school: string; words: string; deep?: boolean }[];
}

/** A place of strong aura: its school, the kind of place, where, and its strength at the middle. */
export interface AuraSpot {
  school: string;
  site: AuraSite;
  x: number;
  y: number;
  z: number;
  strength: number;
}

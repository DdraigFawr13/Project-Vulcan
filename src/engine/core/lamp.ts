// What the lamp reads from content (lamp.json, P5.13, V-075, V-135).

export interface LampDef {
  /** First light and dusk, hours of the day, at the middle of each month. */
  daylight: readonly (readonly number[])[];
  /** Work that goes on in the dark, by a fire's dim light, or only by a candle in its room. */
  dark: readonly string[];
  dim: readonly string[];
  candle: readonly string[];
  /** The furniture kind a candle trade works at, whose room is lit. */
  at: Readonly<Record<string, string>>;
  /** What burns, first to last, and the minutes of work one lights. */
  candles: readonly { item: string; name: string; minutes: number }[];
  /** The candles the band brings, kept with the cart. */
  cart: { item: string; count: number };
  chandler: ChandlerDef;
  /** A lit fire leaves one ash `item` beside its hearth each `every` minutes it burns. */
  ash: { item: string; every: number };
  bees: BeesDef;
}

export interface ChandlerDef {
  job: string;
  minutes: number;
  skilled: number;
  /** First wanted, first made: each takes `from` and makes `makes` (item kinds and counts). */
  recipes: readonly {
    id: string;
    from: Readonly<Record<string, number>>;
    makes: Readonly<Record<string, number>>;
  }[];
  soap: { item: string; keep: number; washes: number; fester: number };
}

export interface BeesDef {
  job: string;
  stand: number;
  woods: number;
  skep: { minutes: number; months: readonly string[] };
  swarm: { months: readonly string[]; chance: number };
  harvest: { month: string; honey: number; wax: number; minutes: number };
}

export interface LampDefs {
  lamp: LampDef;
}

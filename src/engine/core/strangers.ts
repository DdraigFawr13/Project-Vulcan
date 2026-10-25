// What homes and strangers read from content (strangers.json, Phase 5 Bundle 4, P5.9, P5.14).
// Rates are percents, days game days.

/** A reason a neighbour sends someone, read from its record. */
export interface StrangerKindDef {
  id: string;
  name: string;
  /** "has gone hungry", after the place's name. */
  words: string;
  /** Someone fleeing it is in need, which the Strangers law's middle setting lets in. */
  need: boolean;
}

export interface StrangersDef {
  home: { after: number; toward: number; work: Readonly<Record<string, string>> };
  draw: {
    base: number;
    food: readonly { days: number; rate: number }[];
    noBed: number;
    name: number;
    winter: number;
    eat: number;
    hour: number;
    first: { month: string; day: number };
  };
  couple: number;
  animal: number;
  animals: readonly string[];
  years: number;
  wait: number;
  reasons: Readonly<Record<string, string>>;
  kinds: readonly StrangerKindDef[];
  weigh: {
    start: number;
    same: number;
    other: number;
    kin: number;
    kinFirst: number;
    sick: number;
    devout: number;
    lasts: number;
    short: number;
    greedy: number;
    harvest: string;
    traits: Readonly<Record<string, number>>;
    memories: Readonly<Record<string, number>>;
  };
  dissent: number;
  road: { count: number };
  law: string;
  memories: { turned: string; refused: string; feast: string };
}

export interface StrangersDefs {
  strangers: StrangersDef;
}

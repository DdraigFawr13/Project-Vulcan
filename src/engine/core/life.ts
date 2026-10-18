// What the needs, goods and people's daily round read from content: Vulcan's life file (P2.2)
// and the forked items list. Need values run from 0 to `scale`; rates are per game hour.

export interface NeedDef {
  id: string;
  name: string;
  /** Fall an hour; under `low` a warning line; under `seek` they go to put it right. */
  fall: number;
  low: number;
  seek: number;
  lowWord: string;
  okWord: string;
  /** Its share of the mood. */
  weight: number;
}

export interface LifeDef {
  scale: number;
  /** How far above `low` a need must get back to be met again. */
  again: number;
  needs: readonly NeedDef[];
  /** Each need's value on arrival, in the order of `needs`. */
  start: readonly number[];
  sleep: { bedroll: number; ground: number; from: number; to: number; wake: number };
  warmth: { comfort: number; bedroll: number; rise: number; perDegree: number; below: number };
  relax: { from: number; gain: number; company: number; reach: number };
  /** Food each item kind gives when one is eaten. */
  eat: Readonly<Record<string, number>>;
  /** Mood words, highest first. */
  mood: readonly { word: string; at: number }[];
  cart: { kind: string; goods: readonly { kind: string; count: number }[]; bedroll: string };
  /** Most of one kind a tile's stack holds (`default` for the rest). */
  stacks: Readonly<Record<string, number>>;
}

/** The forked items list (items.json): only what goods and the screen read. */
export interface ItemDef {
  id: string;
  name: string;
  kind: string;
}

/** The colony's work (work.json, P2.4): stock levels (the player's lever), felling, carrying,
 * the store and working hours. */
export interface WorkDef {
  stock: readonly {
    good: string;
    name: string;
    levels: readonly { id: string; word: string; count: number }[];
    start: string;
  }[];
  fell: { job: string; minutes: number; skilled: number; camp: number; reach: number };
  haul: { load: number; kinds: readonly string[] };
  store: { width: number; height: number; most: number };
  hours: { from: number; to: number };
}

/** The forked jobs list (jobs.json): only what work reads. */
export interface JobDef {
  id: string;
  name: string;
  skill?: string;
  requirements: Readonly<Record<string, number>>;
}

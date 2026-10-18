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

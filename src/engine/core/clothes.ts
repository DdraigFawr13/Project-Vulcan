// What clothing reads from content (clothes.json, Phase 5B Bundle 5, P5.5, V-134).

/** One garment: its slot, degrees it adds outdoors, hours of wear it starts with when plain, what
 * the tailor makes it from and the minutes it takes. */
export interface GarmentDef {
  item: string;
  slot: string;
  warmth: number;
  last: number;
  from: readonly { kind: string; count: number }[];
  minutes: number;
}

export interface ClothesDef {
  /** The items.json `good` every garment is grouped under (the Clothes plate). */
  good: string;
  slots: readonly { id: string; name: string }[];
  garments: readonly GarmentDef[];
  /** Wear an hour outdoors under the comfort line for an outer layer (else 1). */
  cold: number;
  /** Worth by the maker's skill, best first: the first whose `at` is reached; `last` per cent. */
  worth: readonly { id: string; word: string; at: number; last: number }[];
  /** Per cent of life left under which the wearer changes, and under which it is ragged. */
  change: number;
  ragged: number;
  memories: { fine: string; ragged: string };
  /** What the band arrives wearing, and a newcomer. */
  cart: readonly string[];
  newcomer: readonly string[];
  tailor: { job: string; skilled: number; roll: number };
  weave: {
    job: string;
    skilled: number;
    recipes: readonly {
      makes: string;
      out: number;
      from: readonly { kind: string; count: number }[];
      minutes: number;
    }[];
  };
  loom: { piece: string };
  tan: {
    job: string;
    skilled: number;
    hide: string;
    leather: { makes: string; bark: string; days: number; minutes: number };
    fur: { makes: string; minutes: number };
  };
  pits: {
    name: string;
    w: number;
    h: number;
    pits: number;
    material: string;
    cost: number;
    minutes: number;
    water: number;
    start: number;
  };
}

export interface ClothesDefs {
  clothes: ClothesDef;
}

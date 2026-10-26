// What keeping, cooking, curing and coopering read from content `work.keep`, `work.cook`,
// `work.cure` and `work.cooper` (P5.3, P5.12, 5B Bundle 3, V-132).
export interface KeepDef {
  place: { open: number; store: number; house: number; walled: number; below: number };
  warmth: readonly { under: number; times: number }[];
  below: number;
  week: number;
  haulFirst: number;
  haulBonus: number;
  words: { open: string; home: string };
  /** Weeks of past losses kept (`spoilWeek`). */
  history: number;
  /** A barrel cuts the rate of the food it covers to `times` of it; `holds` food a barrel. */
  barrel: { times: number; holds: number };
  /** The cellar dug under a larder that loses `need` of `kinds` (keep/cellar.ts). */
  cellar: { kinds: readonly string[]; need: number; why: string };
}

export interface CookDef {
  job: string;
  meal: string;
  /** Recipes best first (P5.3): a batch's worth of a `main` food and `sideCount` of a `side`. */
  recipes: readonly {
    id: string;
    item: string;
    main: readonly string[];
    side: readonly string[];
    sideCount: number;
  }[];
  /** Grades best first: a batch reaching `at` (cooking level plus the roll) leaves `memory`. */
  grades: readonly { id: string; at: number; memory: string }[];
  roll: number;
  stream: string;
  fineMemory: string;
  fuel: string;
  from: readonly string[];
  /** A batch's food value over the raw food's it is made from. */
  gain: number;
  batch: number;
  minutes: number;
  skilled: number;
  perPerson: number;
  prefer: number;
}

export interface CureDef {
  job: string;
  /** The smokehouse's reason; `{count}` is what spoiled. */
  why: string;
  need: { count: number };
  house: {
    size: number;
    near: number;
    material: string;
    cost: number;
    minutes: number;
    skilled: number;
  };
  from: readonly string[];
  batch: number;
  fuel: number;
  fuelItem: string;
  minutes: number;
  skilled: number;
  /** `want`: fresh meat and fish in the stores that make the mine seek salt; `why`: its reason. */
  salt: { item: string; per: number; makes: string; want: number; why: string };
  smoked: string;
}

export interface CooperDef {
  job: string;
  item: string;
  logs: number;
  minutes: number;
  skilled: number;
}

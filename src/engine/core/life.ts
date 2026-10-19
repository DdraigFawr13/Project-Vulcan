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
  /** Its warning line is notable once a person a day (V-092). */
  quiet?: boolean;
}

export interface LifeDef {
  scale: number;
  /** How far above `low` a need must get back to be met again. */
  again: number;
  needs: readonly NeedDef[];
  /** Each need's value on arrival, in the order of `needs`. */
  start: readonly number[];
  sleep: { bed: number; bedroll: number; ground: number; from: number; to: number; wake: number };
  beauty: { neutral: number; perPoint: number; rate: number; outdoors: number };
  privacy: { gain: number; perOther: number };
  warmth: {
    comfort: number;
    bedroll: number;
    rise: number;
    catchUp: number;
    perDegree: number;
    below: number;
  };
  relax: { from: number; gain: number; company: number; reach: number };
  /** Food each item kind gives when one is eaten. */
  eat: Readonly<Record<string, number>>;
  /** Kinds eaten only when hungry with nothing else to reach (seed grain, P4.7). */
  lastResort: readonly string[];
  /** Mood words, highest first. */
  mood: readonly { word: string; at: number }[];
  cart: {
    kind: string;
    goods: readonly { kind: string; count: number }[];
    bedroll: string;
    cloak: string;
  };
  /** Each live memory's mood points count this many times in the mood (V-091). */
  memory: { weight: number };
  /** The wool cloak (V-092): degrees added outdoors, wear an hour outdoors in the cold, hours it
   * lasts. */
  cloak: { warmth: number; wear: number; last: number };
  /** Most of one kind a tile's stack holds (`default` for the rest). */
  stacks: Readonly<Record<string, number>>;
}

/** The forked items list (items.json): only what goods and the screen read. */
export interface ItemDef {
  id: string;
  name: string;
  kind: string;
  /** The group it counts under for stock levels (food, timber...). */
  good: string;
  /** A cooked dish (items.json): eaten in preference to raw food (work.cook). */
  cooked?: boolean;
  /** An ingot names the ore it is smelted from (Bundle 3). */
  ore?: string;
  /** A tool: its kind (tools.json) and material. */
  tool?: { kind: string; material: string };
}

/** Tools (tools.json, Bundle 3, V-088): kinds and what each serves, materials with speed (per cent)
 * and life (work minutes), the quality bonus and how a tool is made. */
export interface ToolsDef {
  week: number;
  cart: number;
  none: number;
  step: number;
  stream: string;
  roll: number;
  skilled: number;
  charcoal: string;
  kinds: readonly {
    id: string;
    name: string;
    serves: readonly string[];
    ingots: number;
    charcoal: number;
    minutes: number;
  }[];
  materials: readonly { id: string; name: string; speed: number; life: number; ingot?: string }[];
  quality: Readonly<Record<string, number>>;
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
  quarry: {
    job: string;
    good: string;
    minutes: number;
    skilled: number;
    camp: number;
    reach: number;
  };
  forage: {
    job: string;
    good: string;
    minutes: number;
    skilled: number;
    reach: number;
    regrowDays: number;
    months: readonly string[];
  };
  /** Farming (P4.7): minutes to sow or reap a tile at skill `skilled`. */
  farm: { job: string; sow: number; reap: number; skilled: number };
  fire: FireDef;
  doing: Readonly<Record<string, string>>;
  haul: { load: number; kinds: readonly string[] };
  store: { width: number; height: number; most: number };
  hours: { from: number; to: number };
  priority: { jobs: readonly string[]; start: number; words: readonly string[] };
  learn: { start: number; perLevel: number };
  cook: {
    job: string;
    meal: string;
    fuel: string;
    from: readonly string[];
    /** A batch's food value over the raw food's it is made from. */
    gain: number;
    batch: number;
    minutes: number;
    skilled: number;
    perPerson: number;
    prefer: number;
  };
}

/** One part colonists build (buildings.json, P3.1 and P3.2): a tile of one material. */
export interface PartDef {
  id: string;
  name: string;
  kind: 'wall' | 'floor' | 'door' | 'stair';
  material: string;
  cost: number;
  minutes: number;
  art: string;
}

/** What colonists build (buildings.json): the job, its skill dial and the parts. */
export interface BuildingsDef {
  job: string;
  skilled: number;
  downShare: number;
  parts: readonly PartDef[];
  house: HouseDef;
  smithy: {
    name: string;
    start: number;
    depth: number;
    length: number;
    near: number;
    floor: string;
    pieces: readonly string[];
  };
  town: { ring: number; step: number; most: number };
  field: FieldDef;
  rooms: RoomsDef;
  furniture: FurnitureDef;
}

/** A house size or stage (P3.7, P3.8): a w by h footprint of walls round a floor. */
export interface SizeDef {
  id: string;
  name: string;
  w: number;
  h: number;
  sleeps: number;
}

/** What colonists build a house of and the sizes they choose from (P3.7, V-051). */
export interface HouseDef {
  name: string;
  start: number;
  near: number;
  reach: number;
  walls: readonly string[];
  door: string;
  floor: string;
  sizes: readonly SizeDef[];
  stage: SizeDef;
  /** The most rooms a house grows to for privacy (the house itself counted). */
  private: number;
}

/** How a room is scored when asked (P3.3). */
export interface RoomsDef {
  hearthBelow: number;
  most: number;
  roof: string;
  perSize: number;
  top: number;
  crowd: { tiles: number; beauty: number };
  bare: number;
  floors: Readonly<Record<string, number>>;
  roles: readonly { id: string; name: string; beds: number }[];
  looks: readonly { at: number; word: string }[];
  /** What a room of a role lacks, in the order it is made (P3.4). */
  wants: readonly {
    role: string;
    kinds: readonly { kind: string; per: 'sleeper' | 'room' }[];
  }[];
}

/** One kind of furniture (P3.4): its cost in the furniture material and its work at crafting 0. */
export interface FurnitureKind {
  id: string;
  name: string;
  cost: number;
  minutes: number;
  art: string;
  beds: number;
  seats: number;
  place: 'wall' | 'middle' | 'beside table' | 'bed foot' | 'centre';
  /** P3.6: a kind made by another job than carpentry (a hearth, by builders), of its own
   * material, where it stands. */
  job?: string;
  material?: string;
}

/** Fire and fuel (work.json `fire`, P3.6). */
export interface FireDef {
  fall: number;
  radius: number;
  fuels: readonly {
    id: string;
    item: string;
    minutes: number;
    heat: number;
    banked: { heat: number; rate: number };
  }[];
  split: { from: string; fuel: string; per: number; minutes: number };
  tend: { low: number; top: number; topBelow: number; idle: number; near: number };
}

/** Carpentry and furniture (buildings.json `furniture`, P3.4). */
export interface FurnitureDef {
  job: string;
  skilled: number;
  material: string;
  stream: string;
  roll: number;
  kinds: readonly FurnitureKind[];
  /** Highest first: the first whose `at` a quality score reaches. */
  quality: readonly { id: string; word: string; at: number; beauty: number }[];
}

/** The forked jobs list (jobs.json): only what work reads. */
export interface JobDef {
  id: string;
  name: string;
  skill?: string;
  requirements: Readonly<Record<string, number>>;
}

/** A memory a person can hold (memories.json, V-091): its mood points, days it lasts and text. */
export interface MemoryDef {
  id: string;
  mood: number;
  decayDays: number;
  text: string;
  /** How many of it can be held at once (one when absent). */
  stacks?: number;
}

/** A crop (P4.7): sown in the named months, ripe `days` days later, lost to a frost under `frost`. */
export interface CropDef {
  id: string;
  name: string;
  item: string;
  sow: readonly string[];
  days: number;
  yield: number;
  frost: number;
}

/** What colonists lay out as fields (P4.7, V-051, V-089). */
export interface FieldDef {
  name: string;
  /** The item sown, one a tile (P4.7). */
  seed: string;
  /** Siting: a seed tile's score weights, and how many of the best are grown (fieldsite.ts). */
  weigh: { fertility: number; water: number; tries: number };
  start: number;
  perMouth: number;
  reach: number;
  water: number;
  good: number;
  least: number;
  crops: readonly CropDef[];
}

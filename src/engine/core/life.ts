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
  sleep: { bed: number; bedroll: number; ground: number; from: number; to: number; wake: number };
  beauty: { neutral: number; perPoint: number; rate: number; outdoors: number };
  privacy: { gain: number; perOther: number };
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
  /** The group it counts under for stock levels (food, timber...). */
  good: string;
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
  doing: Readonly<Record<string, string>>;
  haul: { load: number; kinds: readonly string[] };
  store: { width: number; height: number; most: number };
  hours: { from: number; to: number };
  priority: { jobs: readonly string[]; start: number; words: readonly string[] };
  learn: { start: number; perLevel: number };
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
}

/** How a room is scored when asked (P3.3). */
export interface RoomsDef {
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
  place: 'wall' | 'middle' | 'beside table' | 'bed foot';
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

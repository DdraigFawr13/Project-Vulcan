// What the flock reads from content (flock.json, Phase 5 Bundle 3, P5.4b): the pasture the
// colony sites, taming, the flock's year and hay. Hay counts one head's day of feed.

/** One kept species: the art and line words for its females, males and young. */
export interface FlockKindDef {
  species: string;
  female: string;
  male: string;
  young: string;
  femaleName: string;
  maleName: string;
  youngName: string;
  /** Shorn in the shearing month. */
  fleece: boolean;
}

export interface FlockDef {
  pasture: {
    name: string;
    start: number;
    holds: number;
    w: number;
    h: number;
    fold: number;
    meadow: { w: number; h: number };
    reach: number;
    water: number;
    weigh: { water: number; herd: number; near: number; trees: number; tries: number };
    hurdle: string;
    gate: string;
  };
  job: string;
  tame: {
    species: readonly string[];
    young: readonly string[];
    months: readonly string[];
    youngMinutes: number;
    adultMinutes: number;
    session: number;
    reach: number;
  };
  kinds: readonly FlockKindDef[];
  lambing: { month: string; chance: number; dies: number; diesWithin: number; grown: string };
  shear: { month: string; minutes: number; item: string; count: number };
  hay: {
    months: readonly string[];
    perTile: number;
    mow: number;
    carry: number;
    dry: number;
    spoil: number;
    plan: number;
    thaw: string;
  };
  cull: { month: string; minutes: number; ramsPer: number; item: string };
  /** `before`: minutes before dusk (the pack's `night.from`) the flock is folded; `open`:
   * minutes after dawn (`night.to`) it is let out; `minutes` the work. */
  fold: { before: number; minutes: number; open: number };
  move: { every: number; wander: number };
  memories: { cull: string; taken: string };
  /** Why nobody folded the flock: `abed`, `warming`, `busy` ({who}, {work}) and `none`. */
  why: Readonly<Record<string, string>>;
}

export interface FlockDefs {
  flock: FlockDef;
}

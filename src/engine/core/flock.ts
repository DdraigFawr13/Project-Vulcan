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
    /** How many people may sit taming at once: patient work, one person's. */
    crew: number;
    /** Herds sit far off: a tamer sets out only with Food at or over `fed`, and a sitting tamer
     * goes back to eat under `back` (life.json's `seek` for everyone else), so the walk home ends
     * above the warning line. */
    fed: number;
    back: number;
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
   * minutes after dawn (`night.to`) it is let out; `minutes` the work; `wait` the minutes the
   * best-placed herder has to take it before any free herder may. */
  fold: { before: number; minutes: number; open: number; wait: number };
  /** The watch fire (Bundle 6): kept `nights` nights after a sign of the pack, `firewood` pieces a
   * night, `light` minutes to lay and light; the watcher sleeps until `wake` o'clock. A pack
   * `breakIn` days without a kill breaks into a dark fold and keeps `reach` tiles from a lit one. */
  watch: {
    nights: number;
    firewood: number;
    light: number;
    wake: number;
    breakIn: number;
    reach: number;
  };
  move: { every: number; wander: number };
  /** Why a watch was kept, by the sign line's type (else `default`), or why not: `nobody`,
   * `firewood` ({have}, {need}). */
  watchWhy: Readonly<Record<string, string>>;
  /** The Work sheet's aside under the Herding row. */
  watchNote: string;
  memories: { cull: string; taken: string };
  /** Why nobody folded the flock: `abed`, `warming`, `eating`, `toFold`, `busy` ({who}, {work}),
   * `noWay` and `none`. */
  why: Readonly<Record<string, string>>;
}

export interface FlockDefs {
  flock: FlockDef;
}

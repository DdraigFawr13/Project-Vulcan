// What health reads from content (health.json, P5.6, P5.8, V-114 to V-116). Chances are per cent
// unless named `per`.

export interface SeverityDef {
  id: string;
  name: string;
  share: number;
  days: number;
  /** 0 none, 1 slow, 2 fast. */
  bleed: number;
  down: boolean;
  mortal?: number;
  /** [with care, without]. */
  fester?: readonly number[];
  mark?: readonly number[];
}

export interface AccidentDef {
  id: string;
  /** A person's job, or `mine:<task>` for mining. */
  work: readonly string[];
  perHour: number;
  wound: string;
  parts: readonly string[];
  what: string;
  where: string;
  at: string;
}

export interface MarkDef {
  id: string;
  name: string;
  limb?: string;
  part?: string;
  /** `walk`, `work`, `carry` or `none`, scaled to `by` per cent. */
  effect: string;
  by: number;
  text: string;
  /** Left by this illness (P5.7), not by a wound. */
  ill?: string;
}

/** An illness (P5.7, V-136). Chances `catch` and `spread` are in `sick.per`. */
export interface IllDef {
  id: string;
  name: string;
  /** "a chill", after "has taken". */
  a: string;
  /** Each exposure: a cold day, a foul drink, a turning meal; for a world one, a stranger. */
  catch: number;
  /** [least, most] days it lasts once it shows. */
  days: readonly number[];
  /** Days from catching to showing. */
  shows: number;
  /** Abed while it lasts; else they work through it. */
  abed: boolean;
  /** Per cent of cases that turn grave, and per cent of grave ones that die untended. */
  grave: number;
  graveName?: string;
  dies: number;
  /** Each night, to each other person in the same room. */
  spread: number;
  /** Days it cannot come back once over; -1 never. */
  immune: number;
  /** One of the world's diseases (diseases.json), brought only by strangers. */
  world?: boolean;
  /** A lasting mark (a `marks` id) it leaves. */
  mark?: string;
}

/** Dials of sickness (P5.7): see health.json `sick`. */
export interface SickDef {
  per: number;
  /** Hours in a day with warmth at nothing that make a cold day. */
  coldHours: number;
  /** A drink this near the midden or fold is foul, and so is a still lake at `warmLake`°. */
  foulNear: number;
  warmLake: number;
  /** After a flux, water within `shunNear` tiles of where it was caught is shunned `shun` days. */
  shun: number;
  shunNear: number;
  /** The hour of the night the sick give it to their roommates. */
  night: number;
  /** Hours between draughts, and the minutes giving one. */
  draughtEvery: number;
  draught: number;
  /** Death chance cut per healer skill point with herbs and without, at most `cutMost`. */
  skillCut: number;
  nurseCut: number;
  cutMost: number;
  /** The first draught shortens the rest of the illness per skill point, at most `shortenMost`. */
  shorten: number;
  shortenMost: number;
  /** World years in which a neighbour's outbreak is still carried by its people. */
  fresh: number;
  /** Raw food losing this many per 1000 a day where it lies is turning: eaten hungry, it may
   * give a griping belly. */
  turning: number;
}

/** The healer's kit (P5.7): stitching wound kinds `stitch`, setting `set`; each cuts festering
 * or a crooked bone by `perSkill` per skill point plus the kit's quality, at most `most`;
 * without a kit, setting by hand counts `hand` per cent of the skill. */
export interface KitDef {
  tool: string;
  stitch: readonly string[];
  set: readonly string[];
  perSkill: number;
  hand: number;
  most: number;
}

export interface HealthDef {
  blood: { full: number; faint: number; slow: number; fast: number; regain: number };
  parts: readonly { id: string; name: string; limb?: string }[];
  severities: readonly SeverityDef[];
  wounds: readonly {
    id: string;
    name: string;
    a: string;
    /** Festering chances replacing the severities' own, [with care, without]. */
    fester?: readonly number[];
    minor?: { name: string; a: string };
  }[];
  accidents: readonly AccidentDef[];
  chance: { per: number; skilled: number; worn: number };
  downLimb: string;
  upAt: number;
  heal: { bed: number; undressed: number; up: number; rough: number; dressEvery: number };
  fester: { days: number; fever: number; dies: number };
  /** Herb dressings (Bundle 6): `item` taken from the store, once per `every` days for a wound
   * younger than `days`; it then festers `fester` per cent as often. */
  herbs: { item: string; every: number; days: number; fester: number };
  marks: readonly MarkDef[];
  ills: readonly IllDef[];
  sick: SickDef;
  kit: KitDef;
  /** The herb garden (P5.7): `w` by `h` beds of build part `bed`, laid out in a `sow` month when
   * the herb store ran dry for someone within `within` days. */
  garden: { w: number; h: number; bed: string; sow: readonly string[]; within: number };
  care: {
    job: string;
    bind: number;
    dress: number;
    skilled: number;
    hear: number;
    missing: number;
  };
  sickroom: { hurt: number; beds: number };
  mourn: {
    close: string;
    band: string;
    burial: string;
    saw: string;
    near: number;
    unburied: number;
  };
  burial: { w: number; h: number; minutes: number; marker: string; job: string };
}

export interface HealthDefs {
  health: HealthDef;
}

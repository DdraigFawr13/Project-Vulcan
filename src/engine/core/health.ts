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

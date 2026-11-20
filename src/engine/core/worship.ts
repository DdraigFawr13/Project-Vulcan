// What the faith system reads from content (worship.json and the forked faiths.json, 6B Bundle 4,
// P6.8, V-143, V-187): devotion, the shrine, prayer, how a faith leans law answers, feast days.

/** A faith of the forked faiths file: its gods, its priest's title, what it holds sacred and
 * the one value it abhors. Its name is the culture's `religion.name`. */
export interface FaithDef {
  id: string;
  gods: readonly string[];
  priestTitle: string;
  sacred: readonly string[];
  abhors: string;
}

export type HolyKind = 'arrival' | 'death' | 'wedding';

export interface WorshipDef {
  devotion: {
    spread: number;
    trait: string;
    devout: number;
    words: readonly { from: number; word: string }[];
  };
  shrine: {
    kind: string;
    faiths: Readonly<Record<string, { kind: string; water?: boolean }>>;
    near: number;
    least: number;
  };
  pray: { minutes: number; memory: string; every: readonly { from: number; days: number }[] };
  lean: number;
  grieved: number;
  feast: { noon: number; leanDays: number; lean: string };
  why: { death: string; wedding: string; harvest: string; shared: string };
  days: readonly {
    kind: HolyKind;
    name: string;
    what: string;
    why: string;
    feast: string;
    rite: string;
    remember?: string;
  }[];
}

export interface WorshipDefs {
  worship: WorshipDef;
  faiths: { defs: readonly FaithDef[] };
}

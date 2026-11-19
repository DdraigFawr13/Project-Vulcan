// What the laws read from content (laws.json, P4.8, V-091).

export interface Hours {
  from: number;
  to: number;
}

/** One setting of a law: its hours (none for the custom), what it asks and what leans on it. */
export interface LawSettingDef {
  id: string;
  name: string;
  /** "the long days", for lines. */
  days: string;
  /** P6.5: what the setting does, for the Laws sheet. */
  about?: string;
  ask: number;
  hours?: Hours;
  /** Hours in winter, and how winter leans on it: for a law of hours. */
  winter?: Hours;
  winterLean?: number;
  /** P6.5 Rations: the share (per cent) of a full day's food a keeper eats, the memory of each
   * day it bites, and how a store that lasts to the harvest, or falls short, leans on it. */
  share?: number;
  kept?: string;
  /** Needs the setting is known to leave low, not held against it (hunger under rations). */
  expects?: readonly string[];
  store?: { lasts: number; short: number };
  /** P6.5 Sickness: the catching-sick lie in the sick-house (`house`) or leave the valley. */
  sick?: 'house' | 'away';
  /** For the Strangers law (P5.9): the reason kinds a split band lets in. */
  lets?: readonly string[];
  /** The memory a refusal leaves on those who see it, and the one a grumbler keeps. */
  saw?: string;
  grumbled?: string;
  traits: Readonly<Record<string, number>>;
  memories: Readonly<Record<string, number>>;
  /** P6.4: how each role and life ambition leans on it. */
  roles?: Readonly<Record<string, number>>;
  ambitions?: Readonly<Record<string, number>>;
  /** P6.6: what it costs the colony's standing each `standing.harsh.every` days in hard times,
   * and the names a faction against it takes. */
  harsh?: number;
  faction?: readonly string[];
  /** P6.7: the beliefs (tales.json) that carry a grievance against it into acts, and what a
   * Punishment setting does to someone caught. */
  beliefs?: readonly string[];
  punish?: 'work' | 'stocks' | 'away';
}

export interface LawDef {
  id: string;
  name: string;
  law: string;
  start: string;
  /** Answered only when a case splits the band (the Strangers law, P5.9), not when set. */
  split?: boolean;
  /** P6.5: each answer as the Laws sheet words it ("{name} keeps {days}."). */
  say?: { obeys: string; grumbles: string; refuses: string };
  /** P6.5: a line the Laws sheet adds after what the setting does. */
  note?: string;
  settings: readonly LawSettingDef[];
}

export interface LawsDef {
  answer: {
    start: number;
    obey: number;
    grumble: number;
    moodPer: number;
    low: number;
    needs: readonly string[];
    sight: number;
    settle: number;
    every: number;
  };
  words: { obeys: string; grumbles: string; refuses: string; store: string };
  laws: readonly LawDef[];
}

export interface LawDefs {
  laws: LawsDef;
}

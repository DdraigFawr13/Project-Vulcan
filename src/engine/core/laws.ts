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
  ask: number;
  hours?: Hours;
  /** Hours in winter, and how winter leans on it: for a law of hours. */
  winter?: Hours;
  winterLean?: number;
  /** For the Strangers law (P5.9): the reason kinds a split band lets in. */
  lets?: readonly string[];
  /** The memory a refusal leaves on those who see it, and the one a grumbler keeps. */
  saw?: string;
  grumbled?: string;
  traits: Readonly<Record<string, number>>;
  memories: Readonly<Record<string, number>>;
}

export interface LawDef {
  id: string;
  name: string;
  law: string;
  start: string;
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
  };
  words: { obeys: string; grumbles: string; refuses: string };
  laws: readonly LawDef[];
}

export interface LawDefs {
  laws: LawsDef;
}

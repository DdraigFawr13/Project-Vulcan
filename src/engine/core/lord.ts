// The lord file's shape as the engine reads it (content lord.json, 6C Slice 1, V-216).

export interface LordTitle {
  title: string;
  /** The title for a woman, where it differs. */
  f?: string;
}

export interface LordDef {
  /** By the word a realm's name gives its kind. */
  titles: readonly (LordTitle & { kind: string })[];
  /** For a kind not listed. */
  title: LordTitle;
  reeve: {
    sex: string;
    /** Walker's minutes he covers each minute: he rides. */
    pace: number;
    arrive: number;
    speakBy: number;
    leave: number;
    reach: number;
    look: number;
  };
  /** What each temper adds to the news's memory weight. */
  tempers: Readonly<Record<string, number>>;
  memories: { named: string; bitter: string };
}

export interface LordDefs {
  lord: LordDef;
}

// What the tales system reads from content (tales.json, P6.3, V-140, V-155, V-162).

export interface TaleDef {
  id: string;
  /** The ledger event type it copies. */
  event: string;
  /** The event's data must hold these values. */
  only?: Readonly<Record<string, string>>;
  /** Its words from mildest to worst, filled from the event's data. */
  levels: readonly string[];
  /** The level of what happened. */
  truth: number;
  /** The belief it forms at level `from` or worse. */
  belief: string;
  from: number;
  /** No one sees it (a blight, a pack at the edge): one awake person brings word of it. */
  word?: boolean;
  /** Title templates for a song made of it (tales `titles.ts`): one is chosen by the seed. */
  song?: readonly string[];
  /** The byname each level gives the one it is about ("" for none). */
  bynames?: readonly string[];
}

export interface BeliefDef {
  id: string;
  about: 'person' | 'place' | 'law' | 'colony';
  text: string;
}

export interface TalesDef {
  pass: {
    meal: number;
    leisure: number;
    work: number;
    hearth: number;
    tavern: number;
    perDay: number;
  };
  places: { meal: string; leisure: string; work: string; hearth: string; tavern: string };
  bend: { chance: number; traits: Readonly<Record<string, number>>; softer: number };
  beliefFadeDays: number;
  forgetDays: number;
  strength: readonly string[];
  /** Ordinal words for the colony's years in song titles ("First", "Second"). */
  ordinals: readonly string[];
  evening: { mend: number };
  byname: { share: number; told: number; proud: readonly string[] };
  beliefs: readonly BeliefDef[];
  tales: readonly TaleDef[];
}

export interface TalesDefs {
  tales: TalesDef;
}

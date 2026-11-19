// What the defiance system reads from content (defy.json, P6.7, V-160).

export interface DefyStep {
  id: string;
  /** "works slowly" */
  name: string;
  /** A step that is a law answer (`grumbles`, `refuses`) rather than an act. */
  answer?: string;
  /** Points short of keeping the law an act needs, moved by `traits`. */
  bar?: number;
  /** Days on the step below first, in place of the ladder's `hold`. */
  hold?: number;
  traits?: Readonly<Record<string, number>>;
}

export interface DefyDef {
  hour: number;
  /** The belief strength an act needs (2: Thinks). */
  belief: number;
  hold: number;
  cool: number;
  steps: readonly DefyStep[];
  /** One work minute in `every` idled. */
  slow: { every: number };
  take: { count: number; every: number; sight: number };
  brawl: {
    every: number;
    reach: number;
    doing: readonly string[];
    deep: number;
    kinds: readonly string[];
    parts: readonly string[];
    what: string;
  };
  leave: { misery: number; mood: number; household: boolean; every: number };
  /** Hard times without a law (6A review P2): the memory and the belief that let someone take
   * from a store that will not last, at any Rations setting. */
  starving: { memory: string; belief: string };
  memories: Readonly<Record<string, string>>;
  /** The sentences a Punishment setting's `punish` names (defy.json `punish`). */
  punish: Readonly<Record<string, SentenceDef>>;
  standing: { by: number; days: number; text: string };
}

/** A sentence: its words, and the next `day` worked to bedtime or sat on the `green`, a `memory`
 * the sentenced keep, or `leave` (sent out of the valley). */
export interface SentenceDef {
  text: string;
  day?: 'work' | 'green';
  memory?: string;
  leave?: boolean;
}

export interface DefyDefs {
  defy: DefyDef;
}

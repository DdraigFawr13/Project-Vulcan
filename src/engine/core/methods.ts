// The methods file's shape as the engine reads it (content methods.json, 6C Slice 5, V-218).

export interface MethodDef {
  id: string;
  name: string;
  /** The trade (a jobs.json id) it is found at and serves. */
  job: string;
  /** The skill and level a puzzler needs; no skill: anyone at the trade. */
  skill?: string;
  from: number;
  hints: number;
  /** Where the work is done, for the lines ("forge"). */
  where: string;
  /** Lines that count as a failure in its trade. */
  failures: readonly string[];
  /** What a mishap spoils, and whether the work is at a fire. */
  ruins: readonly string[];
  hot?: boolean;
  /** What it does for a knower's own work, in per cent, `on` the materials it covers (V-219). */
  effect: { by: number; on?: readonly string[] };
}

export interface HintWords {
  how: string;
  short: string;
}

export type HintKind = 'work' | 'failure' | 'seen' | 'book' | 'tale' | 'luck' | 'dream';

export interface MethodsDef {
  methods: readonly MethodDef[];
  start: { hours: number; days: number };
  work: number;
  credit: readonly { event: string; job: string; hours: number }[];
  failure: { days: number };
  book: { days: number; event: string };
  drop: { days: number; hours: number };
  seen: { odds: number; most: number; event: string; also?: readonly string[] };
  tale: { odds: number; id: string };
  luck: { days: number; lucky: number; bynames: readonly string[]; hours: number };
  share: { kinds: readonly string[]; words: string };
  dream: { nights: number; days: number };
  memories: { found: string; learned: string; mishap: string };
  mishap: {
    hand: number;
    fire: number;
    nothing: string;
    burn: { parts: readonly string[]; severity: string; what: string; at: string };
    words: { ruined: string; hand: string; fire: string };
  };
  spread: {
    apprentice: number;
    beside: number;
    words: { apprentice: string; book: string; beside: string };
  };
  kinds: Readonly<Record<HintKind, HintWords>>;
  failed: Readonly<Record<string, { words: string; by: 'actor' | 'trade' }>>;
  screen: MethodsScreen;
}

/** The words the screen shows a way in (6C Slice 6, V-221): each way's effect on a knower's
 * work, a puzzle and its hints, how a way was come by, and the colony's list. */
export interface MethodsScreen {
  effects: Readonly<Record<string, string>>;
  puzzle: string;
  hint: string;
  left: string;
  knows: string;
  how: Readonly<Record<'found' | 'apprentice' | 'book' | 'beside', string>>;
  known: string;
  found: string;
  learnt: string;
  only: string;
  kept: string;
  puzzled: string;
  puzzler: string;
  puzzlerWho: string;
  nobody: string;
  none: string;
}

export interface MethodsDefs {
  methods: MethodsDef;
}

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
  seen: { odds: number; most: number; event: string };
  tale: { odds: number; id: string };
  luck: { days: number; lucky: number; bynames: readonly string[]; hours: number };
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
}

export interface MethodsDefs {
  methods: MethodsDef;
}

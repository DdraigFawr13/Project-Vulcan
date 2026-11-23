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
  book: { days: number };
  seen: { odds: number; most: number };
  tale: { odds: number; id: string };
  luck: { days: number; lucky: number; bynames: readonly string[]; hours: number };
  dream: { nights: number; days: number };
  memories: { found: string };
  kinds: Readonly<Record<HintKind, HintWords>>;
  failed: Readonly<Record<string, string>>;
}

export interface MethodsDefs {
  methods: MethodsDef;
}

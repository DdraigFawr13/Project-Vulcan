// What the callings system reads from content (callings.json, 6B Bundle 6, P6.13, V-175, V-189
// q8 and q9): rare roles with a high bar, at most one holder each, and the push each gives.

/** The kinds of test a calling's bar is made of (engine calling `bar.ts` measures each). */
export type CallingTestKind =
  | 'trait'
  | 'trusted'
  | 'friends'
  | 'tales'
  | 'lines'
  | 'attribute'
  | 'ambition'
  | 'skill'
  | 'memory'
  | 'role'
  | 'either';

/** One test of a bar. `trait`: holds one of `any` and none of `none`; `trusted`: among the `top`
 * most trusted grown-ups; `friends`: friends (colony `talkersOf`: told or heard a tale lately) with `share` per cent of the other living;
 * `tales`: holds `from` tales; `lines`: has been actor `actor` of `from` `event` lines; `attribute`:
 * `attr` at `from`; `ambition`: ambition `id` fulfilled, its skill at `from` if given; `skill`: the best of `skills` at `from`;
 * `memory`: holds memory `id`; `role`: holds role `id`; `either`: passes when one of `or` passes.
 * `word` says it in the line ({n} the measure, {of} out of, {skill}). */
export interface CallingTest {
  test: CallingTestKind;
  word: string;
  any?: readonly string[];
  none?: readonly string[];
  top?: number;
  share?: number;
  from?: number;
  event?: string;
  actor?: number;
  attr?: string;
  id?: string;
  skills?: readonly string[];
  or?: readonly CallingTest[];
}

/** What holding a calling does, read by the systems it pushes (engine entity `callings.ts`). */
export interface CallingPush {
  /** Days a friend's act step takes to cool (engine defy, for defy.json `cool`). */
  cool?: number;
  /** Belief steps a tale the holder tells feeds in the hearer (tales, for a heard tale's 1). */
  told?: number;
  /** Per cent of tales.json `forgetDays` that hearers keep a tale the holder told them. */
  keep?: number;
  /** Per cent practice pace for the holder's own apprentice (band `learn.ts`, for `apprentice`). */
  apprentice?: number;
  /** The holder's next piece in their trade is a named masterwork: the events that make a piece
   * and the skill each is of; `names` to call it by; its `quality` furniture score; `pieces`, the
   * words for a trade's piece when the line has no `what`. */
  masterwork?: {
    events: Readonly<Record<string, string>>;
    names: readonly string[];
    quality: string;
    pieces: Readonly<Record<string, string>>;
  };
  /** The holder sits the watch fire first (engine herding). */
  watch?: boolean;
  /** Others' `belief` fades in `by` per cent of tales.json `beliefFadeDays`. */
  fade?: { belief: string; by: number };
}

/** One stage of a calling: the bar that opens it and its sign. Only the first is used now; 6E's
 * dark paths add later stages, turning points and endings to the same frame. */
export interface CallingStage {
  id: string;
  bar: readonly CallingTest[];
  sign: string;
}

export interface CallingDef {
  id: string;
  /** "the peacemaker"; `titles` by trade skill for one held in a trade ("the master mason"). */
  name: string;
  titles?: Readonly<Record<string, string>>;
  stages: readonly CallingStage[];
  /** The index in the first stage's bar whose measure picks the best of those who pass. */
  best: number;
  push: CallingPush;
}

export interface CallingsDef {
  /** Days between looks for a holder, and the hour of that day. */
  every: number;
  hour: number;
  callings: readonly CallingDef[];
}

export interface CallingsDefs {
  callings: CallingsDef;
}

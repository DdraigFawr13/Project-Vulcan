// The band's answers to a law (P4.8, V-091): worked out for everyone when its setting changes,
// and again for someone when a memory that weighs on it is added. Obeys keeps the law's hours;
// grumbles keeps them and remembers it; refuses keeps the customary hours.
import { TICKS_PER_DAY, type EntityRow, type LawSettingDef } from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lawDef } from './hours.ts';
import { shareOf } from './share.ts';
import { weigh, type Weighed } from './weigh.ts';

export const LAW_TABLES: Schemas = {
  /** A law whose setting was changed: its setting id, the line that set it and when. */
  law: { law: 'text', setting: 'text', line: 'event', changed: 'int' },
  /** A person's answer to a law: obeys, grumbles or refuses, the willingness behind it, what
   * weighed for and against (words joined by `|`), the memory lines that weighed (`cites`), their
   * signature (`mems`), the line where they last answered and the tick they last changed it. */
  answer: {
    person: 'entity',
    law: 'text',
    answer: 'text',
    will: 'int',
    pro: 'text',
    con: 'text',
    cites: 'events',
    mems: 'text',
    line: 'event',
    at: 'int',
    /** The Rations law (P6.5): food worth left of their share, filled each midnight, and the tick
     * a refuser last took a full plate in a line (rations.ts). */
    left: 'int',
    flouted: 'int',
  },
};

export const answersOf = (ctx: SystemContext, law: string): EntityRow[] =>
  (ctx.world.entities['answer'] ?? []).filter((a) => a['law'] === law);

const alive = (ctx: SystemContext): EntityRow[] =>
  (ctx.world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Writes `p`'s answer line and row; a grumbler remembers it. */
function record(
  ctx: SystemContext,
  law: string,
  s: LawSettingDef,
  p: EntityRow,
  w: Weighed,
  causes: number[],
  row: EntityRow | undefined,
): void {
  const reasons = [...w.against, ...w.for].slice(0, 3).join(', ') || 'no more to it';
  const line = ctx.emit('law.answered', {
    causes: [...new Set([...causes, ...w.cites])],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      now: row ? 'now ' : '',
      verb: ctx.content.laws.words[w.answer],
      answer: w.answer,
      days: s.days,
      reasons,
    },
  });
  const fields = {
    answer: w.answer,
    will: w.will,
    pro: w.for.join('|'),
    con: w.against.join('|'),
    cites: w.cites,
    mems: w.mems,
    line,
  };
  if (row) Object.assign(row, fields, { at: ctx.world.tick });
  else
    addEntity(ctx.world, 'answer', {
      person: p.id,
      law,
      ...fields,
      at: 0,
      left: shareOf(ctx, s),
      flouted: -1,
    });
  if (w.answer === 'grumbles' && s.grumbled) addMemory(ctx, p.id, s.grumbled, line);
}

/** Whether everyone weighs `s` while it stands: not the law's start (the custom asks nothing), nor
 * a law answered only when a case splits the band (P6.5). */
export const answered = (ctx: SystemContext, law: string, s: LawSettingDef): boolean => {
  const def = lawDef(ctx.content, law);
  return !!def && s.id !== def.start && !def.split;
};

/** Everyone answers the law's new setting `s`, set by line `cause`. */
export function answerAll(ctx: SystemContext, law: string, s: LawSettingDef, cause: number): void {
  for (const a of answersOf(ctx, law)) removeEntity(ctx.world, 'answer', a.id);
  if (!answered(ctx, law, s)) return;
  for (const p of alive(ctx))
    record(ctx, law, s, p, weigh(ctx.world, ctx.content, p.id, s), [cause], undefined);
}

/** Answers again for whoever holds a memory that weighs on `s` and was not weighed yet. A changed
 * answer is a line; the same one keeps its reasons, which match that line, and only notes what
 * was weighed. Someone who changed their answer holds it `settle` days first (P6.5). */
export function reweigh(ctx: SystemContext, law: string, s: LawSettingDef): void {
  const settle = ctx.content.laws.answer.settle * TICKS_PER_DAY;
  for (const row of answersOf(ctx, law)) {
    const p = alive(ctx).find((q) => q.id === row['person']);
    if (!p) continue;
    const at = (row['at'] as number | undefined) ?? 0;
    if (at && ctx.world.tick < at + settle) continue;
    const w = weigh(ctx.world, ctx.content, p.id, s);
    if (w.mems === row['mems']) continue;
    if (w.answer !== row['answer']) record(ctx, law, s, p, w, [], row);
    else row['mems'] = w.mems;
  }
}

/** `p` answers a law that asks nothing of the day, at one moment (the Strangers law, P5.9, when
 * it settles a split): their weighing of `s`, with `by` more and the reasons of their own put
 * first on each side, replacing any earlier answer. A grumbler remembers it; returns the answer. */
export function answerNow(
  ctx: SystemContext,
  law: string,
  s: LawSettingDef,
  p: EntityRow,
  shift: { by: number; for: string[]; against: string[] },
  causes: number[],
): Weighed['answer'] {
  const w = weigh(ctx.world, ctx.content, p.id, s);
  const dial = ctx.content.laws.answer;
  const will = w.will + shift.by;
  const answer = will >= dial.obey ? 'obeys' : will >= dial.grumble ? 'grumbles' : 'refuses';
  const join = (a: string[], b: string[]) => [...new Set([...a, ...b])];
  const moved: Weighed = {
    ...w,
    will,
    answer,
    for: join(shift.for, w.for),
    against: join(shift.against, w.against),
  };
  // Each split is answered afresh: the answer is to this stranger, not a change of mind.
  const row = answersOf(ctx, law).find((a) => a['person'] === p.id);
  if (row) removeEntity(ctx.world, 'answer', row.id);
  record(ctx, law, s, p, moved, causes, undefined);
  return answer;
}

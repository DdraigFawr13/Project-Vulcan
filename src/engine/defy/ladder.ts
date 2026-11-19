// The ladder (P6.7, V-160): once a day each person climbs at most one act step, and only while a
// grievance holds them there. Steps that are law answers (grumble, refuse) follow the person's
// answer at once; an act step (work slowly, take, brawl, leave) needs the grievance `bar` points
// (moved by traits) past keeping the law, `hold` days on the step below, the memory and the
// belief behind it, and for leaving a faction or `leave.misery` days in low spirits. `cool` days
// under a step's bar step them down one, with a line.
import {
  TICKS_PER_DAY,
  type DefyStep,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { factionOf } from '../colony/index.ts';
import { addEntity } from '../entity/index.ts';
import { moodOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { leave } from './leave.ts';
import { defyOf } from './tables.ts';
import { citesOf, grievanceOf, reasonsOf, whyWords, type Grievance, type Why } from './why.ts';

/** The points short of keeping the law an act step needs, by `p`'s traits. */
function barOf(world: WorldState, step: DefyStep, person: number): number {
  let bar = step.bar ?? 0;
  for (const t of world.entities['trait'] ?? [])
    if (t['person'] === person) bar += step.traits?.[t['trait'] as string] ?? 0;
  return bar;
}

/** Whether the grievance `g` (with its `why`) holds `p` on step `k` (1-based). */
function fits(
  world: WorldState,
  content: EngineContent,
  row: EntityRow,
  k: number,
  g: Grievance | undefined,
  why: Why,
): boolean {
  const step = content.defy.steps[k - 1];
  if (!step || !g) return false;
  const answer = g.answer['answer'] as string;
  if (step.answer)
    return answer === step.answer || (step.answer === 'grumbles' && answer === 'refuses');
  if (!why.mem || !why.belief || g.by < barOf(world, step, row['person'] as number)) return false;
  if (step.id !== 'leave') return true;
  const person = row['person'] as number;
  return (
    !!factionOf(world, person, g.law) || (row['misery'] as number) >= content.defy.leave.misery
  );
}

function rowFor(ctx: SystemContext, person: number): EntityRow {
  const had = defyOf(ctx.world, person);
  if (had) return had;
  addEntity(ctx.world, 'defy', {
    ...{ person, law: '', step: 0, since: 0, under: 0, misery: 0 },
    ...{ line: 0, mem: 0, why: 0, belief: '', took: -1, brawled: -1 },
  });
  return defyOf(ctx.world, person)!;
}

/** Up one act step: the line saying so (for working slowly; taking and brawling show when done). */
function climb(
  ctx: SystemContext,
  p: EntityRow,
  row: EntityRow,
  k: number,
  g: Grievance,
  why: Why,
) {
  const step = ctx.content.defy.steps[k - 1]!;
  Object.assign(row, {
    ...{ step: k, since: ctx.world.tick, under: 0, law: g.law },
    ...{ mem: why.mem?.['line'] ?? 0, why: why.belief?.['line'] ?? 0 },
    belief: (why.belief?.['belief'] as string) ?? '',
  });
  const data = {
    name: p['name'] as string,
    days: g.setting.days,
    why: whyWords(ctx.world, ctx.content, why),
  };
  if (step.id === 'slow')
    row['line'] = ctx.emit('defy.slow', { causes: citesOf(g, why), actors: [p.id], data });
  else if (step.id === 'leave') row['line'] = leave(ctx, p, g, why);
}

/** Down one step; leaving an act step is a line. */
function cool(ctx: SystemContext, p: EntityRow, row: EntityRow): void {
  const k = row['step'] as number;
  const step = ctx.content.defy.steps[k - 1]!;
  Object.assign(row, { step: k - 1, since: ctx.world.tick, under: 0 });
  if (step.answer) return;
  ctx.emit('defy.cooled', {
    causes: [row['line'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, step: step.name },
  });
}

/** Answer steps the person no longer answers fall away at once; an act step cools after `cool`
 * days under its bar. False while they are still cooling (no climbing today). */
function settle(
  ctx: SystemContext,
  p: EntityRow,
  row: EntityRow,
  g: Grievance | undefined,
  why: Why,
) {
  const { world, content } = ctx;
  while ((row['step'] as number) > 0) {
    const k = row['step'] as number;
    if (fits(world, content, row, k, g, why)) {
      row['under'] = 0;
      return true;
    }
    if (!content.defy.steps[k - 1]!.answer) {
      row['under'] = (row['under'] as number) + 1;
      if ((row['under'] as number) < content.defy.cool) return false;
    }
    cool(ctx, p, row);
  }
  return true;
}

/** Whether `row` has waited long enough below act step `k`: its `hold` days, and for leaving
 * nobody else gone within `leave.every` days (system state `left`, set when they go). */
function waited(ctx: SystemContext, row: EntityRow, k: number): boolean {
  const d = ctx.content.defy;
  const step = d.steps[k - 1]!;
  if (ctx.world.tick - (row['since'] as number) < (step.hold ?? d.hold) * TICKS_PER_DAY)
    return false;
  if (step.id !== 'leave') return true;
  const last = ctx.state['left'];
  if (last !== undefined && ctx.world.tick - last < d.leave.every * TICKS_PER_DAY) return false;
  ctx.state['left'] = ctx.world.tick;
  return true;
}

/** One day on the ladder for `p`. */
export function ladderDay(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const d = content.defy;
  const row = rowFor(ctx, p.id);
  const mood = (moodOf(world, p.id)?.['value'] as number | undefined) ?? content.life.scale;
  row['misery'] = mood < d.leave.mood ? (row['misery'] as number) + 1 : 0;
  const g = grievanceOf(world, content, p.id);
  const why = g ? reasonsOf(world, content, p.id, g.setting) : {};
  if (!settle(ctx, p, row, g, why) || !g) return;
  // Answer steps follow the answer at once; an act step waits on the one below.
  for (let k = (row['step'] as number) + 1; k <= d.steps.length; k += 1) {
    if (!fits(world, content, row, k, g, why)) return;
    if (d.steps[k - 1]!.answer) {
      Object.assign(row, { step: k, since: world.tick, law: g.law });
      continue;
    }
    if (waited(ctx, row, k)) climb(ctx, p, row, k, g, why);
    return;
  }
}

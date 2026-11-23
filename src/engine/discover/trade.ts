// Hours at a trade (6C Slice 5, V-218): each hour someone at work at a trade a way belongs to
// gives an hour to their ring of the last `methods.start.days` days, and an hour toward the next
// work hint of a puzzle in that trade; short jobs (milling, healing) count from their lines
// (`methods.credit`). After `start.hours` in the window, someone at a trade with a way they could
// find, that no living colonist knows, begins to puzzle over it (one puzzle a person).
import { today, type EngineContent, type EntityRow } from '../core/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { skillRow } from '../band/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addHint, wayOf } from './find.ts';
import { knowersOf, knows, monthHours, puzzleOf, tradeRow } from './tables.ts';

/** The trades some way belongs to. */
export const tradesOf = (content: EngineContent): Set<string> =>
  new Set(content.methods.methods.map((m) => m.job));

/** Hours at a work hint (Slice 5's pace; the New Ways law changes it later). */
export const workHours = (ctx: SystemContext): number => ctx.content.methods.work;

/** Zeroes the ring's days since it was last written, up to today. */
function roll(row: EntityRow, day: number, n: number): void {
  const hours = row['hours'] as number[];
  const from = row['day'] as number;
  if (day - from >= n) hours.fill(0);
  else for (let d = from + 1; d <= day; d += 1) hours[d % n] = 0;
  row['day'] = day;
}

/** `hours` at `job` for `person` today; toward the next work hint of their puzzle there. */
export function addHours(ctx: SystemContext, p: EntityRow, job: string, hours: number): void {
  const { world, content } = ctx;
  const n = content.methods.start.days;
  const day = today(world);
  let row = tradeRow(world, p.id, job);
  if (!row) {
    addEntity(world, 'trade', { person: p.id, job, hours: new Array<number>(n).fill(0), day });
    row = tradeRow(world, p.id, job)!;
  }
  roll(row, day, n);
  (row['hours'] as number[])[day % n]! += hours;
  const puzzle = puzzleOf(world, p.id);
  if (!puzzle || wayOf(ctx, puzzle).job !== job) return;
  puzzle['work'] = (puzzle['work'] as number) + hours;
  const need = workHours(ctx);
  while ((puzzle['work'] as number) >= need && !puzzle['ended']) {
    puzzle['work'] = (puzzle['work'] as number) - need;
    addHint(ctx, puzzle, 'work', [p['took'] as number]);
  }
}

/** The hour's sample: everyone at work at a trade a way belongs to. */
export function sampleHour(ctx: SystemContext): void {
  const trades = tradesOf(ctx.content);
  for (const p of alive(ctx.world))
    if (p['doing'] === 'work' && trades.has(p['job'] as string))
      addHours(ctx, p, p['job'] as string, 1);
}

/** Hours at a trade over the window, today's ring rolled first. */
function hoursAt(ctx: SystemContext, p: EntityRow, job: string): number {
  const row = tradeRow(ctx.world, p.id, job);
  if (row) roll(row, today(ctx.world), ctx.content.methods.start.days);
  return monthHours(row);
}

/** The way `p` would puzzle over: in the trade they worked most this month (at least
 * `start.hours`), the first they have the skill for, don't know, and no living colonist knows. */
function wayFor(ctx: SystemContext, p: EntityRow) {
  const { world, content } = ctx;
  const jobs = [...tradesOf(content)]
    .map((job) => ({ job, hours: hoursAt(ctx, p, job) }))
    .filter((j) => j.hours >= content.methods.start.hours)
    .sort((a, b) => b.hours - a.hours);
  for (const { job, hours } of jobs) {
    const m = content.methods.methods.find(
      (w) =>
        w.job === job &&
        (!w.skill || ((skillRow(world, p.id, w.skill)?.['level'] as number) ?? 0) >= w.from) &&
        !knows(world, p.id, w.id) &&
        !knowersOf(world, w.id).length,
    );
    if (m) return { m, hours };
  }
  return undefined;
}

/** Each day: someone with no puzzle may begin one (`discover.puzzle`). */
export function startPuzzles(ctx: SystemContext): void {
  const { world } = ctx;
  for (const p of alive(world)) {
    if (puzzleOf(world, p.id)) continue;
    const got = wayFor(ctx, p);
    if (!got) continue;
    const line = ctx.emit('discover.puzzle', {
      causes: [p['took'] as number].filter((l) => l > 0),
      actors: [p.id],
      data: { name: p['name'] as string, method: got.m.name, hours: got.hours, where: got.m.where },
    });
    addEntity(world, 'puzzle', {
      ...{ person: p.id, method: got.m.id, line, since: world.tick, work: 0 },
      ...{ failed: -1, read: -1, last: world.tick, ended: 0 },
    });
  }
}

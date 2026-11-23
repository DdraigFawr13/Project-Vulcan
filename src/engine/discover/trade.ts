// Hours at a trade (6C Slice 5, V-218, V-219): each hour someone at work at a trade a way belongs
// to gives an hour to their ring of the last `methods.start.days` days (and the row keeps the line
// of that work), and an hour toward the next work hint of a puzzle in that trade; short jobs
// (milling, healing) count from their lines (`methods.credit`). At midnight someone whose most
// worked trade this month has `start.hours` or more, and a way they could find there that no
// living colonist knows, begins to puzzle over it (one puzzle a person); a puzzle with under
// `drop.hours` at its trade in `drop.days` is put aside.
import { TICKS_PER_DAY, today, type EngineContent, type EntityRow } from '../core/index.ts';
import { addEntity, alive } from '../entity/index.ts';
import { skillRow } from '../band/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addHint, wayOf } from './find.ts';
import { knowersOf, knows, monthHours, puzzleOf, puzzlesNow, tradeRow } from './tables.ts';

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

/** The line of `person`'s latest work at `job` (0 for none). */
export const workLine = (ctx: SystemContext, person: number, job: string): number =>
  (tradeRow(ctx.world, person, job)?.['line'] as number) ?? 0;

/** `hours` at `job` for `person` today, done on `line`; toward the next work hint of their
 * puzzle there. */
export function addHours(
  ctx: SystemContext,
  p: EntityRow,
  job: string,
  hours: number,
  line: number,
): void {
  const { world, content } = ctx;
  const n = content.methods.start.days;
  const day = today(world);
  let row = tradeRow(world, p.id, job);
  if (!row) {
    addEntity(world, 'trade', {
      person: p.id,
      job,
      hours: new Array<number>(n).fill(0),
      day,
      line,
    });
    row = tradeRow(world, p.id, job)!;
  }
  roll(row, day, n);
  (row['hours'] as number[])[day % n]! += hours;
  if (line > 0) row['line'] = line;
  const puzzle = puzzleOf(world, p.id);
  if (!puzzle || wayOf(ctx, puzzle).job !== job) return;
  puzzle['work'] = (puzzle['work'] as number) + hours;
  const need = workHours(ctx);
  while ((puzzle['work'] as number) >= need && !puzzle['ended']) {
    puzzle['work'] = (puzzle['work'] as number) - need;
    addHint(ctx, puzzle, 'work', [row['line'] as number]);
  }
}

/** The hour's sample: everyone at work at a trade a way belongs to. */
export function sampleHour(ctx: SystemContext): void {
  const trades = tradesOf(ctx.content);
  for (const p of alive(ctx.world))
    if (p['doing'] === 'work' && trades.has(p['job'] as string))
      addHours(ctx, p, p['job'] as string, 1, p['took'] as number);
}

/** Hours `person` worked at a trade over the window, the ring rolled to today first. */
export function hoursAt(ctx: SystemContext, person: number, job: string): number {
  const row = tradeRow(ctx.world, person, job);
  if (row) roll(row, today(ctx.world), ctx.content.methods.start.days);
  return monthHours(row);
}

/** The way `p` would puzzle over: in the trade they worked most this month (at least
 * `start.hours`), the first they have the skill for, don't know, and no living colonist knows. */
function wayFor(ctx: SystemContext, p: EntityRow) {
  const { world, content } = ctx;
  const [top] = [...tradesOf(content)]
    .map((job) => ({ job, hours: hoursAt(ctx, p.id, job) }))
    .sort((a, b) => b.hours - a.hours);
  if (!top || top.hours < content.methods.start.hours) return undefined;
  const m = content.methods.methods.find(
    (w) =>
      w.job === top.job &&
      (!w.skill || ((skillRow(world, p.id, w.skill)?.['level'] as number) ?? 0) >= w.from) &&
      !knows(world, p.id, w.id) &&
      !knowersOf(world, w.id).length,
  );
  return m && { m, hours: top.hours };
}

/** Each midnight: puzzles of the dead end, a puzzle left too long is put aside, and someone with
 * no puzzle may begin one (`discover.puzzle`). */
export function startPuzzles(ctx: SystemContext): void {
  const { world, content } = ctx;
  const living = new Map(alive(world).map((p) => [p.id, p]));
  const { drop } = content.methods;
  for (const q of puzzlesNow(world)) {
    const p = living.get(q['person'] as number);
    if (!p) q['ended'] = q['line'] as number;
    const m = wayOf(ctx, q);
    if (!p || world.tick - (q['since'] as number) < drop.days * TICKS_PER_DAY) continue;
    const hours = hoursAt(ctx, p.id, m.job);
    if (hours >= drop.hours) continue;
    q['ended'] = ctx.emit('discover.dropped', {
      causes: [q['line'] as number],
      actors: [p.id],
      data: { name: p['name'] as string, method: m.name, hours, where: m.where },
    });
  }
  for (const p of living.values()) {
    if (puzzleOf(world, p.id)) continue;
    const got = wayFor(ctx, p);
    if (!got) continue;
    const line = ctx.emit('discover.puzzle', {
      causes: [workLine(ctx, p.id, got.m.job)].filter((l) => l > 0),
      actors: [p.id],
      data: { name: p['name'] as string, method: got.m.name, hours: got.hours, where: got.m.where },
    });
    addEntity(world, 'puzzle', {
      ...{ person: p.id, method: got.m.id, line, since: world.tick, work: 0 },
      ...{ failed: -1, read: -1, last: world.tick, ended: 0 },
    });
  }
}

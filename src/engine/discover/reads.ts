// Hints from what happens (6C Slice 5, V-218): each hour the new ledger lines are read. A short
// job's line counts as hours at its trade; a failure in a way's trade teaches whoever is puzzling
// over it (`methods.failed` says whose failure it is), at most once a
// person in `failure.days`; a stranger's coming may show each puzzler something (1 in `seen.odds`,
// at most `seen.most` a way); reading a book of the puzzle's skill is a hint (once in
// `book.days`). New tales are read too: hearing of a find in one's own trade, even odds.
import { today, type EntityRow, type SimEvent } from '../core/index.ts';
import { alive, entityOf } from '../entity/index.ts';
import { linesAfter } from '../log/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addHint, fill, wayOf } from './find.ts';
import { broughtWays, masterHints } from './brought.ts';
import { hintsOf, knowsOf, methodDef, puzzlesNow } from './tables.ts';
import { bookLearn } from './spread.ts';
import { addHours, hoursAt, workedToday } from './trade.ts';

/** Open puzzles of the living, oldest first. */
function livePuzzles(ctx: SystemContext): EntityRow[] {
  const living = new Set(alive(ctx.world).map((p) => p.id));
  return puzzlesNow(ctx.world).filter((q) => living.has(q['person'] as number));
}

const since = (day: number, last: number, gap: number): boolean => last < 0 || day - last >= gap;

/** A failure line: one puzzler in its trade learns from it: one named in the line (`by` `actor`),
 * else (`trade`) whoever puzzling there worked the trade today and most this month. */
function failure(ctx: SystemContext, e: SimEvent): void {
  const { world, content } = ctx;
  const day = today(world);
  const rule = content.methods.failed[e.type];
  if (!rule) return;
  const open = livePuzzles(ctx).filter(
    (q) =>
      wayOf(ctx, q).failures.includes(e.type) &&
      since(day, q['failed'] as number, content.methods.failure.days),
  );
  const job = (q: EntityRow) => wayOf(ctx, q).job;
  const hours = (q: EntityRow) => hoursAt(ctx, q['person'] as number, job(q));
  const q =
    rule.by === 'actor'
      ? open.find((x) => e.actors.includes(x['person'] as number))
      : open
          .filter((x) => workedToday(ctx, x['person'] as number, job(x)))
          .sort((a, b) => hours(b) - hours(a) || a.id - b.id)[0];
  if (!q) return;
  q['failed'] = day;
  addHint(ctx, q, 'failure', [e.id], { failed: fill(rule.words, e.data) });
}

/** A stranger's coming: each puzzler may see something new. */
function seen(ctx: SystemContext, e: SimEvent): void {
  const s = ctx.content.methods.seen;
  for (const q of livePuzzles(ctx)) {
    if (q['ended']) continue;
    const had = hintsOf(ctx.world, q.id).filter((h) => h['kind'] === 'seen').length;
    if (had < s.most && ctx.rng().int(s.odds) === 0)
      addHint(ctx, q, 'seen', [e.id], { names: e.data['names'] });
  }
}

/** A book read: a hint when it is of the puzzle's skill. */
function book(ctx: SystemContext, e: SimEvent): void {
  const { world, content } = ctx;
  const q = livePuzzles(ctx).find((x) => x['person'] === e.actors[0]);
  const skill = q && wayOf(ctx, q).skill;
  const word = skill && content.abilities.find((a) => a.id === skill)?.name.toLowerCase();
  if (!q || !word || e.data['skill'] !== word) return;
  if (!since(today(world), q['read'] as number, content.methods.book.days)) return;
  q['read'] = today(world);
  addHint(ctx, q, 'book', [e.id], { book: e.data['book'] });
}

/** The hour's new lines. */
export function readLines(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const fresh = linesAfter(world.log, state['seen'] ?? 0);
  if (!fresh.length) return;
  state['seen'] = fresh.at(-1)!.id;
  const failures = new Set(content.methods.methods.flatMap((m) => m.failures));
  for (const e of fresh) {
    const credit = content.methods.credit.find((c) => c.event === e.type);
    const who = credit && alive(world).find((p) => p.id === e.actors[0]);
    if (credit && who) addHours(ctx, who, credit.job, credit.hours, e.id);
    if (failures.has(e.type)) failure(ctx, e);
    const s = content.methods.seen;
    if (e.type === s.event || s.also?.includes(e.type)) seen(ctx, e);
    if (e.type === content.methods.master.event) masterHints(ctx, e);
    if (e.type === content.methods.master.stays) broughtWays(ctx, e);
    if (e.type === content.methods.book.event) {
      bookLearn(ctx, e);
      book(ctx, e);
    }
  }
}

/** The new tales held: hearing of a find in one's own trade (not one's own) may be a hint. */
export function readTales(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const tales = (world.entities['tale'] ?? []).filter((t) => t.id > (state['tales'] ?? 0));
  if (!tales.length) return;
  state['tales'] = Math.max(...tales.map((t) => t.id));
  for (const t of tales) {
    const story = entityOf(world, 'story', t['story'] as number);
    if (story?.['tale'] !== content.methods.tale.id) continue;
    const find = knowsOf(world).find((k) => k['how'] === 'found' && k['line'] === story['event']);
    const m = find && methodDef(content, find['method'] as string);
    const q = livePuzzles(ctx).find((x) => x['person'] === t['person']);
    if (!m || !q || find['person'] === t['person'] || wayOf(ctx, q).job !== m.job) continue;
    if (ctx.rng().int(content.methods.tale.odds) !== 0) continue;
    const finder = entityOf(world, 'person', find['person'] as number);
    addHint(ctx, q, 'tale', [t['line'] as number], {
      ...{ finder: finder?.['name'] ?? 'someone', found: m.name },
    });
  }
}

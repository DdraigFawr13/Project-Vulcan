// The lord's asks (6C Slice 3, V-225). From his `asks.from`th visit (the first tithe year's) the
// reeve brings one ask at each visit, by the lord's temper (asks.json `lord.asks`), due at his next
// visit or by midwinter. The visit first settles the asks then due: done, the favour rises; let
// pass (or never answered), it falls; taken up and not ready, it falls more; a cruel lord doubles
// both costs. Each is a favour cause for `favour.days` with a line.
import { clockAt, TICKS_PER_DAY, TICKS_PER_HOUR, type EntityRow } from '../core/index.ts';
import { addAsk, settleAsk, wantsOf } from '../asks/index.ts';
import { liveAsks } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addFavour } from './favour.ts';
import { lordName, lordRow, pronounsOf } from './tables.ts';

const lordAsks = (ctx: SystemContext): EntityRow[] =>
  liveAsks(ctx.world).filter((a) => a['source'] === 'lord');

/** The first tick of the coming midwinter's day (`asks.midwinter`), at 06:00. */
function midwinter(ctx: SystemContext): number {
  const { world, content } = ctx;
  const { month, day } = content.asks.midwinter;
  const cal = content.calendar;
  const year = clockAt(world.tick, cal).year;
  const at = (y: number) =>
    ((y - 1) * cal.monthsPerYear * cal.daysPerMonth + month * cal.daysPerMonth + day - 1) *
      TICKS_PER_DAY +
    6 * TICKS_PER_HOUR;
  return at(year) > world.tick ? at(year) : at(year + 1);
}

/** What the cost of one ask comes to: doubled for a lord whose temper doubles it. */
const timesOf = (ctx: SystemContext, kind: string): number =>
  kind !== 'askDone' &&
  ctx.content.asks.lord.double.includes(lordRow(ctx.world)?.['temper'] as string)
    ? 2
    : 1;

/** Settles lord's ask `a`, citing `cause`, and adds its favour cause. */
function settle(ctx: SystemContext, a: EntityRow, cause: number, who: string): void {
  const { how, line } = settleAsk(ctx, a, [cause], { who });
  const kind = how === 'done' ? 'askDone' : how === 'late' ? 'askLate' : 'askPassed';
  addFavour(ctx, kind, [line], { what: a['what'] as string }, timesOf(ctx, kind));
}

/** At a visit: the lord's asks due at it are settled; then, from his `from`th visit, his new ask. */
export function askAtVisit(ctx: SystemContext, cause: number): void {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  for (const a of lordAsks(ctx))
    if (!(a['due'] as number)) settle(ctx, a, cause, lord['reeve'] as string);
  lord['visits'] = ((lord['visits'] as number) || 0) + 1;
  if ((lord['visits'] as number) < content.asks.from - 1) return;
  const found = content.asks.lord.asks.find((d) => d.temper === lord['temper']);
  if (!found) return;
  const words = pronounsOf(lord);
  const def = { ...found, what: found.what.replace('{his}', words.his) };
  const wants = wantsOf(ctx, def);
  const due = def.due === 'midwinter' ? midwinter(ctx) : 0;
  const line = ctx.emit('lord.asked', {
    causes: [cause],
    data: {
      ...{ reeve: lord['reeve'] as string, lord: lordName(lord), what: def.what },
      due: due ? 'by midwinter' : `by ${words.his} next visit`,
      count: String(wants.count),
    },
  });
  addAsk(ctx, { ...wants, source: 'lord', asker: lordName(lord), cite: cause, line, due });
}

/** Each hour: a lord's ask due by a day (midwinter) is settled when the day comes. */
export function lordAsksDue(ctx: SystemContext): void {
  for (const a of lordAsks(ctx)) {
    const due = a['due'] as number;
    if (due && ctx.world.tick >= due) settle(ctx, a, a['line'] as number, 'a rider of the lord');
  }
}

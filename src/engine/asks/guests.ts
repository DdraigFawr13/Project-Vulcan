// Guests (6C Slice 3, V-225). A stranger the colony turned away may stop on the road home and ask
// to stay one season (at most one such ask a season): open `guests.answer` days. Taken up, they
// stay in the hall as one of the colony, eating and working, and those who spoke against them gain
// `guests.against`; at the season's end they tell of their village (a line a puzzler may take a
// seen hint from, discover reads.ts) and the colony talks them over again (band verdict.ts). Let
// pass or unanswered, they walk on home. One fleeing a feud asks it as their village's ask, and
// its regard moves as a village's does.
import { clockAt, TICKS_PER_DAY, type EntityRow, type SimEvent } from '../core/index.ts';
import { admit, namesOf, sendBack } from '../band/index.ts';
import { alive, people } from '../entity/index.ts';
import { liveAsks } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addAsk, settleAsk } from './asks.ts';
import { moveRegard } from './villages.ts';

const FEUD = 'feud';

/** The stranger and the partner who came with them. */
function groupOf(ctx: SystemContext, p: EntityRow): EntityRow[] {
  const mate = people(ctx.world).find((q) => q.id === p['partner'] && q['home'] === p['home']);
  return mate && mate['guest'] === p['guest'] ? [p, mate] : [p];
}

/** The line that turned `p` away, from the end of the log. */
function turnedAway(ctx: SystemContext, p: EntityRow): SimEvent | undefined {
  const log = ctx.world.log;
  for (let k = log.length - 1; k >= 0 && k >= log.length - 500; k -= 1) {
    const e = log[k]!;
    if (e.type === 'people.strangerTurnedAway' && e.actors.includes(p.id)) return e;
  }
  return undefined;
}

const seasonOf = (ctx: SystemContext): number => {
  const c = clockAt(ctx.world.tick, ctx.content.calendar);
  return c.year * 4 + c.season;
};

/** Each minute: one turned away just now (on the road home, not yet asked) stops and asks to stay
 * a season, if no one has asked this season; returns the season of the last such ask. */
export function guestsAsk(ctx: SystemContext, last: number): number {
  const { world, content } = ctx;
  const g = content.asks.guests;
  if (seasonOf(ctx) === last) return last;
  for (const p of people(world)) {
    if (p['status'] !== 'stranger' || p['waits'] !== -1 || p['guest']) continue;
    const away = turnedAway(ctx, p);
    if (!away) continue;
    const group = groupOf(ctx, p);
    const feud = p['reason'] === FEUD;
    const what = feud ? g.feud : g.what;
    for (const q of group) Object.assign(q, { guest: -1, waits: -2, path: [] });
    const line = ctx.emit('guest.asked', {
      causes: [away.id],
      actors: group.map((q) => q.id),
      data: { names: namesOf(group), s: group.length > 1 ? '' : 's', what },
    });
    const due = world.tick + g.answer * TICKS_PER_DAY;
    addAsk(ctx, {
      ...{ source: feud ? 'neighbour' : 'guest', asker: namesOf(group), what, count: 1 },
      ...{ cite: away.id, line, due, of: String(p.id), good: 'guest' },
    });
    return seasonOf(ctx);
  }
  return last;
}

/** The guests an ask is for, by its `of` (the one who asked). */
const guestsOf = (ctx: SystemContext, a: EntityRow): EntityRow[] => {
  const p = people(ctx.world).find((q) => String(q.id) === a['of']);
  return p ? groupOf(ctx, p) : [];
};

/** Taken up: the guests come into the hall for the season; those who spoke against are sour. */
function takeIn(ctx: SystemContext, a: EntityRow, group: EntityRow[]): void {
  const { world, content } = ctx;
  const cal = content.calendar;
  const season = (cal.monthsPerYear / cal.seasons.length) * cal.daysPerMonth * TICKS_PER_DAY;
  const line = ctx.emit('guest.stays', {
    causes: [a['answer'] as number, a['line'] as number],
    actors: group.map((q) => q.id),
    data: { names: namesOf(group), s: group.length > 1 ? '' : 's', what: a['what'] as string },
  });
  // Who spoke for them when they were turned away (the line's `spokeFor` ids).
  const away = world.log.find((l) => l.id === a['cite']);
  const fors = new Set(String(away?.data['spokeFor'] ?? '').split('|'));
  const band = alive(world).filter((q) => !fors.has(String(q.id)));
  for (const q of group) {
    admit(ctx, q, line);
    Object.assign(q, { guest: world.tick + season, wantsFrom: world.tick + season * 4 });
  }
  for (const q of band) addMemory(ctx, q.id, content.asks.guests.against, line, group[0]!.id);
  Object.assign(a, { got: 1, due: world.tick + season });
}

/** A feud's guest ask moves its village's regard, as a village's ask does. */
function feudRegard(
  ctx: SystemContext,
  a: EntityRow,
  how: 'done' | 'late' | 'passed',
  line: number,
) {
  const place = guestsOf(ctx, a)[0]?.['home'] as string | undefined;
  if (a['source'] !== 'neighbour' || !place) return;
  const r = ctx.content.asks.regard;
  moveRegard(ctx, place, r[how], line, r.words[how].replace('{what}', a['what'] as string));
}

/** Let pass or unanswered: the ask passes and they walk on home. */
function turnAway(ctx: SystemContext, a: EntityRow, group: EntityRow[]): void {
  const cause = (a['state'] === 'passed' ? a['answer'] : a['line']) as number;
  const { line } = settleAsk(ctx, a, [cause], { who: namesOf(group) });
  feudRegard(ctx, a, 'passed', line);
  if (group.length && group.every((q) => q['waits'] === -2)) sendBack(ctx, group);
}

/** A guest's season over: a tale of home settles the ask, and the colony talks them over again. */
function seasonOver(ctx: SystemContext, a: EntityRow, group: EntityRow[]): void {
  const here = group.filter((q) => q['status'] === 'alive');
  const tale = ctx.emit('guest.tale', {
    causes: [a['line'] as number],
    actors: here.map((q) => q.id),
    data: {
      ...{ names: namesOf(group), s: group.length > 1 ? '' : 's' },
      place: group[0]?.['home'] as string,
    },
  });
  Object.assign(a, { state: 'done', settled: tale, going: [] });
  feudRegard(ctx, a, 'done', tale);
  for (const q of here)
    Object.assign(q, { status: 'stranger', waits: ctx.world.tick, path: [], job: '', guest: -1 });
}

/** Each minute: guest asks as the colony answers them, and guests whose season is over. */
export function guestsMinute(ctx: SystemContext): void {
  const { world } = ctx;
  for (const a of liveAsks(world)) {
    if (a['good'] !== 'guest') continue;
    const group = guestsOf(ctx, a);
    if (a['got']) {
      if (world.tick >= (a['due'] as number)) seasonOver(ctx, a, group);
      continue;
    }
    const waiting = group.length > 0 && group.every((q) => q['waits'] === -2);
    if (a['state'] === 'taken' && waiting) takeIn(ctx, a, group);
    else if (a['state'] === 'passed' || world.tick >= (a['due'] as number) || !waiting)
      turnAway(ctx, a, group);
  }
}

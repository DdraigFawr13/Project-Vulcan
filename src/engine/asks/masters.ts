// Wandering masters (6C Slice 7, V-236). From the `from`th year, at the strangers' hour on the
// first day of a spring or summer month, a master may come (1 in 100 `odds`, more for a valley
// with songs and bynames), at most one a year and never while another is about: a master of a
// trade the new ways belong to, from a neighbour known for its skill, else from the lord's seat,
// knowing one of its ways nobody living here knows. At the green they ask (an ask, source
// `wanderer`) for a bed in the hall and food for a season. Taken up, they stay as a guest does
// (guests.ts): they work their trade, so whoever works it near them far enough below learns at a
// master's pace (band learn.ts); a scholar's book goes on the schoolroom shelf. At the season's end
// `master.taught` names whom they taught, each puzzler on one of their trade's ways takes a hint
// from it (discover reads.ts), and the band talks them over; one who stays keeps their way.
import {
  clockAt,
  list,
  type EntityRow,
  type MasterTradeDef,
  type RngStream,
} from '../core/index.ts';
import { famePercent, knownOf, namesOf, walkIn, type Walker } from '../band/index.ts';
import { knowersOf } from '../discover/index.ts';
import { people, tableOf } from '../entity/index.ts';
import { pronouns } from '../health/index.ts';
import { neighboursOf } from '../region/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { shelveBook, skillWord, taughtOf } from '../teach/index.ts';
import { addAsk } from './asks.ts';

const DAY = 1440;

/** A master on the road, at the green, staying the season or being talked over. */
const about = (p: EntityRow): boolean =>
  !!p['master'] &&
  (p['status'] === 'stranger' || (p['status'] === 'alive' && (p['guest'] as number) > 0));

/** The kind of master: a trade, or the scholar with another trade's skill and ways. */
function drawTrade(rng: RngStream, trades: readonly MasterTradeDef[]) {
  const t = rng.pick(trades);
  const base = t.book ? rng.pick(trades.filter((x) => !x.book)) : t;
  return { noun: t.noun, skill: base.skill ?? '', ways: base.ways ?? [], book: !!t.book };
}

/** Where they come from: a neighbour known for the skill, else the lord's seat, else any
 * neighbour; with the words saying why. */
function homeOf(ctx: SystemContext, rng: RngStream, skill: string) {
  const { world, content } = ctx;
  const near = neighboursOf(world.seed, content);
  const known = near.filter((n) => knownOf(content, n.kind, n.culture)?.skill === skill);
  const people = (id: string) => content.cultures.find((c) => c.id === id)?.name ?? id;
  if (known.length) {
    const n = rng.pick(known);
    const key = knownOf(content, n.kind, n.culture)!.key;
    const why = content.strangers.known.why[key] ?? '';
    const home = { name: n.name, culture: n.culture, days: n.days, dir: n.dir };
    return {
      home,
      key,
      why: why.replace('{place}', n.name).replace('{people}', people(n.culture)),
    };
  }
  const lord = tableOf(world, 'lord')[0];
  const words = content.asks.masters;
  if (lord) {
    const name = lord['home'] as string;
    const culture = lord['culture'] as string;
    const home = { name, culture, days: words.far, dir: lord['dir'] as string };
    return { home, key: '', why: `${name} is where the ${lord['title'] as string} sits` };
  }
  if (!near.length) return undefined;
  const n = rng.pick(near);
  const home = { name: n.name, culture: n.culture, days: n.days, dir: n.dir };
  return { home, key: '', why: 'they go where their work is wanted' };
}

/** Hourly: on a spring or summer month's first day, at the strangers' hour, a master may come.
 * Returns the year the last one came. */
export function mastersCome(ctx: SystemContext, last: number): number {
  const { world, content } = ctx;
  const m = content.asks.masters;
  const c = clockAt(world.tick, content.calendar);
  if (c.year < m.from || c.year === last || c.day !== 1 || !m.months.includes(c.month)) return last;
  if (c.hour !== content.strangers.draw.hour || c.minute !== 0) return last;
  if (people(world).some(about)) return last;
  const rng = ctx.rng();
  const odds = m.odds + Math.floor((famePercent(world, content) * m.fame) / 100);
  if (rng.int(100) >= odds) return last;
  return comes(ctx, rng) ? c.year : last;
}

/** A master is drawn and sets off; none when there is nowhere they could come from. */
export function comes(ctx: SystemContext, rng: RngStream): EntityRow | undefined {
  const { world, content } = ctx;
  const m = content.asks.masters;
  const t = drawTrade(rng, m.trades);
  const from = homeOf(ctx, rng, t.skill);
  if (!from || !t.skill) return undefined;
  const unknown = t.ways.filter((w) => !knowersOf(world, w).length);
  const way = rng.pick(unknown.length ? unknown : t.ways);
  const level = rng.between(m.level[0]!, m.level[1]!);
  const settled = tableOf(world, 'colony')[0]?.['settled'] as number | undefined;
  const say = (p: EntityRow) =>
    ctx.emit('master.came', {
      causes: [settled || world.begunEvent],
      actors: [p.id],
      data: {
        ...{ name: p['name'] as string, noun: t.noun, place: from.home.name, dir: from.home.dir },
        ...{ book: t.book ? ', carrying a book' : '', why: from.why },
      },
    });
  const walker: Walker = {
    ...{ home: from.home, skill: t.skill, level, reach: m.reach, say },
    extra: { master: t.noun, way, known: from.key ? t.skill : '', knownWhy: from.key },
  };
  const p = walkIn(ctx, rng, walker);
  return p;
}

/** Each minute: a master come to the green asks for a bed and food for a season. */
export function mastersAsk(ctx: SystemContext): void {
  const { world, content } = ctx;
  const m = content.asks.masters;
  for (const p of people(world)) {
    if (!p['master'] || p['status'] !== 'stranger' || p['waits'] !== -2) continue;
    if (p['stranger'] || (p['path'] as number[]).length) continue;
    const line = ctx.emit('master.asked', {
      causes: [p['arrived'] as number],
      actors: [p.id],
      data: { name: p['name'] as string, noun: p['master'] as string, what: m.what },
    });
    p['stranger'] = line;
    addAsk(ctx, {
      ...{ source: 'wanderer', asker: namesOf([p]), what: m.what, count: 1, good: 'guest' },
      ...{ cite: p['arrived'] as number, line, due: world.tick + m.answer * DAY, of: String(p.id) },
    });
  }
}

/** Taken in: a scholar's book goes on the schoolroom shelf, or stays with them for want of one. */
export function masterIn(ctx: SystemContext, p: EntityRow, line: number): void {
  const { world, content } = ctx;
  const def = content.asks.masters.trades.find((t) => t.noun === p['master']);
  if (!def?.book) return;
  const skill = skillOf(ctx, p);
  const row = tableOf(world, 'skill').find((s) => s['person'] === p.id && s['skill'] === skill);
  const level = (row?.['level'] as number) ?? 0;
  const kept = shelveBook(ctx, p, { skill, level, line });
  const book = `the book of ${skillWord(content, skill)}`;
  ctx.emit('master.book', {
    causes: [line],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      did: kept
        ? `puts ${book} on the schoolroom shelf`
        : `keeps ${book}: the valley has no schoolroom shelf to keep it on`,
    },
  });
}

/** The master's skill: the one their way belongs to. */
function skillOf(ctx: SystemContext, p: EntityRow): string {
  const way = ctx.content.methods.methods.find((x) => x.id === p['way']);
  return way?.skill ?? '';
}

/** A master's season over: whom they taught, and the ways of their trade a puzzler may take a hint
 * from. Returns the line. */
export function masterTaught(ctx: SystemContext, a: EntityRow, p: EntityRow): number {
  const { world, content } = ctx;
  const since = a['answer'] as number;
  const ids = new Set(
    taughtOf(world)
      .filter((t) => t['teacher'] === p.id && (t['last'] as number) > since)
      .map((t) => t['learner'] as number),
  );
  const learners = people(world).filter((q) => ids.has(q.id));
  const w = pronouns(p);
  const skill = skillOf(ctx, p);
  const ways = content.methods.methods.filter((x) => x.skill === skill).map((x) => x.id);
  return ctx.emit('master.taught', {
    causes: [a['line'] as number],
    actors: [p.id, ...learners.map((q) => q.id)],
    data: {
      ...{ name: p['name'] as string, names: p['name'] as string, noun: p['master'] as string },
      taught: learners.length
        ? `taught ${list(learners.map((q) => q['name'] as string))} at ${w.their} side`
        : `found nobody near enough in skill to teach`,
      ...{ them: w.them, ways: ways.join('|') },
    },
  });
}

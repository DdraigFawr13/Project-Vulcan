// Wandering masters (6C Slice 7, V-236). From the `from`th year, at the strangers' hour on the
// first day of a spring or summer month, a master may come (`odds` in 100, more for a valley
// with songs and bynames), at most one a year and never while another is about: a master of a
// trade the new ways belong to with a way nobody living here knows (none comes if every way is
// known), from a neighbour known for its skill, else from the lord's seat,
// knowing that way. At the green they ask (an ask, source
// `wanderer`) for a bed in the hall and food for a season. Taken up, they stay as a guest does
// (guests.ts): they work their trade, so whoever works it near them far enough below learns at a
// master's pace (band learn.ts); a scholar's book goes on the schoolroom shelf. At the season's end
// `master.taught` names whom they taught, each living puzzler on one of their trade's ways (not the master) takes a hint
// from it (discover brought.ts), and the band talks them over; one who stays keeps their way.
// A master who dies during the stay leaves no line and no hint.
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

/** The kind of master, among those with a way nobody living knows: a trade, or the scholar with
 * another trade's skill and ways; none when every way is known. */
function drawTrade(ctx: SystemContext, rng: RngStream) {
  const trades = ctx.content.asks.masters.trades;
  const open = (t: MasterTradeDef) => (t.ways ?? []).filter((w) => !knowersOf(ctx.world, w).length);
  const bases = trades.filter((x) => !x.book && open(x).length);
  if (!bases.length) return undefined;
  const t = rng.pick(trades.filter((x) => x.book || open(x).length));
  const base = t.book ? rng.pick(bases) : t;
  return { noun: t.noun, skill: base.skill ?? '', way: rng.pick(open(base)), book: !!t.book };
}

/** Where they come from: a neighbour known for the skill, else the lord's seat, else any
 * neighbour; with the words saying why. */
function homeOf(ctx: SystemContext, rng: RngStream, skill: string) {
  const { world, content } = ctx;
  const near = neighboursOf(world.seed, content);
  const known = near.filter((n) => knownOf(content, n.kind, n.culture)?.skill === skill);
  const folk = (id: string) => content.cultures.find((c) => c.id === id)?.name ?? id;
  if (known.length) {
    const n = rng.pick(known);
    const key = knownOf(content, n.kind, n.culture)!.key;
    const why = content.strangers.known.why[key] ?? '';
    const home = { name: n.name, culture: n.culture, days: n.days, dir: n.dir };
    return {
      home,
      key,
      why: why.replace('{place}', n.name).replace('{people}', folk(n.culture)),
    };
  }
  const lord = tableOf(world, 'lord')[0];
  const words = content.asks.masters;
  if (lord) {
    const name = lord['home'] as string;
    const culture = lord['culture'] as string;
    const home = { name, culture, days: words.far, dir: lord['dir'] as string };
    const why = words.words.seat
      .replace('{place}', name)
      .replace('{title}', lord['title'] as string);
    return { home, key: '', why };
  }
  if (!near.length) return undefined;
  const n = rng.pick(near);
  const home = { name: n.name, culture: n.culture, days: n.days, dir: n.dir };
  return { home, key: '', why: words.words.road };
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
  const t = drawTrade(ctx, rng);
  const from = t && homeOf(ctx, rng, t.skill);
  if (!t || !from) return undefined;
  const way = t.way;
  const level = rng.between(m.level[0]!, m.level[1]!);
  const settled = tableOf(world, 'colony')[0]?.['settled'] as number | undefined;
  const say = (p: EntityRow) =>
    ctx.emit('master.came', {
      causes: [settled || world.begunEvent],
      actors: [p.id],
      data: {
        ...{ name: p['name'] as string, noun: t.noun, place: from.home.name, dir: from.home.dir },
        ...{ book: t.book ? m.words.carrying : '', why: from.why },
      },
    });
  const walker: Walker = {
    ...{ home: from.home, skill: t.skill, level, reach: m.reach, say },
    extra: { master: t.noun, way, known: from.key ? t.skill : '', knownWhy: from.key },
  };
  return walkIn(ctx, rng, walker);
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
  const words = content.asks.masters.words;
  const book = words.book.replace('{skill}', skillWord(content, skill));
  const did = (kept ? words.shelf : words.kept).replace('{book}', book);
  ctx.emit('master.book', {
    causes: [line],
    actors: [p.id],
    data: { name: p['name'] as string, did },
  });
}

/** The master's skill: the one their way belongs to. */
function skillOf(ctx: SystemContext, p: EntityRow): string {
  const way = ctx.content.methods.methods.find((x) => x.id === p['way']);
  return way?.skill ?? '';
}

/** The ways a puzzler may take a hint on from watching `p`: their trade's (the one their way is
 * of, so a scholar's is the trade they learnt from). */
function waysOf(ctx: SystemContext, p: EntityRow): readonly string[] {
  const way = p['way'] as string;
  return ctx.content.asks.masters.trades.find((t) => t.ways?.includes(way))?.ways ?? [way];
}

/** A master's season over: whom they taught, and the ways of their trade a puzzler may take a hint
 * from. Returns the line, or 0 for a master who died during the stay. */
export function masterTaught(ctx: SystemContext, a: EntityRow, p: EntityRow): number {
  const { world, content } = ctx;
  if (p['status'] !== 'alive') return 0;
  const since = a['answer'] as number;
  const ids = new Set(
    taughtOf(world)
      .filter((t) => t['teacher'] === p.id && (t['last'] as number) > since)
      .map((t) => t['learner'] as number),
  );
  const learners = people(world).filter((q) => ids.has(q.id));
  const w = pronouns(p);
  const words = content.asks.masters.words;
  const names = list(learners.map((q) => q['name'] as string));
  return ctx.emit('master.taught', {
    causes: [a['line'] as number],
    actors: [p.id, ...learners.map((q) => q.id)],
    data: {
      ...{ name: p['name'] as string, noun: p['master'] as string },
      taught: learners.length
        ? words.taught.replace('{names}', names).replace('{their}', w.their)
        : words.nobody,
      ...{ them: w.them, ways: waysOf(ctx, p).join('|') },
    },
  });
}

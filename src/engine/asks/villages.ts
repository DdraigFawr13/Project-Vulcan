// The neighbours' asks (6C Slice 3, V-225). When a stranger comes carrying their village's trouble
// (a `strangers.reasons` kind with an ask in `asks.village`), the village asks the colony for
// help, at most once a year, due in `regard.days`. On the day someone from the village comes by
// the home road for it: done, its regard for the colony rises and a gift comes back with its next
// stranger (`asks.gifts`, by the village's kind); let pass or late, the regard falls. Each move is
// a line. Regard is kept per village from `regard.start`; later phases read it.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { addEntity, people, type Schemas } from '../entity/index.ts';
import { barnSpot } from '../build/index.ts';
import { layItem, liveAsks, asksOf, restOf } from '../goods/index.ts';
import { neighboursOf } from '../region/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addAsk, settleAsk, wantsOf } from './asks.ts';

export const REGARD_TABLES: Schemas = {
  /** A village's regard for the colony, 0 to 100, and the line of an ask done whose gift waits
   * for the village's next stranger (0 for none). */
  regard: { place: 'text', regard: 'int', gift: 'event' },
};

/** Village `place`'s regard row, made at `regard.start` the first time it is needed. */
export function regardOf(ctx: SystemContext, place: string): EntityRow {
  const rows = () => ctx.world.entities['regard'] ?? [];
  const found = rows().find((r) => r['place'] === place);
  if (found) return found;
  const start = ctx.content.asks.regard.start;
  const id = addEntity(ctx.world, 'regard', { place, regard: start, gift: 0 });
  return rows().find((r) => r.id === id)!;
}

const yearTicks = (ctx: SystemContext): number =>
  ctx.content.calendar.monthsPerYear * ctx.content.calendar.daysPerMonth * TICKS_PER_DAY;

/** Whether village `place` asked within the year (or has an ask still live). */
function askedLately(ctx: SystemContext, place: string): boolean {
  const days = ctx.content.asks.regard.days * TICKS_PER_DAY;
  return asksOf(ctx.world).some(
    (a) =>
      a['source'] === 'neighbour' &&
      a['of'] === place &&
      ((a['due'] as number) - days > ctx.world.tick - yearTicks(ctx) ||
        liveAsks(ctx.world).includes(a)),
  );
}

/** Stranger `p`, come to the green, asks for their village if its trouble has an ask. */
function villageAsk(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const def = content.asks.village[p['reason'] as string];
  const place = p['home'] as string;
  if (!def || !place || askedLately(ctx, place)) return;
  const kind = content.strangers.kinds.find((k) => k.id === p['reason']);
  const wants = wantsOf(ctx, def);
  const days = content.asks.regard.days;
  const cite = p['stranger'] as number;
  const line = ctx.emit('neighbour.asked', {
    causes: [cite],
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, place, words: kind?.words ?? 'is in need' },
      ...{ what: wants.what, days: String(days) },
    },
  });
  const due = world.tick + days * TICKS_PER_DAY;
  addAsk(ctx, { ...wants, source: 'neighbour', asker: place, cite, line, due, of: place });
}

/** Stranger `p` brings the gift their village owes for an ask done, laid at the barn. */
function giftFrom(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const place = p['home'] as string;
  const row = (world.entities['regard'] ?? []).find((r) => r['place'] === place);
  if (!row?.['gift']) return;
  const kind = neighboursOf(world.seed, content).find((n) => n.name === place)?.kind ?? '';
  const gift = content.asks.gifts[kind] ?? content.asks.gifts['else']!;
  const name = content.items.find((d) => d.id === gift.kind)?.name ?? gift.kind;
  const line = ctx.emit('ask.gift', {
    causes: [row['gift'] as number, p['stranger'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, place, what: `${gift.count} ${name}` },
  });
  const at = barnSpot(world) ?? restOf(world, content);
  layItem(world, { kind: gift.kind, count: gift.count, ...at, made: line });
  row['gift'] = 0;
}

/** Each minute: strangers come to the green since `seen` (the newest coming already seen) ask for
 * their village and bring what it owes; returns the newest coming now seen. */
export function strangersAsk(ctx: SystemContext, seen: number): number {
  let newest = seen;
  const lines = new Set<number>();
  for (const p of people(ctx.world)) {
    const line = p['stranger'] as number;
    if (!(line > seen) || lines.has(line)) continue;
    lines.add(line);
    giftFrom(ctx, p);
    villageAsk(ctx, p);
    newest = Math.max(newest, line);
  }
  return newest;
}

/** Moves village `place`'s regard by `by` with a line citing `cause`. */
export function moveRegard(
  ctx: SystemContext,
  place: string,
  by: number,
  cause: number,
  text: string,
) {
  const row = regardOf(ctx, place);
  row['regard'] = Math.max(0, Math.min(100, (row['regard'] as number) + by));
  return ctx.emit('ask.regard', {
    causes: [cause],
    data: {
      ...{ place, way: by > 0 ? 'rises' : 'falls' },
      ...{ regard: String(row['regard'] as number), text },
    },
  });
}

/** Each hour: a village's ask whose day has come is fetched and settled, and its regard moves. */
export function villagesDue(ctx: SystemContext): void {
  const r = ctx.content.asks.regard;
  for (const a of liveAsks(ctx.world)) {
    if (a['source'] !== 'neighbour' || a['good'] === 'guest') continue;
    if (ctx.world.tick < (a['due'] as number)) continue;
    const place = a['of'] as string;
    const comes = r.comes.replace('{place}', place);
    const who = comes.charAt(0).toUpperCase() + comes.slice(1);
    const { how, line } = settleAsk(ctx, a, [a['line'] as number], { who });
    const text = r.words[how].replace('{what}', a['what'] as string);
    moveRegard(ctx, place, r[how], line, text);
    if (how === 'done') regardOf(ctx, place)['gift'] = line;
  }
}

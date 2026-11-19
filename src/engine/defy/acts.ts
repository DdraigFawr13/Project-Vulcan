// The acts past refusing (P6.7, V-160). Taking: someone at the `take` step who eats from the
// store pockets `take.count` more of it, at most once in `take.every` days, for later (a held
// stash, state `hid`; people `defy.ts`). Brawling: someone at the `brawl` step, at a meal, at
// leisure or at work, comes to blows with the one their memory is about (who took a full plate),
// else the nearest keeper of the law, within `brawl.reach`, at
// most once in `brawl.every` days: both take a light wound (`deep` per cent a deep one). Anyone
// awake within `take.sight` who sees it catches them (punish.ts).
import { list, TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { inStore, layItem, takeFrom } from '../goods/index.ts';
import { wound } from '../health/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { punish } from './punish.ts';
import { atLeast, defyOf, leavingOf } from './tables.ts';
import { citesOf, grievanceOf, reasonsOf, whyWords } from './why.ts';

const far = (a: EntityRow, b: EntityRow): number =>
  a['z'] !== b['z']
    ? Infinity
    : Math.max(
        Math.abs((a['x'] as number) - (b['x'] as number)),
        Math.abs((a['y'] as number) - (b['y'] as number)),
      );

const awake = (ctx: SystemContext): EntityRow[] =>
  (ctx.world.entities['person'] ?? []).filter(
    (q) => q['status'] === 'alive' && q['doing'] !== 'sleep',
  );

/** The awake (but `p` and `but`) who see `p` now. */
function seenBy(ctx: SystemContext, p: EntityRow, but: number[] = []): EntityRow[] {
  const sight = ctx.content.defy.take.sight;
  return awake(ctx).filter((q) => q.id !== p.id && !but.includes(q.id) && far(p, q) <= sight);
}

/** `p` is caught at `act` by `saw`, who remember it: the line, then the Punishment law. */
function caught(ctx: SystemContext, p: EntityRow, act: string, saw: EntityRow[], line: number) {
  const d = ctx.content.defy;
  const did = act === 'took' ? 'taking from the store' : 'brawling';
  const at = ctx.emit('defy.caught', {
    causes: [line],
    actors: [p.id, ...saw.map((q) => q.id)],
    data: { names: list(saw.map((q) => q['name'] as string)), name: p['name'] as string, did, act },
  });
  const memory = act === 'took' ? d.memories['sawTheft']! : d.memories['sawBrawl']!;
  for (const q of saw) addMemory(ctx, q.id, memory, at, p.id);
  punish(ctx, p, at);
}

const due = (ctx: SystemContext, last: number, days: number): boolean =>
  last < 0 || ctx.world.tick - last >= days * TICKS_PER_DAY;

/** A stack still lying in a store, of food that is not of last resort (seed). */
const storeFood = (ctx: SystemContext, food: EntityRow): boolean =>
  (food['count'] as number) > 0 &&
  !food['holder'] &&
  !ctx.content.life.lastResort.includes(food['kind'] as string) &&
  inStore(ctx.world, food['x'] as number, food['y'] as number, food['z'] as number);

/** After `p` eats from `food`: at the `take` step, they pocket more of it from the store. */
export function pilfer(ctx: SystemContext, p: EntityRow, food: EntityRow): void {
  const { world, content } = ctx;
  const row = defyOf(world, p.id);
  const t = content.defy.take;
  if (!row || !atLeast(world, content, p.id, 'take') || !due(ctx, row['took'] as number, t.every))
    return;
  if (!storeFood(ctx, food)) return;
  const g = grievanceOf(world, content, p.id);
  if (!g) return;
  const why = reasonsOf(world, content, p.id, g.setting);
  // No act without the memory and the belief behind it, at the moment of the act too.
  if (!why.mem || !why.belief) return;
  const kind = food['kind'] as string;
  const n = takeFrom(world, food, t.count);
  if (!n) return;
  const spot = { x: p['x'] as number, y: p['y'] as number, z: p['z'] as number };
  const line = ctx.emit('defy.took', {
    causes: citesOf(g, why),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      count: n,
      food: (content.items.find((d) => d.id === kind)?.name ?? kind).toLowerCase(),
      why: whyWords(world, content, why),
    },
  });
  const stash = layItem(
    world,
    { kind, count: n, ...spot, made: line },
    { owner: p.id, state: 'hid' },
  );
  const item = (world.entities['item'] ?? []).find((i) => i.id === stash);
  if (item) item['holder'] = p.id;
  row['took'] = world.tick;
  const saw = seenBy(ctx, p);
  if (saw.length) caught(ctx, p, 'took', saw, line);
}

/** Each hour: those at the `brawl` step, due one and among people, come to blows. */
export function brawls(ctx: SystemContext): void {
  const { world, content } = ctx;
  const b = content.defy.brawl;
  for (const p of awake(ctx)) {
    const row = defyOf(world, p.id);
    if (
      !row ||
      !atLeast(world, content, p.id, 'brawl') ||
      !due(ctx, row['brawled'] as number, b.every)
    )
      continue;
    if (!b.doing.includes(p['doing'] as string) || leavingOf(world, p.id)) continue;
    const g = grievanceOf(world, content, p.id);
    if (!g) continue;
    const why = reasonsOf(world, content, p.id, g.setting);
    if (!why.mem || !why.belief) continue;
    // The one their memory is about (who took a full plate), else a keeper of the law, nearest.
    const keeps = (q: EntityRow) =>
      q.id === why.mem!['about'] ||
      (world.entities['answer'] ?? []).some(
        (a) => a['person'] === q.id && a['law'] === g.law && a['answer'] !== 'refuses',
      );
    const rank = (q: EntityRow) => (q.id === why.mem!['about'] ? -1 : far(p, q));
    const other = awake(ctx)
      .filter((q) => q.id !== p.id && far(p, q) <= b.reach && keeps(q))
      .sort((x, y) => rank(x) - rank(y) || x.id - y.id)[0];
    if (!other) continue;
    const line = ctx.emit('defy.brawled', {
      causes: citesOf(g, why),
      actors: [p.id, other.id],
      data: {
        name: p['name'] as string,
        other: other['name'] as string,
        days: g.setting.days,
        why: whyWords(world, content, why),
      },
    });
    row['brawled'] = world.tick;
    for (const [x, y] of [
      [p, other],
      [other, p],
    ] as const) {
      const rng = ctx.rng();
      const severity = rng.int(100) < b.deep ? 'deep' : 'light';
      const kind = rng.pick(b.kinds);
      const part = rng.pick(b.parts);
      const what = b.what.replace('{other}', y['name'] as string);
      wound(ctx, x, { part, kind, severity, what, where: 'green', place: 'on' }, [line], false);
      addMemory(ctx, x.id, content.defy.memories['brawled']!, line, y.id);
    }
    caught(ctx, p, 'brawled', [other, ...seenBy(ctx, p, [other.id])], line);
  }
}

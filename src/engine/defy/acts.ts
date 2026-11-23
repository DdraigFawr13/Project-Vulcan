// The acts past refusing (P6.7, V-160). Taking: someone at the `take` step (or, 6A review P2,
// someone who went hungry and believes the valley cannot feed them, in hard times) who eats from
// the store pockets `take.count` more of it, at most once in `take.every` days, for later (a held
// stash, state `hid`; people `defy.ts`). Brawling: someone at the `brawl` step, at a meal, at
// leisure or at work, comes to blows with the one their memory is about (who took a full plate),
// else the nearest keeper of the law, within `brawl.reach`, at
// most once in `brawl.every` days: both take a light wound (`deep` per cent a deep one). Anyone
// awake who sees it (needs `seenBy`) catches them (punish.ts).
import { list, TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { addEntity, awake, far } from '../entity/index.ts';
import { barnOf, fromBarn, inStore, layItem, takeFrom } from '../goods/index.ts';
import { wound } from '../health/index.ts';
import { addMemory, seenBy } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { punish } from './punish.ts';
import { atLeast, defyOf, leavingOf } from './tables.ts';
import { citesOf, grievanceOf, hungerWhy, reasonsOf, whyWords, type Why } from './why.ts';

/** `p` is caught at `act` by `saw`, who remember it: the line, then the Punishment law. */
function caught(ctx: SystemContext, p: EntityRow, act: string, saw: EntityRow[], line: number) {
  const d = ctx.content.defy;
  const did =
    act === 'took'
      ? 'taking from the store'
      : act === 'hid'
        ? 'taking from the tithe barn'
        : 'brawling';
  const at = ctx.emit('defy.caught', {
    causes: [line],
    actors: [p.id, ...saw.map((q) => q.id)],
    data: { names: list(saw.map((q) => q['name'] as string)), name: p['name'] as string, did, act },
  });
  const memory = act === 'brawled' ? d.memories['sawBrawl']! : d.memories['sawTheft']!;
  for (const q of saw) addMemory(ctx, q.id, memory, at, p.id);
  punish(ctx, p, at, saw);
}

const due = (ctx: SystemContext, last: number, days: number): boolean =>
  last < 0 || ctx.world.tick - last >= days * TICKS_PER_DAY;

/** A stack still lying in a store, of food that is not of last resort (seed). */
const storeFood = (ctx: SystemContext, food: EntityRow): boolean =>
  (food['count'] as number) > 0 &&
  !food['holder'] &&
  !ctx.content.life.lastResort.includes(food['kind'] as string) &&
  inStore(ctx.world, food['x'] as number, food['y'] as number, food['z'] as number);

/** The answer, memory and belief behind `p` taking now: their grievance at the `take` step, else
 * hunger with no law behind it (`hungerWhy`). */
function takeWhy(
  ctx: SystemContext,
  p: EntityRow,
  law?: string,
): { cites: number[]; why: Why } | undefined {
  const { world, content } = ctx;
  let g = atLeast(world, content, p.id, 'take') ? grievanceOf(world, content, p.id) : undefined;
  // From the tithe barn (6C Slice 2): only a grievance against the Lord law, else hunger.
  if (law && g?.law !== law) g = undefined;
  let why = g ? reasonsOf(world, content, p.id, g.setting) : {};
  // A grievance without its memory and belief still leaves hunger as a reason.
  if (!why.mem || !why.belief) {
    g = undefined;
    why = hungerWhy(world, content, p.id);
  }
  // No act without the memory and the belief behind it, at the moment of the act too.
  if (!why.mem || !why.belief) return undefined;
  const cites = g
    ? citesOf(g, why)
    : [...new Set([why.mem['line'] as number, why.belief['line'] as number])].filter((l) => l > 0);
  return { cites, why };
}

/** After `p` eats from `food`: at the `take` step, or starving in hard times, they pocket more
 * of it from the store. */
export function pilfer(ctx: SystemContext, p: EntityRow, food: EntityRow): void {
  const { world, content } = ctx;
  const row = defyOf(world, p.id);
  const t = content.defy.take;
  if (!row || !due(ctx, row['took'] as number, t.every) || !storeFood(ctx, food)) return;
  const reason = takeWhy(ctx, p);
  if (!reason) return;
  const { why } = reason;
  const kind = food['kind'] as string;
  const n = takeFrom(world, food, t.count);
  if (!n) return;
  const spot = { x: p['x'] as number, y: p['y'] as number, z: p['z'] as number };
  const line = ctx.emit('defy.took', {
    causes: reason.cites,
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
  const saw = seenBy(ctx.world, ctx.content, p);
  if (saw.length) caught(ctx, p, 'took', saw, line);
}

/** Food in the tithe barn, the kind there is most of first (6C Slice 2). */
function barnFood(ctx: SystemContext): string[] {
  const eat = ctx.content.life.eat;
  return barnOf(ctx.world)
    .filter((b) => (eat[b.kind] ?? 0) > 0)
    .sort((a, b) => b.count - a.count || (a.kind < b.kind ? -1 : 1))
    .map((b) => b.kind);
}

/** Whether `p` would take from the tithe barn now (6C Slice 2, V-222): due a take, with food in
 * the barn, and a grievance against the Lord law at the `take` step (else hunger in hard times)
 * with its memory and belief. */
export function raidsBarn(ctx: SystemContext, p: EntityRow): boolean {
  const row = defyOf(ctx.world, p.id);
  if (!row || !due(ctx, row['took'] as number, ctx.content.defy.take.every)) return false;
  return barnFood(ctx).length > 0 && !!takeWhy(ctx, p, ctx.content.lord.tithe.law);
}

/** At the tithe barn: `p` takes `take.count` of its food and hides it at home (a held stash, as
 * from the store), a line citing the answer, memory and belief; seen, they are caught. */
export function hideFromBarn(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const row = defyOf(world, p.id);
  const reason = row && takeWhy(ctx, p, content.lord.tithe.law);
  const kind = barnFood(ctx)[0];
  if (!row || !reason || !kind) return;
  const n = fromBarn(world, kind, content.defy.take.count);
  if (!n) return;
  const line = ctx.emit('defy.hidTithe', {
    causes: reason.cites,
    actors: [p.id],
    data: {
      ...{ name: p['name'] as string, count: n },
      food: (content.items.find((d) => d.id === kind)?.name ?? kind).toLowerCase(),
      why: whyWords(world, content, reason.why),
    },
  });
  const spot = { x: p['x'] as number, y: p['y'] as number, z: p['z'] as number };
  const stash = layItem(
    world,
    { kind, count: n, ...spot, made: line },
    { owner: p.id, state: 'hid' },
  );
  const item = (world.entities['item'] ?? []).find((i) => i.id === stash);
  if (item) item['holder'] = p.id;
  addEntity(world, 'hidden', { item: stash, person: p.id, kind, count: n, line });
  row['took'] = world.tick;
  const saw = seenBy(world, content, p);
  if (saw.length) caught(ctx, p, 'hid', saw, line);
}

/** Each hour: those at the `brawl` step, due one and among people, come to blows. */
export function brawls(ctx: SystemContext): void {
  const { world, content } = ctx;
  const b = content.defy.brawl;
  for (const p of awake(ctx.world)) {
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
    const other = awake(ctx.world)
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
    caught(ctx, p, 'brawled', [other, ...seenBy(ctx.world, ctx.content, p, [other.id])], line);
  }
}

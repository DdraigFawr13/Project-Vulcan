// Cooking (V-090, V-041): the Cook row of the Work sheet. Nobody is told to cook. While the cooked
// meals the colony has (in the store, lying about or carried) are under `cook.perPerson` for each
// person alive, i.e. tomorrow's meals, and a fire is lit anywhere, a free person able for the job
// takes it up: they walk to the nearest stack of raw food with a batch's worth in it (rawFor) (grain first,
// then the other kinds in `cook.from` order) and take that much, with one piece of firewood from
// the store (the store is a few tiles across, so it is taken on the same visit), go and stand
// beside the lit hearth, work there `cook.minutes` (shorter with cooking skill, practising it),
// and lay `cook.batch` meals there for haulers to carry to the store. With no lit fire or no
// firewood or raw food to be had, nobody cooks and the band eats raw. Taking up and each batch
// are ledger lines; trips are not.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { furnitureOf } from '../build/index.ts';
import { fireOf, firesOf, pieceOfFire, placeOf } from '../fire/index.ts';
import { inStore, itemsOf, layItem, loadOf, takeFrom } from '../goods/index.ts';
import { canReach, reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { able, outranked, priorityLine } from './priority.ts';
import {
  besideReachable,
  busy,
  goBeside,
  layAround,
  people,
  same,
  skillOf,
  spotOf,
} from './spots.ts';
import { walkTo } from './walk.ts';

const JOB = 'cook';

/** What `p` would cook: the raw food stack to fetch and the lit fire's hearth piece. */
interface Pick {
  raw: EntityRow;
  piece: EntityRow;
  have: number;
  want: number;
}

const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.work.cook.job)?.skill ?? '';

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0 });
  return false;
}

const alive = (world: WorldState): EntityRow[] =>
  people(world).filter((q) => q['status'] === 'alive');

/** Cooked meals anywhere (stored, lying, carried). */
export const mealsOf = (world: WorldState, content: EngineContent): number =>
  itemsOf(world)
    .filter((i) => i['kind'] === content.work.cook.meal)
    .reduce((n, i) => n + (i['count'] as number), 0);

/** Meals wanted for tomorrow, and those there are plus those other cooks are making. */
function mealsShort(ctx: SystemContext, p: EntityRow): { have: number; want: number } | undefined {
  const { world, content } = ctx;
  const def = content.work.cook;
  const want = alive(world).length * def.perPerson;
  const coming = people(world).filter((q) => q.id !== p.id && q['job'] === JOB).length * def.batch;
  const have = mealsOf(world, content);
  return have + coming < want ? { have, want } : undefined;
}

/** A piece of firewood in the store that `p` can get to. */
function fuelStack(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const from = spotOf(p);
  return itemsOf(world).find((i) => {
    if (i['kind'] !== content.work.cook.fuel || i['holder']) return false;
    const at = spotOf(i);
    return inStore(world, at.x, at.y, at.z) && canReach(content, world.map, from, at);
  });
}

/** How much of raw `kind` makes a batch: the meals' food value over `gain` times one's. */
export const rawFor = (content: SystemContext['content'], kind: string): number => {
  const def = content.work.cook;
  const meal = content.life.eat[def.meal] ?? 0;
  return Math.ceil((def.batch * meal) / (def.gain * (content.life.eat[kind] ?? meal)));
};

/** The nearest stack of raw food with a batch's worth in it, of the first kind in `cook.from` there is
 * one of, that nobody else is fetching and `p` can reach (the store's before ground at a tie). */
function rawStack(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const def = content.work.cook;
  const taken = busy(world, p, JOB);
  const from = spotOf(p);
  for (const kind of def.from) {
    let best: EntityRow | undefined;
    let far = Infinity;
    for (const i of itemsOf(world)) {
      if (
        i['kind'] !== kind ||
        i['holder'] ||
        (i['count'] as number) < rawFor(content, kind) ||
        taken.has(i.id)
      )
        continue;
      const at = spotOf(i);
      const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) * 2;
      const score = d + (inStore(world, at.x, at.y, at.z) ? 0 : 1);
      if (score < far && canReach(content, world.map, from, at)) [best, far] = [i, score];
    }
    if (best) return best;
  }
  return undefined;
}

/** What `p` would cook, if meals are short, a fire is lit and the food and fuel can be had. */
function pick(ctx: SystemContext, p: EntityRow): Pick | undefined {
  const { world, content } = ctx;
  const short = mealsShort(ctx, p);
  if (!short) return undefined;
  const from = spotOf(p);
  const lit = firesOf(world)
    .filter((f) => f['lit'])
    .map((f) => pieceOfFire(world, f))
    .filter((piece) => piece['z'] === 0)
    .sort((a, b) => {
      const d = (r: EntityRow) =>
        Math.abs((r['x'] as number) - from.x) + Math.abs((r['y'] as number) - from.y);
      return d(a) - d(b) || a.id - b.id;
    });
  const reach = reachFrom(content, world.map, from);
  const piece = lit.find((r) =>
    besideReachable(
      world,
      content,
      reach,
      (r['y'] as number) * world.map.width + (r['x'] as number),
    ),
  );
  if (!piece || !fuelStack(ctx, p)) return undefined;
  const raw = rawStack(ctx, p);
  return raw && { raw, piece, ...short };
}

/** Takes up cooking if meals are short and nobody free who puts it higher could. */
export function takeUpCooking(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.cook;
  if (!able(content, p, def.job) || outranked(ctx, p, def.job, (q) => !!pick(ctx, q))) return false;
  const got = pick(ctx, p);
  if (!got) return false;
  const fire = fireOf(world, got.piece.id);
  p['took'] = ctx.emit('work.tookUpCooking', {
    causes: [fire?.['line'] as number, priorityLine(world, p.id, def.job)].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      where: placeOf(world, content, got.piece).where,
      have: got.have,
      want: got.want,
    },
  });
  const level = skillOf(world, p, skillName(content));
  Object.assign(p, {
    job: JOB,
    plan: got.piece.id,
    target: got.raw.id,
    work: Math.ceil((def.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return cooking(ctx, p);
}

/** At the raw stack: take the firewood piece and the raw food. */
function gather(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  let raw = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!raw || (raw['count'] as number) < rawFor(content, raw['kind'] as string)) {
    raw = rawStack(ctx, p);
    if (!raw) return stop(p);
    p['target'] = raw.id;
  }
  if (!same(spotOf(raw), spotOf(p))) return walkTo(ctx, p, spotOf(raw)) || stop(p);
  const wood = fuelStack(ctx, p);
  if (!wood) return stop(p);
  takeFrom(world, wood, 1);
  const need = rawFor(content, raw['kind'] as string);
  if (raw['count'] === need) raw['holder'] = p.id;
  else {
    const made = raw['made'] as number;
    takeFrom(world, raw, need);
    const id = layItem(world, { kind: raw['kind'] as string, count: need, ...spotOf(p), made });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  p['target'] = -1;
  return true;
}

/** One minute of cooking: false when it is done, or the fire has gone out (what they carry then
 * goes back to the store). */
export function cooking(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.cook;
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  if (!piece || !fireOf(world, piece.id)?.['lit']) return stop(p);
  const load = loadOf(world, p.id);
  if (!load) return gather(ctx, p);
  if (!def.from.includes(load['kind'] as string)) return stop(p);
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const line = ctx.emit('food.cooked', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      count: def.batch,
      what: content.items.find((i) => i.id === def.meal)?.name ?? def.meal,
      where: placeOf(world, content, piece).where,
    },
  });
  layAround(ctx, def.meal, def.batch, here, line);
  takeFrom(world, load, load['count'] as number);
  return stop(p);
}

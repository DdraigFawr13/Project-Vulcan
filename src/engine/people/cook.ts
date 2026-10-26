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
// Recipes (P5.3, V-132): the cook makes the best recipe the stores allow, best first: a batch's
// worth of its main food and a little of its side food, fetched on the way; else plain fare. The
// batch is plain, good or fine by cooking level plus a roll; a cook's first fine batch is a
// notable line. With no fire lit, a cook lights an unlit hearth to cook (warm seeds lit none).
import { streamFor, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { furnitureOf } from '../build/index.ts';
import { fireOf, firesOf, pieceOfFire, placeOf } from '../fire/index.ts';
import { inStore, itemsOf, layItem, loadOf, takeFrom } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
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
  recipe: string;
  raw: EntityRow;
  side?: EntityRow;
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
    .filter((i) => content.items.find((d) => d.id === i['kind'])?.cooked)
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

/** How much of raw `kind` makes a batch: the meals' food value over `gain`, less what a recipe's
 * side food brings (at its leanest side kind), over one's. */
export const rawFor = (
  content: SystemContext['content'],
  kind: string,
  recipe?: string,
): number => {
  const def = content.work.cook;
  const meal = content.life.eat[def.meal] ?? 0;
  const r = recipe ? def.recipes.find((x) => x.id === recipe) : undefined;
  const side = r ? r.sideCount * Math.min(...r.side.map((k) => content.life.eat[k] ?? 0)) : 0;
  const worth = (def.batch * meal) / def.gain - side;
  return Math.max(1, Math.ceil(worth / (content.life.eat[kind] ?? meal)));
};

/** The nearest stack of one of `kinds` holding at least `need(kind)`, of the first kind in order
 * there is one of, that nobody else is fetching and `p` can reach (the store's before ground at a
 * tie). */
function stackOf(
  ctx: SystemContext,
  p: EntityRow,
  kinds: readonly string[],
  need: (kind: string) => number,
): EntityRow | undefined {
  const { world, content } = ctx;
  const taken = busy(world, p, JOB);
  const from = spotOf(p);
  for (const kind of kinds) {
    let best: EntityRow | undefined;
    let far = Infinity;
    for (const i of itemsOf(world)) {
      if (
        i['kind'] !== kind ||
        i['holder'] ||
        (i['count'] as number) < need(kind) ||
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

/** The best recipe that can be had: its main stack and side stack; else plain fare's raw stack. */
function recipeFor(
  ctx: SystemContext,
  p: EntityRow,
): { recipe: string; raw: EntityRow; side?: EntityRow } | undefined {
  const { content } = ctx;
  for (const r of content.work.cook.recipes) {
    const side = stackOf(ctx, p, r.side, () => r.sideCount);
    if (!side) continue;
    const raw = stackOf(ctx, p, r.main, (kind) => rawFor(content, kind, r.id));
    if (raw) return { recipe: r.id, raw, side };
  }
  const raw = stackOf(ctx, p, content.work.cook.from, (kind) => rawFor(content, kind));
  return raw && { recipe: '', raw };
}

/** What `p` would cook, if meals are short, a hearth can be had and the food and fuel can be
 * had: the nearest lit hearth they can get beside, else the nearest unlit one, to light. */
function pick(ctx: SystemContext, p: EntityRow): Pick | undefined {
  const { world, content } = ctx;
  const short = mealsShort(ctx, p);
  if (!short) return undefined;
  const from = spotOf(p);
  const near = (r: EntityRow) =>
    Math.abs((r['x'] as number) - from.x) + Math.abs((r['y'] as number) - from.y);
  const hearths = firesOf(world)
    .map((f) => ({ f, piece: pieceOfFire(world, f) }))
    .filter(({ piece }) => piece['z'] === 0)
    .sort(
      (a, b) =>
        (b.f['lit'] as number) - (a.f['lit'] as number) ||
        near(a.piece) - near(b.piece) ||
        a.piece.id - b.piece.id,
    );
  const reach = reachFrom(content, world.map, from);
  const piece = hearths.find(({ piece }) =>
    besideReachable(
      world,
      content,
      reach,
      (piece['y'] as number) * world.map.width + (piece['x'] as number),
    ),
  )?.piece;
  if (!piece || !fuelStack(ctx, p)) return undefined;
  const got = recipeFor(ctx, p);
  return got && { ...got, piece, ...short };
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
    what: got.recipe,
    work: Math.ceil((def.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  // Not yet worked at the fire: an unlit hearth is theirs to light when they get there.
  p['lit'] = p['work'] as number;
  return cooking(ctx, p);
}

const recipeOf = (content: EngineContent, id: string) =>
  content.work.cook.recipes.find((r) => r.id === id);

/** At the raw stack: take the firewood piece and the raw food; then on to the side food, if any. */
function gather(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const recipe = recipeOf(content, p['what'] as string);
  const kinds = recipe ? recipe.main : content.work.cook.from;
  const need = (kind: string) => rawFor(content, kind, recipe?.id);
  let raw = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (
    !raw ||
    !kinds.includes(raw['kind'] as string) ||
    (raw['count'] as number) < need(raw['kind'] as string)
  ) {
    raw = stackOf(ctx, p, kinds, need);
    if (!raw) return stop(p);
    p['target'] = raw.id;
  }
  if (!same(spotOf(raw), spotOf(p))) return walkTo(ctx, p, spotOf(raw)) || stop(p);
  const wood = fuelStack(ctx, p);
  if (!wood) return stop(p);
  takeFrom(world, wood, 1);
  const n = need(raw['kind'] as string);
  if (raw['count'] === n) raw['holder'] = p.id;
  else {
    const made = raw['made'] as number;
    takeFrom(world, raw, n);
    const id = layItem(world, { kind: raw['kind'] as string, count: n, ...spotOf(p), made });
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  const side = recipe && stackOf(ctx, p, recipe.side, () => recipe.sideCount);
  p['target'] = side ? side.id : -1;
  // No side food left to be had: the batch is plain fare after all.
  if (recipe && !side) p['what'] = '';
  return true;
}

/** Holding the main food: walk to the side food and put `sideCount` of it in the pot. */
function addSide(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const recipe = recipeOf(content, p['what'] as string);
  const side = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!recipe || !side || (side['count'] as number) < recipe.sideCount) {
    const other = recipe && stackOf(ctx, p, recipe.side, () => recipe.sideCount);
    p['target'] = other ? other.id : -1;
    if (!other) p['what'] = '';
    return true;
  }
  if (!same(spotOf(side), spotOf(p))) return walkTo(ctx, p, spotOf(side)) || stop(p);
  takeFrom(world, side, recipe.sideCount);
  p['target'] = -1;
  return true;
}

/** Lights the unlit hearth with the batch's firewood, saying so. */
function light(ctx: SystemContext, p: EntityRow, piece: EntityRow, fire: EntityRow): void {
  const { world, content } = ctx;
  const fuel = content.work.fire.fuels.find((f) => f.item === content.work.cook.fuel);
  Object.assign(fire, {
    lit: 1,
    banked: 0,
    used: world.tick,
    fuel: fuel?.minutes ?? 60,
    kind: fuel?.id ?? (fire['kind'] as string),
  });
  fire['line'] = ctx.emit('fire.lit', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      where: placeOf(world, content, piece).where,
      why: 'a meal was to be cooked',
    },
  });
}

/** The batch's grade: cooking level plus the roll, the first grade reached. */
function gradeOf(ctx: SystemContext, p: EntityRow) {
  const def = ctx.content.work.cook;
  const score =
    skillOf(ctx.world, p, skillName(ctx.content)) +
    streamFor(ctx.world, def.stream).between(-def.roll, def.roll);
  return def.grades.find((g) => score >= g.at) ?? def.grades[def.grades.length - 1]!;
}

/** One minute of cooking: false when it is done, or the fire has gone out (what they carry then
 * goes back to the store). */
export function cooking(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.cook;
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  const fire = piece && fireOf(world, piece.id);
  if (!piece || !fire) return stop(p);
  const load = loadOf(world, p.id);
  if (!load) return gather(ctx, p);
  if (!def.from.includes(load['kind'] as string)) return stop(p);
  if ((p['target'] as number) > 0) return addSide(ctx, p);
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  if (!fire['lit']) {
    // They brought the fire's wood: lit once, else it went out while they cooked.
    if (p['work'] !== p['lit']) return stop(p);
    light(ctx, p, piece, fire);
  }
  p['work'] = (p['work'] as number) - 1;
  p['lit'] = p['work'] as number;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const recipe = recipeOf(content, p['what'] as string);
  const item = recipe ? recipe.item : def.meal;
  const grade = gradeOf(ctx, p);
  const what = `${grade.id} ${content.items.find((i) => i.id === item)?.name ?? item}`;
  const line = ctx.emit('food.cooked', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      count: def.batch,
      what,
      where: placeOf(world, content, piece).where,
    },
  });
  layAround(ctx, item, def.batch, here, line, '', grade.id);
  takeFrom(world, load, load['count'] as number);
  if (grade.id === 'fine') {
    addMemory(ctx, p.id, def.fineMemory, line);
    if (!p['fineMeal'])
      p['fineMeal'] = ctx.emit('food.firstFine', {
        causes: [line],
        actors: [p.id],
        data: { name: p['name'] as string, what },
      });
  }
  return stop(p);
}

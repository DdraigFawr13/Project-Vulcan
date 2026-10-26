// The chandler (P5.13, V-135): the Candlemaking row of the Work sheet. Nobody is told to dip
// candles. A free, able person takes it up at a lit fire, on the first of `lamp.chandler.recipes`
// that is wanted and has its inputs in the store: soap while the soap held (stored or carried)
// is under `soap.keep`, the candle recipes while the candles the colony has (tallow and wax, the
// band's kept with the cart too) plus those being made are under the Candles plate. They fetch
// the recipe's first input from the store, carry it to the nearest lit hearth (one in a room
// first), work `minutes × 2 × skilled ÷ (skilled + level)` beside it, draw any other input from
// the store (ash from the hearths' pits) as the batch is made and lay the result around the hearth for haulers. Taking up and
// each batch are lines; trips are not. `p.make` holds the recipe id.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { furnitureOf } from '../build/index.ts';
import { ashIn, fireOf, firesOf, pieceOfFire, placeOf, takeAsh } from '../fire/index.ts';
import { inStore, itemsOf, layItem, loadOf, stockOf, takeFrom, wantOf } from '../goods/index.ts';
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

const JOB = 'chandle';
type Recipe = EngineContent['lamp']['chandler']['recipes'][number];

/** What `p` would make: the recipe, its first input's stack, the hearth and why. */
interface Pick {
  recipe: Recipe;
  stack: EntityRow;
  piece: EntityRow;
  why: string;
}

const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.lamp.chandler.job)?.skill ?? '';

const nameOf = (content: EngineContent, id: string): string =>
  content.items.find((i) => i.id === id)?.name ?? id;

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
}

const total = (world: WorldState, kinds: readonly string[], keep: (i: EntityRow) => boolean) =>
  itemsOf(world)
    .filter((i) => kinds.includes(i['kind'] as string) && keep(i))
    .reduce((n, i) => n + (i['count'] as number), 0);

/** Stacks of `kind` in the store that `p` can get to (not carried). */
function stacksOf(ctx: SystemContext, p: EntityRow, kind: string): EntityRow[] {
  const { world, content } = ctx;
  const from = spotOf(p);
  return itemsOf(world).filter((i) => {
    if (i['kind'] !== kind || i['holder']) return false;
    const at = spotOf(i);
    return inStore(world, at.x, at.y, at.z) && canReach(content, world.map, from, at);
  });
}

/** What the store holds of `kind` for `p`, and ash in the hearths' pits. */
const heldFor = (ctx: SystemContext, p: EntityRow, kind: string): number =>
  stacksOf(ctx, p, kind).reduce((s, i) => s + (i['count'] as number), 0) +
  (kind === ctx.content.lamp.ash.item ? ashIn(ctx.world, ctx.content) : 0);

const inputsLeft = (ctx: SystemContext, p: EntityRow, r: Recipe): boolean =>
  Object.entries(r.from).every(([kind, n]) => heldFor(ctx, p, kind) >= n);

/** The recipe wanted now, and why, for `p`: others' batches under way count as made. */
function wanted(ctx: SystemContext, p: EntityRow): { recipe: Recipe; why: string } | undefined {
  const { world, content } = ctx;
  const def = content.lamp.chandler;
  const soap = def.soap.item;
  const candles = content.lamp.candles.map((c) => c.item);
  const others = people(world).filter((q) => q.id !== p.id && q['job'] === JOB);
  const coming = (item: string) =>
    others.reduce((n, q) => n + (def.recipes.find((r) => r.id === q['make'])?.makes[item] ?? 0), 0);
  const soapHave =
    total(
      world,
      [soap],
      (i) => !!i['holder'] || inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
    ) + coming(soap);
  const candlesHave =
    total(world, candles, () => true) + candles.reduce((n, c) => n + coming(c), 0);
  const candlesWant = wantOf(world, content, 'candles');
  for (const recipe of def.recipes) {
    if (!inputsLeft(ctx, p, recipe)) continue;
    if (recipe.makes[soap]) {
      if (soapHave < def.soap.keep)
        return {
          recipe,
          why: soapHave
            ? `soap is short: ${soapHave} of ${def.soap.keep}`
            : 'the healer has no soap',
        };
    } else if (candles.some((c) => recipe.makes[c]) && candlesHave < candlesWant)
      return { recipe, why: `candles are short: ${candlesHave} of ${candlesWant}` };
  }
  return undefined;
}

/** The nearest lit hearth `p` can stand beside, one in a room before one in the open, with fuel
 * for a batch and the walk (`minutes × 2`), so it is still burning when they get there. */
function hearthFor(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const enough = content.lamp.chandler.minutes * 2;
  const from = spotOf(p);
  const d = (r: EntityRow) =>
    Math.abs((r['x'] as number) - from.x) + Math.abs((r['y'] as number) - from.y);
  const lit = firesOf(world)
    .filter((f) => f['lit'] && (f['fuel'] as number) >= enough)
    .map((f) => pieceOfFire(world, f))
    .filter((r) => r['z'] === 0)
    .sort(
      (a, b) =>
        +placeOf(world, content, b).indoors - +placeOf(world, content, a).indoors ||
        d(a) - d(b) ||
        a.id - b.id,
    );
  const reach = reachFrom(content, world.map, from);
  return lit.find((r) =>
    besideReachable(
      world,
      content,
      reach,
      (r['y'] as number) * world.map.width + (r['x'] as number),
    ),
  );
}

function pick(ctx: SystemContext, p: EntityRow): Pick | undefined {
  const want = wanted(ctx, p);
  if (!want) return undefined;
  const piece = hearthFor(ctx, p);
  if (!piece) return undefined;
  const [kind, need] = Object.entries(want.recipe.from)[0]!;
  const taken = busy(ctx.world, p, JOB);
  const from = spotOf(p);
  const stack = stacksOf(ctx, p, kind)
    .filter((i) => (i['count'] as number) >= need && !taken.has(i.id))
    .sort(
      (a, b) =>
        Math.abs(spotOf(a).x - from.x) +
          Math.abs(spotOf(a).y - from.y) -
          (Math.abs(spotOf(b).x - from.x) + Math.abs(spotOf(b).y - from.y)) || a.id - b.id,
    )[0];
  return stack && { recipe: want.recipe, stack, piece, why: want.why };
}

/** Takes up candlemaking if the colony wants candles or soap and nobody free who puts it higher could. */
export function takeUpChandling(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.lamp.chandler;
  if (!able(content, p, def.job) || outranked(ctx, p, def.job, (q) => !!pick(ctx, q))) return false;
  const got = pick(ctx, p);
  if (!got) return false;
  const fire = fireOf(world, got.piece.id);
  const plate = got.recipe.makes[def.soap.item] ? undefined : stockOf(world, 'candles');
  p['took'] = ctx.emit('lamp.tookUp', {
    causes: [
      fire?.['line'] as number,
      plate?.['line'] as number | undefined,
      priorityLine(world, p.id, def.job),
    ].filter((l): l is number => !!l),
    actors: [p.id],
    data: { name: p['name'] as string, why: got.why },
  });
  const level = skillOf(world, p, skillName(content));
  Object.assign(p, {
    job: JOB,
    plan: got.piece.id,
    target: got.stack.id,
    make: got.recipe.id,
    work: Math.ceil((def.minutes * 2 * def.skilled) / (def.skilled + level)),
  });
  return chandling(ctx, p);
}

/** At the stack: take the first input (the rest is drawn from the store when the batch is made). */
function gather(ctx: SystemContext, p: EntityRow, recipe: Recipe): boolean {
  const { world } = ctx;
  const [kind, need] = Object.entries(recipe.from)[0]!;
  let stack = itemsOf(world).find((i) => i.id === p['target'] && !i['holder']);
  if (!stack || stack['kind'] !== kind || (stack['count'] as number) < need) return stop(p);
  if (!same(spotOf(stack), spotOf(p))) return walkTo(ctx, p, spotOf(stack)) || stop(p);
  if (stack['count'] === need) stack['holder'] = p.id;
  else {
    const made = stack['made'] as number;
    takeFrom(world, stack, need);
    const id = layItem(world, { kind, count: need, ...spotOf(p), made });
    stack = itemsOf(world).find((i) => i.id === id)!;
    stack['holder'] = p.id;
  }
  p['target'] = -1;
  return true;
}

/** One minute of candlemaking: false when it is done, or the fire has gone out (what they carry
 * then goes back to the store). */
export function chandling(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.lamp.chandler;
  const recipe = def.recipes.find((r) => r.id === p['make']);
  const piece = furnitureOf(world).find((f) => f.id === p['plan']);
  if (!recipe || !piece || !fireOf(world, piece.id)?.['lit']) return stop(p);
  const load = loadOf(world, p.id);
  if (!load) return gather(ctx, p, recipe);
  const entries = Object.entries(recipe.from);
  if (load['kind'] !== entries[0]![0]) return stop(p);
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stop(p);
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  // The other inputs come now, ash from the hearths' pits (this one first) and the rest from the
  // store; if they have gone, the batch is not made.
  const rest = entries.slice(1);
  if (rest.some(([kind, n]) => heldFor(ctx, p, kind) < n)) return stop(p);
  for (const [kind, n] of rest) {
    if (kind === content.lamp.ash.item && takeAsh(world, content, n, piece.id)) continue;
    let left = n;
    for (const i of stacksOf(ctx, p, kind)) left -= takeFrom(world, i, left);
  }
  const [made, count] = Object.entries(recipe.makes)[0]!;
  const line = ctx.emit('lamp.dipped', {
    causes: [p['took'] as number],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      count,
      what: nameOf(content, made),
      from: entries.map(([k, n]) => `${n} ${nameOf(content, k)}`).join(' and '),
      where: placeOf(world, content, piece).where,
    },
  });
  for (const [kind, n] of Object.entries(recipe.makes)) layAround(ctx, kind, n, here, line);
  takeFrom(world, load, load['count'] as number);
  return stop(p);
}

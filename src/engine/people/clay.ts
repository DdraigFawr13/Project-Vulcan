// Digging clay for a wall plan that waits for it (P4.1, V-096): from the nearest known clay tile on
// level 1 that someone can get beside.
import { planPart, plansOf } from '../build/index.ts';
import type { EntityRow } from '../core/index.ts';
import { haveOf } from '../goods/index.ts';
import { pack, reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { takenBy, WORDS, type Task } from './minetask.ts';
import { besideReachable, people, spotOf } from './spots.ts';

/** The wall plan waiting longest for clay the colony has no clay for, if any, and the clay it
 * still needs; the plan's part name. */
function clayNeed(ctx: SystemContext, p: EntityRow) {
  const { world, content } = ctx;
  const dug = new Set(
    content.terrain.kinds.filter((k) => k.digs && !k.stone).map((k) => k.digs!.item),
  );
  let first: EntityRow | undefined;
  let need = 0;
  for (const plan of plansOf(world)) {
    if (plan['state'] !== 'plan') continue;
    const part = planPart(content, plan);
    const left =
      (dug.has(part.material) ? part.cost - (plan['have'] as number) : 0) +
      (part.also && dug.has(part.also.material) ? part.also.cost - (plan['also'] as number) : 0);
    if (left > 0) [first, need] = [first ?? plan, need + left];
  }
  if (!first) return undefined;
  const good = 'clay';
  const coming = people(world).filter(
    (q) => q.id !== p.id && q['job'] === 'mine' && q['task'] === 'clay',
  ).length;
  const per = content.terrain.kinds.find((k) => k.digs?.item === good)?.digs?.count ?? 0;
  const have = haveOf(world, content, good) + coming * per;
  return have < need ? { plan: first, good, have, need } : undefined;
}

/** Digging clay for a wall plan, from the nearest known clay tile on level 1 that can be reached. */
export function clayWork(ctx: SystemContext, p: EntityRow): Task | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const need = clayNeed(ctx, p);
  const layer = map.levels[0];
  if (!need || !layer) return undefined;
  const taken = takenBy(ctx, p);
  const here = spotOf(p);
  const reach = reachFrom(content, map, here);
  let best: number | undefined;
  let score = Infinity;
  for (let i = 0; i < layer.tiles.length; i += 1) {
    if (!layer.known[i] || content.terrain.kinds[layer.tiles[i]!]!.digs?.item !== need.good)
      continue;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const node = pack(map, { x, y, z: 1 });
    const d = Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) * 1000000 + i;
    if (d < score && !taken.has(node) && besideReachable(world, content, reach, i, 1))
      [best, score] = [node, d];
  }
  if (best === undefined) return undefined;
  return {
    kind: 'clay',
    what: planPart(content, need.plan).name,
    plan: need.plan.id,
    target: best,
    minutes: content.work.mine.dig,
    causes: [need.plan['line'] as number].filter(Boolean),
    word: WORDS.clay,
    good: need.good,
    have: need.have,
    want: need.need,
  };
}

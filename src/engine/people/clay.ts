// Digging clay for a wall plan that waits for it (P4.1, V-096): from the nearest known clay tile on
// level 1 that someone can get beside (build `digsFor`, the rule a house counts clay by).
import { digsFor, planPart, plansOf } from '../build/index.ts';
import type { EntityRow } from '../core/index.ts';
import { haveOf } from '../goods/index.ts';
import { pack, reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { takenBy, type Task } from './minetask.ts';
import { people, spotOf } from './spots.ts';

/** The wall plan waiting longest for a good the ground gives (a part's material that a terrain
 * kind digs, not stone: clay in the content) that the colony has none of, if any, with that good
 * and what it still needs of it across the plans. */
function clayNeed(ctx: SystemContext, p: EntityRow) {
  const { world, content } = ctx;
  const dug = new Set(
    content.terrain.kinds.filter((k) => k.digs && !k.stone).map((k) => k.digs!.item),
  );
  let first: EntityRow | undefined;
  let good = '';
  let need = 0;
  for (const plan of plansOf(world)) {
    if (plan['state'] !== 'plan') continue;
    const part = planPart(content, plan);
    const wants = [
      { good: part.material, left: part.cost - (plan['have'] as number) },
      ...(part.also
        ? [{ good: part.also.material, left: part.also.cost - (plan['also'] as number) }]
        : []),
    ].filter((w) => dug.has(w.good) && w.left > 0);
    if (!first && wants[0]) [first, good] = [plan, wants[0].good];
    need += wants.filter((w) => w.good === good).reduce((n, w) => n + w.left, 0);
  }
  if (!first) return undefined;
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
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const node = pack(map, { x, y, z: 1 });
    const d = Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) * 1000000 + i;
    if (d < score && !taken.has(node) && digsFor(world, content, reach, i, need.good))
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
    word: content.work.mine.words.clay,
    good: need.good,
    have: need.have,
    want: need.need,
  };
}

// Digging clay for a wall plan that waits for it (P4.1, V-096): from the nearest known clay tile on
// level 1 that someone can get beside (build `digsFor`, the rule a house counts clay by).
import { digsFor, kilnOf, planPart, plansOf } from '../build/index.ts';
import type { EntityRow } from '../core/index.ts';
import { haveOf } from '../goods/index.ts';
import { bankTiles } from '../map/index.ts';
import { pack, reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { takenBy, type Task } from './minetask.ts';
import { clayWanted } from '../crafts/index.ts';
import { people, spotOf } from '../band/index.ts';

/** The wall plan waiting longest for a good the ground gives (a part's material that a terrain
 * kind digs, not stone: clay in the content) that the colony has none of, if any, with that good
 * and what it still needs of it across the plans; else the kiln, when its pots and bricks want
 * more clay than the stores hold. */
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
  const kiln = kilnOf(world);
  const wanted = kiln && !first ? clayWanted(ctx) : 0;
  if (!first && !wanted) return undefined;
  const coming = people(world).filter(
    (q) => q.id !== p.id && q['job'] === 'mine' && q['task'] === 'clay',
  ).length;
  const clay = first ? good : content.work.potter.clayItem;
  const per = content.terrain.kinds.find((k) => k.digs?.item === clay)?.digs?.count ?? 0;
  const have = haveOf(world, content, clay) + coming * per;
  // A wall plan waiting for clay comes first; else the kiln's pots and bricks want it.
  if (first)
    return have < need
      ? { plan: first, good, have, need, what: planPart(content, first).name }
      : undefined;
  return have < wanted ? { plan: kiln!, good: clay, have, need: wanted, what: 'kiln' } : undefined;
}

/** Digging clay for a wall plan, from the nearest known clay tile on level 1, or of a found clay
 * bank on the surface, that can be reached. */
export function clayWork(ctx: SystemContext, p: EntityRow): Task | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const need = clayNeed(ctx, p);
  const layer = map.levels[0];
  if (!need || (!layer && !bankTiles(content, map).length)) return undefined;
  const taken = takenBy(ctx, p);
  const here = spotOf(p);
  const reach = reachFrom(content, map, here);
  let best: number | undefined;
  let score = Infinity;
  for (let i = 0; i < (layer?.tiles.length ?? 0); i += 1) {
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const node = pack(map, { x, y, z: 1 });
    const d = Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) * 1000000 + i;
    if (d < score && !taken.has(node) && digsFor(world, content, reach, i, need.good))
      [best, score] = [node, d];
  }
  // A found clay bank on the surface (V-206), dug as the ground below is.
  for (const i of bankTiles(content, map)) {
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const node = pack(map, { x, y, z: 0 });
    const d = Math.max(Math.abs(x - here.x), Math.abs(y - here.y)) * 1000000 + i;
    if (d < score && !taken.has(node) && digsFor(world, content, reach, i, need.good, 0))
      [best, score] = [node, d];
  }
  if (best === undefined) return undefined;
  return {
    kind: 'clay',
    what: need.what,
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

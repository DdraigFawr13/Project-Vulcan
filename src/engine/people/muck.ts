// Carrying muck (Phase 5B Bundle 2, V-130): a farmer with no sowing or reaping takes up carrying
// muck to a fallow field once the fold and the midden have given loads (build soillife.ts). They
// fetch a load standing beside the nearest fold gate or midden, carry it to the field's poorest
// tile and spread it (`work.farm.muck` minutes, shorter with skill), then fetch another. One line
// when taken up (people/farm.ts), none a trip. The person's `task` is `muck`, `target` -1 while
// fetching and the tile while carrying.
import type { EntityRow } from '../core/index.ts';
import {
  fieldsOf,
  livePastures,
  middensOf,
  muckLeft,
  mucky,
  poorestTile,
  spreadMuck,
  takeLoad,
} from '../build/index.ts';
import { reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { scaled, worked } from './tools.ts';
import { besideReachable, goBeside, skillOf, spotOf } from './spots.ts';

const near = (p: EntityRow, x: number, y: number): boolean =>
  (p['z'] as number) === 0 &&
  Math.abs((p['x'] as number) - x) + Math.abs((p['y'] as number) - y) === 1;

/** The tiles a load is fetched beside: the midden and each built fold's gate, nearest first. */
function sources(ctx: SystemContext, p: EntityRow): { x: number; y: number }[] {
  const { world } = ctx;
  const w = world.map.width;
  const gates = livePastures(world)
    .filter((q) => q['state'] === 'built')
    .map((q) => ({
      x: (q['foldGate'] as number) % w,
      y: Math.floor((q['foldGate'] as number) / w),
    }));
  const far = (s: { x: number; y: number }) =>
    Math.abs(s.x - (p['x'] as number)) + Math.abs(s.y - (p['y'] as number));
  return [...middensOf(world), ...gates].sort((a, b) => far(a) - far(b));
}

/** Whether `p` could take up carrying muck to field `f`: loads left, ground to spread them on,
 * and a way to its poorest tile. */
export function canMuck(ctx: SystemContext, p: EntityRow, f: EntityRow): boolean {
  const { world, content } = ctx;
  if (muckLeft(world) <= 0 || !mucky(world, f) || !sources(ctx, p).length) return false;
  return besideReachable(
    world,
    content,
    reachFrom(content, world.map, spotOf(p)),
    poorestTile(world, f),
  );
}

/** One minute of carrying muck on field `f`; false when it is done (no loads, no ground, no
 * way): the caller stops the person. */
export function mucking(ctx: SystemContext, p: EntityRow, f: EntityRow): boolean {
  const { world, content } = ctx;
  const width = world.map.width;
  const tile = p['target'] as number;
  if (tile < 0) {
    if (muckLeft(world) <= 0 || !mucky(world, f)) return false;
    const from = sources(ctx, p)[0];
    if (!from) return false;
    if (!near(p, from.x, from.y)) return goBeside(ctx, p, from.x, from.y);
    if (!takeLoad(world)) return false;
    const level = skillOf(
      world,
      p,
      content.jobs.find((j) => j.id === content.work.farm.job)?.skill ?? '',
    );
    const minutes = Math.max(
      1,
      Math.ceil(
        (content.work.farm.muck * 2 * content.work.farm.skilled) /
          (content.work.farm.skilled + level),
      ),
    );
    p['target'] = poorestTile(world, f);
    p['work'] = scaled(ctx, p, 'farm', minutes);
    return true;
  }
  const [x, y] = [tile % width, Math.floor(tile / width)];
  if (!near(p, x, y)) return goBeside(ctx, p, x, y);
  p['work'] = (p['work'] as number) - 1;
  worked(ctx, p, 'farm');
  practise(
    ctx,
    p,
    content.jobs.find((j) => j.id === content.work.farm.job)?.skill ?? '',
    p['took'] as number,
  );
  if ((p['work'] as number) > 0) return true;
  spreadMuck(ctx, tile);
  p['target'] = -1;
  return true;
}

export const fieldOf = (ctx: SystemContext, p: EntityRow): EntityRow | undefined =>
  fieldsOf(ctx.world).find((r) => r.id === p['plan']);

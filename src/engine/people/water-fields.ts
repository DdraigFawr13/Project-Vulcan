// Watering the fields in a dry spell (Phase 5B Bundle 2, V-130): a farmer with no reaping or
// sowing takes up watering a sown field whose far tiles are parched (build blight.ts `thirsty`).
// They fetch water standing beside the nearest drinkable, unfrozen tile, then carry it to the
// thirsty tiles nearest them, `dry.tiles` a trip, `dry.minutes` a tile (shorter with skill); a
// watered tile loses nothing that day. One line when taken up (people/farm.ts), none a trip.
// The person's `task` is `water`; `pail` is the tiles' worth of water carried (0 while fetching),
// `target` the water tile while fetching and the tile to water while carrying.
import type { EntityRow } from '../core/index.ts';
import { thirsty } from '../build/index.ts';
import { reachFrom } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isFrozen } from '../weather/index.ts';
import { practise } from './learn.ts';
import { scaled, worked } from './tools.ts';
import { besideReachable, busy, goBeside, skillOf, spotOf } from './spots.ts';

const near = (p: EntityRow, x: number, y: number): boolean =>
  (p['z'] as number) === 0 &&
  Math.abs((p['x'] as number) - x) + Math.abs((p['y'] as number) - y) === 1;

/** The places water is drawn from: unfrozen drinkable surface tiles. This is the one place a
 * well will be added to (the water slice). */
export function isWaterSpot(ctx: SystemContext, tile: number): boolean {
  const { world, content } = ctx;
  return !!content.terrain.kinds[world.map.tiles[tile]!]!.drinkable && !isFrozen(world.map, tile);
}

/** The water tile nearest (x, y) (rings outwards, tile order within a ring) that someone who can
 * reach what `reach` says can stand beside; undefined when none. */
export function nearestWater(
  ctx: SystemContext,
  at: { x: number; y: number },
  reach: (to: { x: number; y: number; z: number }) => boolean,
): number | undefined {
  const { world, content } = ctx;
  const { width, height } = world.map;
  for (let r = 0; r <= Math.max(width, height); r += 1)
    for (let y = Math.max(0, at.y - r); y <= Math.min(height - 1, at.y + r); y += 1)
      for (let x = Math.max(0, at.x - r); x <= Math.min(width - 1, at.x + r); x += 1) {
        if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) !== r) continue;
        const i = y * width + x;
        if (isWaterSpot(ctx, i) && besideReachable(world, content, reach, i)) return i;
      }
  return undefined;
}

/** The thirsty tile of `f` nearest `p` that no other farmer is bound for and `p` can get beside. */
function nextThirsty(ctx: SystemContext, p: EntityRow, f: EntityRow): number | undefined {
  const { world, content } = ctx;
  const width = world.map.width;
  const taken = busy(world, p, 'farm');
  const here = spotOf(p);
  const far = (i: number) =>
    Math.abs((i % width) - here.x) + Math.abs(Math.floor(i / width) - here.y);
  const reach = reachFrom(content, world.map, here);
  return thirsty(world, content, f)
    .filter((i) => !taken.has(i) && besideReachable(world, content, reach, i))
    .sort((a, b) => far(a) - far(b) || a - b)[0];
}

/** Whether `p` could take up watering field `f`: parched tiles, water, and a way to both. */
export function canWater(ctx: SystemContext, p: EntityRow, f: EntityRow): boolean {
  const { world, content } = ctx;
  if (nextThirsty(ctx, p, f) === undefined) return false;
  return nearestWater(ctx, spotOf(p), reachFrom(content, world.map, spotOf(p))) !== undefined;
}

/** One minute of watering field `f`; false when it is done (nothing parched, no water, no way):
 * the caller stops the person. */
export function watering(ctx: SystemContext, p: EntityRow, f: EntityRow): boolean {
  const { world, content } = ctx;
  const { width } = world.map;
  const dry = content.buildings.field.dry;
  const pail = p['pail'] as number;
  let tile = p['target'] as number;
  if (pail <= 0) {
    // Fetching: the water tile is chosen once, and dropped if it freezes.
    if (tile < 0 || !isWaterSpot(ctx, tile)) {
      const from = nearestWater(ctx, spotOf(p), reachFrom(content, world.map, spotOf(p)));
      if (from === undefined) return false;
      p['target'] = tile = from;
    }
    const [x, y] = [tile % width, Math.floor(tile / width)];
    if (!near(p, x, y)) return goBeside(ctx, p, x, y);
    if (nextThirsty(ctx, p, f) === undefined) return false;
    Object.assign(p, { pail: dry.tiles, target: -1 });
    return true;
  }
  if (tile < 0 || !thirsty(world, content, f).includes(tile)) {
    const next = nextThirsty(ctx, p, f);
    if (next === undefined) return false;
    const skill = content.jobs.find((j) => j.id === content.work.farm.job)?.skill ?? '';
    const level = skillOf(world, p, skill);
    const minutes = Math.max(
      1,
      Math.ceil(
        (dry.minutes * 2 * content.work.farm.skilled) / (content.work.farm.skilled + level),
      ),
    );
    p['target'] = tile = next;
    p['work'] = scaled(ctx, p, 'farm', minutes);
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
  (f['watered'] as number[]).push(tile);
  Object.assign(p, { target: -1, pail: pail - 1 });
  return true;
}

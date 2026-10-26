// Shared footing for the work in jobs.ts and forage.ts: where someone stands, who is on what,
// walking to stand beside a tile, and laying a yield out on the open ground around it.
import type { EntityRow, WorldState } from '../core/index.ts';
import { planAt, stationAt } from '../build/index.ts';
import { depotAt, depotTakes, itemsAt, layItem, stackSize } from '../goods/index.ts';
import { canReach, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { walkTo } from './walk.ts';

import { besideReachable } from '../paths/index.ts';

export { besideReachable };

/** A tree is worked from a side, never a corner, so its tile (and the logs on it) can be reached
 * from where they stood: a corner step past two blocked sides is not allowed (paths). */
export const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export const spotOf = (r: EntityRow): Spot => ({
  x: r['x'] as number,
  y: r['y'] as number,
  z: r['z'] as number,
});
export const same = (a: Spot, b: Spot): boolean => a.x === b.x && a.y === b.y && a.z === b.z;
export const people = (world: WorldState): EntityRow[] => world.entities['person'] ?? [];
/** The targets others are already on in a job, so no two take the same tree or load. */
export const busy = (world: WorldState, p: EntityRow, job: string): Set<number> =>
  new Set(
    people(world)
      .filter((q) => q.id !== p.id && q['job'] === job)
      .map((q) => q['target'] as number),
  );

export const skillOf = (world: WorldState, p: EntityRow, skill: string): number =>
  ((world.entities['skill'] ?? []).find((s) => s['person'] === p.id && s['skill'] === skill)?.[
    'level'
  ] as number) ?? 0;

/** Sets off to stand beside tile (x, y) of level `z` (the surface unless told); false when no
 * side of it can be reached. */
export function goBeside(ctx: SystemContext, p: EntityRow, x: number, y: number, z = 0): boolean {
  const map = ctx.world.map;
  const here = spotOf(p);
  const sides = SIDES.map(([dx, dy]) => ({ x: x + dx, y: y + dy, z }))
    .filter((s) => s.x >= 0 && s.y >= 0)
    .filter((s) => s.x < map.width && s.y < map.height)
    .filter((s) => walkAt(ctx.content, map, z, s.y * map.width + s.x) > 0)
    .sort(
      (a, b) =>
        Math.abs(a.x - here.x) +
        Math.abs(a.y - here.y) -
        Math.abs(b.x - here.x) -
        Math.abs(b.y - here.y),
    );
  for (const s of sides) {
    if (same(s, here)) return true;
    if (canReach(ctx.content, map, here, s) && walkTo(ctx, p, s)) return true;
  }
  return false;
}

/** Lays `count` of a kind in stacks on the tile and the free open tiles around it, on the tile's
 * level; returns how many it laid (fewer when every tile within 4 is taken). Nothing goes on a
 * surface tile planned to be built. */
export function layAround(
  ctx: SystemContext,
  kind: string,
  count: number,
  at: Spot,
  made: number,
  trail = '',
  quality = 'plain',
): number {
  const { world, content } = ctx;
  const map = world.map;
  const size = stackSize(content, kind);
  let left = count;
  for (let r = 0; left > 0 && r <= 4; r += 1)
    for (let dy = -r; dy <= r && left > 0; dy += 1)
      for (let dx = -r; dx <= r && left > 0; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const [x, y] = [at.x + dx, at.y + dy];
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (!walkAt(content, map, at.z, y * map.width + x) || itemsAt(world, x, y, at.z).length)
          continue;
        if (at.z === 0 && (planAt(world, x, y)?.['state'] === 'plan' || stationAt(world, x, y)))
          continue;
        // Not into a store of another kind (5B Bundle 1).
        const store = depotAt(world, x, y, at.z);
        if (store && !depotTakes(content, store, kind)) continue;
        if (!canReach(content, map, at, { x, y, z: at.z })) continue;
        const n = Math.min(size, left);
        layItem(world, { kind, count: n, x, y, z: at.z, made }, { trail, quality });
        left -= n;
      }
  return count - left;
}

/** Lays everything: what `layAround` finds no free tile for goes down on `at` itself, so nothing
 * made vanishes. */
export function layAll(
  ctx: SystemContext,
  kind: string,
  count: number,
  at: Spot,
  made: number,
  trail = '',
): void {
  let left = count - layAround(ctx, kind, count, at, made, trail);
  const size = stackSize(ctx.content, kind);
  while (left > 0) {
    const n = Math.min(size, left);
    layItem(ctx.world, { kind, count: n, ...at, made }, { trail });
    left -= n;
  }
}

/** Whether `p` can reach a side of surface tile (x, y): work there is worth taking up. */
export const canStandBeside = (ctx: SystemContext, p: EntityRow, x: number, y: number): boolean =>
  besideReachable(
    ctx.world,
    ctx.content,
    (to) => canReach(ctx.content, ctx.world.map, spotOf(p), to),
    y * ctx.world.map.width + x,
  );

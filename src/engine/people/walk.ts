// Walking (P2.3): each minute a person on a way gains stride and takes the next step once the
// stride covers its cost, so shallow water and marsh slow them. A way blocked since it was found
// (a tree that fell across it, ice that thawed) is found again from where they stand. Someone
// with nothing to do strolls to a tile near the camp and stands a while; P2.2 and P2.4 give them
// reasons to go somewhere instead. Steps are state, never ledger lines (V-036).
import type { EntityRow } from '../core/index.ts';
import { findPath, pack, stepCost, unpack, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** The fields each person row carries for walking. */
export const WALK_FIELDS = {
  /** The nodes still to step onto, in order; the last is where they are going. */
  path: 'ints',
  /** Stride gathered towards the next step, in tenths of a straight step. */
  stride: 'int',
  /** Minutes left standing before an idle person strolls again. */
  rest: 'int',
} as const;

const spotOf = (p: EntityRow): Spot => ({
  x: p['x'] as number,
  y: p['y'] as number,
  z: p['z'] as number,
});

/** Sets a person off towards `to`; false (and standing still) when there is no way there now. */
export function walkTo(ctx: SystemContext, p: EntityRow, to: Spot): boolean {
  const path = findPath(ctx.content, ctx.world.map, spotOf(p), to);
  p['path'] = path ?? [];
  p['stride'] = 0;
  return path !== undefined;
}

/** One minute of walking for one person: steps taken while the stride covers them. */
export function stepAlong(ctx: SystemContext, p: EntityRow): void {
  const map = ctx.world.map;
  let path = p['path'] as number[];
  if (!path.length) return;
  let stride = (p['stride'] as number) + ctx.content.terrain.walking.speed;
  while (path.length) {
    const here = pack(map, spotOf(p));
    let cost = stepCost(ctx.content, map, here, path[0]!);
    if (!cost) {
      // The way is blocked now: find it again to the same end, or stop where they are.
      if (!walkTo(ctx, p, unpack(map, path.at(-1)!))) return;
      path = p['path'] as number[];
      if (!path.length) return;
      cost = stepCost(ctx.content, map, here, path[0]!);
    }
    if (stride < cost) break;
    stride -= cost;
    const next = unpack(map, path.shift()!);
    p['x'] = next.x;
    p['y'] = next.y;
    p['z'] = next.z;
  }
  p['stride'] = path.length ? stride : 0;
}

/** An idle person: stand out the rest, then stroll to an open tile near the camp. */
export function wander(ctx: SystemContext, p: EntityRow): void {
  if ((p['path'] as number[]).length) return;
  const rest = p['rest'] as number;
  if (rest > 0) {
    p['rest'] = rest - 1;
    return;
  }
  const map = ctx.world.map;
  const dials = ctx.content.band.wander;
  const rng = ctx.rng();
  const x = map.startX + rng.between(-dials.radius, dials.radius);
  const y = map.startY + rng.between(-dials.radius, dials.radius);
  p['rest'] = rng.between(dials.rest[0]!, dials.rest[1]!);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  if (!walkAt(ctx.content, map, 0, y * map.width + x)) return;
  walkTo(ctx, p, { x, y, z: 0 });
}

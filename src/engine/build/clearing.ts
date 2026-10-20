// Goods lying where a house or room goes (V-078 review): loose goods do not block a site, any
// more than a tree does. Haulers carry them off first (people/haul.ts: to the store if it has
// room, else set down beside the footprint), and the part waits until its tile is clear
// (people/build.ts). The plan says so once, citing its line.
import type { EntityRow, WorldState } from '../core/index.ts';
import { itemsOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { plansOf } from './plans.ts';

/** The surface tiles of house and room plans still to build, as `y * width + x`. */
export function planTiles(world: WorldState): Set<number> {
  const width = world.map.width;
  return new Set(
    plansOf(world)
      .filter((p) => p['house'] && p['state'] === 'plan' && p['z'] === 0)
      .map((p) => (p['y'] as number) * width + (p['x'] as number)),
  );
}

/** Whether goods lie on the surface tile, not carried. */
export const goodsOn = (world: WorldState, x: number, y: number): boolean =>
  itemsOf(world).some((i) => i['x'] === x && i['y'] === y && i['z'] === 0 && !i['holder']);

/** Whether a house or room plan row waits on goods lying on its tile. */
export const blockedByGoods = (world: WorldState, plan: EntityRow): boolean =>
  !!plan['house'] && goodsOn(world, plan['x'] as number, plan['y'] as number);

/** One line when a new plan over `parts` has goods lying on them; `where` is
 * the words for the place ("the cottage's new room"). */
export function sayGoodsAside(
  ctx: SystemContext,
  parts: readonly { x: number; y: number }[],
  line: number,
  where: string,
): void {
  const { world } = ctx;
  const width = world.map.width;
  const on = new Set(parts.map((q) => q.y * width + q.x));
  const lying = itemsOf(world).some(
    (i) => i['z'] === 0 && !i['holder'] && on.has((i['y'] as number) * width + (i['x'] as number)),
  );
  if (lying) ctx.emit('build.goodsAside', { causes: [line], data: { where } });
}

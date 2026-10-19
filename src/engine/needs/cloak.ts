// The wool cloak (V-092): each settler arrives wearing one (goods). Outdoors, on the surface and
// not inside a built house, it adds `life.cloak.warmth` degrees to the temperature they feel, and
// for each hour outdoors in a felt temperature under the comfort line it wears `life.cloak.wear`
// from the item's `wear`; at 0 it is gone, with a line citing the cloak's arrival.
import type { EntityRow, WorldState } from '../core/index.ts';
import { houseAt } from '../build/index.ts';
import { removeEntity } from '../entity/index.ts';
import { cloakOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** On the surface and not in a built house. */
export const outdoors = (world: WorldState, p: EntityRow): boolean =>
  p['z'] === 0 &&
  !((houseAt(world, p['x'] as number, p['y'] as number)?.['built'] as number | undefined) ?? 0);

/** Degrees the cloak they wear adds where they stand. */
export const cloakWarmth = (world: WorldState, content: SystemContext['content'], p: EntityRow) =>
  outdoors(world, p) && cloakOf(world, p.id) ? content.life.cloak.warmth : 0;

/** One hour outdoors in `felt` degrees (without the cloak): the cloak wears, and may wear through. */
export function wearCloak(ctx: SystemContext, p: EntityRow, felt: number): void {
  const { world, content } = ctx;
  const cloak = cloakOf(world, p.id);
  if (!cloak || !outdoors(world, p) || felt >= content.life.warmth.comfort) return;
  cloak['wear'] = Math.max(0, (cloak['wear'] as number) - content.life.cloak.wear);
  if (cloak['wear']) return;
  removeEntity(world, 'item', cloak.id);
  ctx.emit('goods.cloakWornOut', {
    causes: [cloak['made'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string },
  });
}

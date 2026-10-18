// Eating from the band's food (P2.6): a meal takes from a stack, and whoever eats the last food
// lying anywhere writes a line saying so, which a hunger line later cites as its cause.
import type { EntityRow, WorldState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { itemsOf, takeFrom } from './stacks.ts';

/** Takes one from food stack `item` for `eater`; the last food in the valley writes a line. */
export function eatFrom(ctx: SystemContext, item: EntityRow, eater: EntityRow): void {
  const { world, content } = ctx;
  takeFrom(world, item, 1);
  if (itemsOf(world).some((i) => content.life.eat[i['kind'] as string] !== undefined)) return;
  const state = (world.systems['goods'] ??= {});
  state['foodGone'] = ctx.emit('goods.foodGone', {
    actors: [eater.id],
    data: { name: eater['name'] as string },
  });
}

/** The line where the last food was eaten, or 0 if the band has never run out. */
export const foodGoneLine = (world: WorldState): number =>
  world.systems['goods']?.['foodGone'] ?? 0;

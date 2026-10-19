// Eating from the band's food (P2.6): a meal takes from a stack, and whoever eats the last food
// lying anywhere writes a line saying so, which a hunger line later cites as its cause.
import type { EntityRow, WorldState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { itemsOf, takeFrom } from './stacks.ts';

/** Takes one from food stack `item` for `eater`; the last food in the valley writes a line. */
export function eatFrom(ctx: SystemContext, item: EntityRow, eater: EntityRow): void {
  const { world, content } = ctx;
  // The stack's own line (the cart unloaded, or whatever brought it) explains where it went.
  const made = item['made'] as number;
  takeFrom(world, item, 1);
  // Seed grain eaten as a last resort is not the band's food running out (P4.7).
  const food = (kind: string) =>
    content.life.eat[kind] !== undefined && !content.life.lastResort.includes(kind);
  if (!food(item['kind'] as string)) return;
  if (itemsOf(world).some((i) => food(i['kind'] as string))) return;
  const state = (world.systems['goods'] ??= {});
  state['foodGone'] = ctx.emit('goods.foodGone', {
    causes: made ? [made] : [],
    actors: [eater.id],
    data: { name: eater['name'] as string },
  });
}

/** The line where the last food was eaten, or 0 if the band has never run out. */
export const foodGoneLine = (world: WorldState): number =>
  world.systems['goods']?.['foodGone'] ?? 0;

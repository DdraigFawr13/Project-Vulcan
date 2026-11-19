// Eating from the band's food (P2.6): a meal takes from a stack, and whoever eats the last food
// lying anywhere writes a line saying so, which a hunger line later cites as its cause. How long
// the store lasts (P5.9, moved here for the Rations law, P6.5).
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { haveOf } from './store.ts';
import { itemsOf, takeFrom } from './stacks.ts';
import { alive } from '../entity/index.ts';

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

/** Food in the store, and the days it lasts `mouths` at `strangers.draw.eat` a head. */
export function foodDays(world: WorldState, content: EngineContent, mouths: number) {
  const food = haveOf(world, content, 'food');
  return { food, days: Math.floor(food / (content.strangers.draw.eat * Math.max(1, mouths))) };
}

/** Days until the first day of the harvest month (`weigh.harvest`), next coming. */
export function daysToHarvest(world: WorldState, content: EngineContent): number {
  const { calendar } = content;
  const month = calendar.monthNames.indexOf(content.strangers.weigh.harvest);
  const perYear = calendar.daysPerMonth * calendar.monthsPerYear;
  const today = Math.floor(world.tick / TICKS_PER_DAY) % perYear;
  return (month * calendar.daysPerMonth - today + perYear) % perYear || perYear;
}

/** Whether the store lasts everyone, with `coming` more, until the harvest. */
export function storeLasts(world: WorldState, content: EngineContent, coming: number): boolean {
  return (
    foodDays(world, content, alive(world).length + coming).days >= daysToHarvest(world, content)
  );
}

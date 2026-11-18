// The same food, day after day (P6.2, V-146): each meal marks the kind eaten on the person's
// `taste` rows; once they have eaten for `sameFood.days` days and no more than `sameFood.kinds`
// kinds in that time, the meal leaves the `sameFood.memory` memory, citing it.
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addMemory } from './memory.ts';

export const DIET_TABLES: Schemas = {
  /** A kind of food a person has eaten: the game days they first and last ate it. */
  taste: { person: 'entity', food: 'text', first: 'int', last: 'int' },
};

const tastesOf = (world: WorldState, person: number): EntityRow[] =>
  (world.entities['taste'] ?? []).filter((t) => t['person'] === person);

/** `person` ate a `food` (an item kind); `cause` is the meal's line (its batch or the food's). */
export function tasted(ctx: SystemContext, person: number, food: string, cause: number): void {
  const { world, content } = ctx;
  const today = Math.floor(world.tick / TICKS_PER_DAY);
  const rows = tastesOf(world, person);
  const row = rows.find((t) => t['food'] === food);
  if (row) row['last'] = today;
  else addEntity(world, 'taste', { person, food, first: today, last: today });
  const { days, kinds, memory } = content.life.memory.sameFood;
  const all = row ? rows : tastesOf(world, person);
  const since = Math.min(...all.map((t) => t['first'] as number));
  const lately = all.filter((t) => (t['last'] as number) > today - days).length;
  if (today - since >= days && lately <= kinds) addMemory(ctx, person, memory, cause);
}

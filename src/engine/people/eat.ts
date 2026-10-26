// Eating one of a stack (P2.2, P4.7, V-090): the food need rises by the food's worth, a cooked
// meal is remembered, and seed grain eaten as a last resort is one line a person a day. The mind
// eats where food lies (mind.ts); a hurt person abed is fed by whoever brings it (nurse.ts).
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { eatFrom } from '../goods/index.ts';
import { addMemory, changeNeed, crossed, needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { tallyAdd } from './tally.ts';

export const cooked = (ctx: SystemContext, i: EntityRow): boolean =>
  !!ctx.content.items.find((d) => d.id === i['kind'])?.cooked;

/** A hungry band ate seed (P4.7, V-089): one line a person a day, citing their hunger. */
function saySeed(ctx: SystemContext, p: EntityRow, food: EntityRow): void {
  const day = Math.floor(ctx.world.tick / TICKS_PER_DAY) + 1;
  if (p['seeded'] === day) return;
  p['seeded'] = day;
  ctx.emit('goods.ateSeed', {
    causes: [food['line'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string },
  });
}

/** Eats one of the stack they stand on. */
export function eat(ctx: SystemContext, p: EntityRow, item: EntityRow): void {
  const def = ctx.content.life.needs.find((n) => n.id === 'food');
  const row = needOf(ctx.world, p.id, 'food');
  if (!def || !row) return;
  const gives = ctx.content.life.eat[item['kind'] as string] ?? 0;
  const [made, wasCooked] = [item['made'] as number, cooked(ctx, item)];
  // A meal is remembered by its grade (P5.3): plain fare as before, good and fine more.
  const grades = ctx.content.work.cook.grades;
  const memory = (grades.find((g) => g.id === item['quality']) ?? grades[grades.length - 1]!)
    .memory;
  if (ctx.content.life.lastResort.includes(item['kind'] as string)) saySeed(ctx, p, row);
  eatFrom(ctx, item, p);
  // A cooked meal is remembered (V-090), citing the batch's line.
  if (wasCooked) addMemory(ctx, p.id, memory, made);
  tallyAdd(ctx, 'eaten', 1);
  changeNeed(ctx.content, row, gives);
  crossed(ctx, p, row, def);
}

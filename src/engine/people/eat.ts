// Eating one of a stack (P2.2, P4.7, V-090): the food need rises by the food's worth, a cooked
// meal is remembered, and seed grain eaten as a last resort is one line a person a day. The mind
// eats where food lies (mind.ts); a hurt person abed is fed by whoever brings it (nurse.ts).
// Raw food that is turning (P5.7: spoiling at `sick.turning` a day or more where it lies),
// eaten hungry, is an exposure to a griping belly.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { eatFrom } from '../goods/index.ts';
import { expose } from '../health/index.ts';
import { floorsOf, rateOf } from '../keep/index.ts';
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

/** Hungry, eating raw food that is turning: perhaps a griping belly, citing their hunger. */
function turning(ctx: SystemContext, p: EntityRow, item: EntityRow, hunger: EntityRow): void {
  const { world, content } = ctx;
  if ((hunger['value'] as number) >= (content.life.needs.find((n) => n.id === 'food')?.low ?? 0))
    return;
  if (cooked(ctx, item)) return;
  const rate = rateOf(world, content, item, floorsOf(world, content));
  if (rate * 1000 < content.health.sick.turning) return;
  const name = content.items.find((d) => d.id === item['kind'])?.name ?? 'food';
  expose(ctx, p, 'gripes', `ate ${name} that was turning, hungry`, [hunger['line'] as number]);
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
  turning(ctx, p, item, row);
  eatFrom(ctx, item, p);
  // A cooked meal is remembered (V-090), citing the batch's line.
  if (wasCooked) addMemory(ctx, p.id, memory, made);
  tallyAdd(ctx, 'eaten', 1);
  changeNeed(ctx.content, row, gives);
  crossed(ctx, p, row, def);
}

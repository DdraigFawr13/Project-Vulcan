// The winter loss of colonies (6C Slice 5 part 3, V-219): on the first day of `bees.winter.month`
// each skep with bees is lost at 1 in `odds`, fewer when its keeper (who caught the swarm) knows
// the skeps way. The skep goes back to `empty`, to be caught into again; one `bees.lost` line
// names the keeper and cites the skep's latest line.
import { clockAt } from '../core/index.ts';
import { wayEffect } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { skepsOf } from './skeps.ts';

/** The day's winter loss (the bees system's daily run, stream `bees`). */
export function winterLoss(ctx: SystemContext): void {
  const { world, content } = ctx;
  const { month, odds } = content.lamp.bees.winter;
  const c = clockAt(world.tick, content.calendar);
  if (c.day !== 1 || content.calendar.monthNames[c.month] !== month) return;
  for (const skep of skepsOf(world)) {
    if (skep['state'] !== 'bees') continue;
    const keeper = skep['keeper'] as number;
    const eased = 100 - wayEffect(world, content, keeper, 'skeps');
    if (!ctx.rng().chance(eased / (100 * odds))) continue;
    const name = (world.entities['person'] ?? []).find((p) => p.id === keeper)?.['name'];
    skep['state'] = 'empty';
    skep['line'] = ctx.emit('bees.lost', {
      causes: [skep['line'] as number],
      actors: keeper ? [keeper] : [],
      data: { name: (name as string | undefined) ?? 'Someone', field: 'field' },
    });
  }
}

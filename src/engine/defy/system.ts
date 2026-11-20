// The defiance system (P6.7, V-160): each hour brawls break out among those at that step; at
// defy.json `hour` each day everyone alive takes their day on the ladder; old sentences go. The
// people's side (working slowly, pocketing from the store, the stocks, extra work and walking
// out) is people `defy.ts`.
import { clockAt, TICKS_PER_DAY } from '../core/index.ts';
import { removeEntity, alive } from '../entity/index.ts';
import type { System } from '../sim/index.ts';
import { brawls } from './acts.ts';
import { ladderDay } from './ladder.ts';
import { DEFY_TABLES } from './tables.ts';

export const defySystem: System = {
  id: 'defy',
  every: 'hour',
  stream: 'combat',
  emits: [
    'defy.slow',
    'defy.cooled',
    'defy.took',
    'defy.caught',
    'defy.punished',
    'defy.brawled',
    'defy.left',
  ],
  tables: DEFY_TABLES,
  run(ctx) {
    const { world, content } = ctx;
    brawls(ctx);
    if (clockAt(world.tick, content.calendar).hour !== content.defy.hour) return;
    const day = Math.floor(world.tick / TICKS_PER_DAY);
    for (const s of [...(world.entities['sentence'] ?? [])])
      if ((s['day'] as number) < day) removeEntity(world, 'sentence', s.id);
    for (const p of alive(ctx.world)) ladderDay(ctx, p);
  },
};

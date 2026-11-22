// The callings system (6B Bundle 6, P6.13, V-175, V-189 q8 and q9): rare roles with a high bar,
// at most one holder each, held for life. Each hour it tallies the ledger lines bars count and
// looks for masterworks; every `every` days at `hour` it gives each open calling to the best who
// passes. What a calling pushes is read where it bites (engine entity `callings.ts`): defy's
// cooling, tales' beliefs and forgetting, band's apprentice pace and herding's watch fire.
import { clockAt, TICKS_PER_DAY } from '../core/index.ts';
import { linesAfter } from '../log/index.ts';
import type { System } from '../sim/index.ts';
import { masterworks } from './masterwork.ts';
import { CALLING_TABLES } from './tables.ts';
import { callingDay } from './take.ts';
import { tally } from './tally.ts';

export const callingSystem: System = {
  id: 'calling',
  every: 'hour',
  emits: ['calling.taken', 'calling.masterwork'],
  tables: CALLING_TABLES,
  run(ctx) {
    const { world, content, state } = ctx;
    const fresh = linesAfter(world.log, state['seen'] ?? 0);
    if (fresh.length) {
      state['seen'] = fresh.at(-1)!.id;
      tally(content, state, fresh);
      masterworks(ctx, fresh);
    }
    const day = Math.floor(world.tick / TICKS_PER_DAY);
    const c = content.callings;
    if (day % c.every === 0 && clockAt(world.tick, content.calendar).hour === c.hour)
      callingDay(ctx);
  },
};

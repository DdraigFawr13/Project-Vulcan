// The self system (P6.4, V-146, V-156): once a day, at self.json `hour`, everyone alive works out
// their roles (roles.ts) and whether their ambition is reached; every `ambition.checkDays` days
// someone without one may take one up (ambitions.ts). Laws read both (law `weigh.ts`); people
// practise for an ambition in free time (`mind.ts`). Owns `role` and `ambition`; no state.
import { clockAt, TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import type { SystemContext, System } from '../sim/index.ts';
import { fulfil, takeUp } from './ambitions.ts';
import { settleRoles } from './roles.ts';
import { SELF_TABLES } from './tables.ts';

const alive = (ctx: SystemContext): EntityRow[] =>
  (ctx.world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

export const selfSystem: System = {
  id: 'self',
  every: 'hour',
  stream: 'beliefs',
  emits: ['self.role', 'self.ambition', 'self.fulfilled'],
  tables: SELF_TABLES,
  init(ctx) {
    for (const p of alive(ctx)) settleRoles(ctx, p, true);
  },
  run(ctx) {
    const { world, content } = ctx;
    if (clockAt(world.tick, content.calendar).hour !== content.self.hour) return;
    const day = Math.floor(world.tick / TICKS_PER_DAY);
    const check = day % content.self.ambition.checkDays === 0;
    for (const p of alive(ctx)) {
      settleRoles(ctx, p, false);
      fulfil(ctx, p);
      if (check) takeUp(ctx, p);
    }
  },
};

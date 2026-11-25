// The asks system (6C Slice 3, V-225): owns the asks' levers; each hour lets go of a carrier who
// gave up the way to the barn. The asks themselves come from their askers (the lord's: engine
// lord), and the goods table is goods' (asks.ts).
import { TICKS_PER_HOUR } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { liveAsks } from '../goods/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { passAsk, takeAsk } from './levers.ts';

/** A carrier no longer hauling for the ask is no longer on the way. */
function letGo(ctx: SystemContext): void {
  for (const a of liveAsks(ctx.world)) {
    const going = (a['going'] as number[])[0];
    if (!going) continue;
    const p = alive(ctx.world).find((q) => q.id === going);
    if (!p || p['job'] !== 'haul' || p['ask'] !== a.id) a['going'] = [];
  }
}

export const asksSystem: System = {
  id: 'asks',
  every: 'minute',
  emits: ['ask.taken', 'ask.letPass'],
  initialState: {},
  commands: {
    takeAsk: (ctx, command, cause) => takeAsk(ctx, command.data, cause),
    passAsk: (ctx, command, cause) => passAsk(ctx, command.data, cause),
  },
  run(ctx) {
    if (ctx.world.tick % TICKS_PER_HOUR === 0) letGo(ctx);
  },
};

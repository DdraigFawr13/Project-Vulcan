// The asks system (6C Slice 3, V-225): owns the asks' levers and the villages' regard; each minute
// a stranger come with their village's trouble may ask (villages.ts); each hour a village's ask
// whose day has come is fetched, the shrine asks at a harvest home (shrine.ts), and a carrier who
// gave up the way to the barn is let go. The lord's asks are engine lord's; the goods table is
// goods' (asks.ts).
import { TICKS_PER_HOUR } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { liveAsks } from '../goods/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { passAsk, takeAsk } from './levers.ts';
import { harvestAfter, shrineAsks } from './shrine.ts';
import { REGARD_TABLES, strangersAsk, villagesDue } from './villages.ts';

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
  emits: [
    ...['ask.taken', 'ask.letPass', 'neighbour.asked', 'ask.gift', 'ask.regard', 'faith.asked'],
    ...['ask.done', 'ask.late', 'ask.passed', 'ask.unanswered'],
  ],
  tables: REGARD_TABLES,
  // `seen` the newest stranger's coming already heard; `home` the last harvest-home supper row
  // the shrine asked at.
  initialState: { seen: 0, home: 0 },
  commands: {
    takeAsk: (ctx, command, cause) => takeAsk(ctx, command.data, cause),
    passAsk: (ctx, command, cause) => passAsk(ctx, command.data, cause),
  },
  run(ctx) {
    const { state } = ctx;
    state['seen'] = strangersAsk(ctx, state['seen'] ?? 0);
    if (ctx.world.tick % TICKS_PER_HOUR) return;
    letGo(ctx);
    villagesDue(ctx);
    const home = harvestAfter(ctx, state['home'] ?? 0);
    if (!home) return;
    state['home'] = home.id;
    shrineAsks(ctx, home['line'] as number);
  },
};

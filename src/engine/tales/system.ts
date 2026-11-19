// The tales system (P6.3, V-140, V-155, V-162): every minute it reads the new ledger lines for
// events a tale copies and gives them to those who saw; every hour pairs together may pass one;
// once a day unfed beliefs soften and untold tales are forgotten. It owns `story`, `tale` and
// `belief`; its state is the last line it read. Beliefs change nothing yet (Bundles 3 to 6).
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { fadeBeliefs } from './belief.ts';
import { learn } from './learn.ts';
import { TALES_TABLES } from './tables.ts';
import { forget, tellings } from './tell.ts';

export const talesSystem: System = {
  id: 'tales',
  every: 'minute',
  stream: 'social',
  emits: ['tale.told'],
  initialState: { seen: 0 },
  tables: TALES_TABLES,
  init(ctx) {
    ctx.state['seen'] = ctx.world.log.at(-1)?.id ?? 0;
  },
  run(ctx) {
    learn(ctx);
    // Half past each hour, so tellings and the day's fading never share a minute with the hour's.
    const half = TICKS_PER_HOUR / 2;
    if (ctx.world.tick % TICKS_PER_HOUR !== half) return;
    tellings(ctx);
    if (ctx.world.tick % TICKS_PER_DAY === half) {
      fadeBeliefs(ctx);
      forget(ctx);
    }
  },
};

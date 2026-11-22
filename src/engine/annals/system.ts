// The annals system (Phase 6T, V-191): each midnight it keeps the day's lines a recap will tell;
// when a season turns it writes that season's recap, and when the year turns the year's too. The
// recaps are written whether or not the player shows them, so a seed always gives the same ones.
// It owns `annalLine`, `annal` and `annalText`; it draws no dice and writes no ledger line.
import { clockAt, TICKS_PER_DAY } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { collect } from './collect.ts';
import { saidOf } from './say.ts';
import { writeSeason } from './season.ts';
import { ANNALS_TABLES } from './tables.ts';
import { writeYear } from './year.ts';

export const annalsSystem: System = {
  id: 'annals',
  every: 'day',
  initialState: { seen: 0, opened: 0, yearOpened: 0 },
  refs: ['opened', 'yearOpened'],
  tables: ANNALS_TABLES,
  run(ctx) {
    collect(ctx);
    const { calendar } = ctx.content;
    const now = clockAt(ctx.world.tick, calendar);
    const before = clockAt(ctx.world.tick - TICKS_PER_DAY, calendar);
    if (now.season === before.season) return;
    // The year's recap stands in for winter's on the page, so it may say what winter's says.
    const said = saidOf(ctx.state);
    writeSeason(ctx, said);
    if (now.year !== before.year) writeYear(ctx, before.year, said);
  },
};

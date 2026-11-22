// The faith system (6B Bundle 4, P6.8, V-143, V-187): each person's faith, the shrine and its
// priest, and the feast days. Each hour newcomers take their people's faith, feast days are noted
// from the colony's history and asked for by the priest, and a kept day's supper is called; once a
// day a faith with enough holders raises its shrine. The Feasts law (engine law) is the only lever.
import type { System } from '../sim/index.ts';
import { greenOf } from '../build/index.ts';
import { believeHour } from './believe.ts';
import { askDays, feastDayHour, noteDays } from './days.ts';
import { namePriests, raiseShrines } from './shrine.ts';
import { FAITH_TABLES } from './tables.ts';

export const faithSystem: System = {
  id: 'faith',
  every: 'hour',
  emits: [
    ...['faith.shrine', 'faith.priest', 'faith.dayAsked', 'faith.feastDay'],
    ...['faith.noFeast', 'faith.leanDay', 'faith.dayHeld'],
  ],
  stream: 'faith',
  tables: FAITH_TABLES,
  run(ctx) {
    believeHour(ctx);
    raiseShrines(ctx, greenOf(ctx.world));
    namePriests(ctx);
    noteDays(ctx);
    askDays(ctx);
    feastDayHour(ctx);
  },
};

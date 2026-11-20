// The family system (P6.1, V-145, V-161): owns closeness between unwed adults, courtship and
// weddings. Each hour the pairs at leisure together grow closer; at family.json `hour` each day
// closeness fades, courtships move on and new ones begin. No lever: nobody is told whom to marry.
import { clockAt } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { hourTogether } from './close.ts';
import { courtingDay } from './court.ts';
import { FAMILY_TABLES } from './tables.ts';

export const familySystem: System = {
  id: 'family',
  every: 'hour',
  emits: ['family.courting', 'family.parted', 'family.wed', 'family.noFeast'],
  tables: FAMILY_TABLES,
  run(ctx) {
    const { world, content } = ctx;
    hourTogether(world, content);
    if (clockAt(world.tick, content.calendar).hour === content.family.hour) courtingDay(ctx);
  },
};

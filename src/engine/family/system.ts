// The family system (P6.1, V-145, V-161): owns closeness between unwed adults, courtship and
// weddings. Each hour the pairs at leisure together grow closer; at family.json `hour` each day
// closeness fades, courtships move on and new ones begin, children are born and grow up, and the
// old may die. No lever: nobody is told whom to marry.
import { clockAt } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { hourTogether } from './close.ts';
import { drawOrientations } from './drawn.ts';
import { courtingDay } from './court.ts';
import { oldAgeDay } from './age.ts';
import { birthsDay } from './birth.ts';
import { growingDay } from './kin.ts';
import { leftDay } from './left.ts';
import { FAMILY_TABLES } from './tables.ts';

export const familySystem: System = {
  id: 'family',
  every: 'hour',
  emits: [
    ...['family.courting', 'family.parted', 'family.wed', 'family.noFeast'],
    ...['family.expecting', 'family.born', 'family.cameOfAge', 'family.takenIn', 'family.left'],
    'health.died',
  ],
  stream: 'kin',
  tables: FAMILY_TABLES,
  run(ctx) {
    const { world, content } = ctx;
    drawOrientations(world, content, ctx.rng());
    hourTogether(world, content);
    if (clockAt(world.tick, content.calendar).hour !== content.family.hour) return;
    courtingDay(ctx);
    birthsDay(ctx);
    leftDay(ctx);
    oldAgeDay(ctx);
    growingDay(ctx);
  },
};

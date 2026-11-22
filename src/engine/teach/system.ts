// The teaching system (6B Bundle 6, P6.13, V-074, V-141, V-189): band `learn.ts` makes practice
// beside a master quicker; this system binds masters and apprentices under the Apprentices law
// (daily at teach.json `hour`), lets children watch a parent at work, records who taught whom from
// the ledger and says what a master takes when they die untaught. The law is the only lever.
// The schoolroom (school.ts, books.ts): its teacher, children's lessons and books.
import { clockAt } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { apprenticeDay } from './bond.ts';
import { loseBooks } from './books.ts';
import { lossHour } from './loss.ts';
import { chooseTeacher } from './school.ts';
import { recordTaught } from './record.ts';
import { TEACH_TABLES } from './tables.ts';
import { watchHour } from './watch.ts';

export const teachSystem: System = {
  id: 'teach',
  every: 'hour',
  emits: [
    ...['teach.apprentice', 'teach.finished', 'teach.parted', 'teach.lost'],
    ...['skill.taught', 'skill.rose', 'skill.read'],
    ...['school.teacher', 'school.writing', 'school.book', 'school.bookLost', 'school.noTeacher'],
  ],
  tables: TEACH_TABLES,
  run(ctx) {
    watchHour(ctx);
    recordTaught(ctx);
    lossHour(ctx);
    chooseTeacher(ctx);
    loseBooks(ctx);
    if (clockAt(ctx.world.tick, ctx.content.calendar).hour === ctx.content.teach.hour)
      apprenticeDay(ctx);
  },
};

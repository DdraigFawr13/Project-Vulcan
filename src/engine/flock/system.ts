// The flock system (P5.4b, Phase 5 Bundle 3): after the wild system each tick. Each minute the
// animals walk, the pack lures are kept and the pack may take one; on the hour pastures that were
// built get their flock, mowing days are set (06:00), the night's lure is noted at dusk and
// forgotten at dawn; at midnight the hay, the feed, births and the cull are worked out.
import { clockAt, TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { dailyFlock } from './daily.ts';
import { FLOCK_TABLES, flocksOf, headOf, unflocked } from './flock.ts';
import { setMowDay } from './hay.ts';
import { moveFlocks } from './move.ts';
import { noteLeftOut, packTakes, syncLures } from './pack.ts';
import { addEntity } from '../entity/index.ts';

export const flockSystem: System = {
  id: 'flock',
  every: 'minute',
  stream: 'flock',
  emits: [
    ...['flock.tamed', 'flock.full', 'flock.lambed', 'flock.youngDied', 'flock.grown'],
    ...['flock.shorn', 'flock.mowing', 'flock.haySpoiled', 'flock.rick', 'flock.cullSet'],
    ...['flock.cullEarly', 'flock.butchered', 'flock.onHay', 'flock.onGrass'],
    ...['flock.starved', 'flock.leftOut', 'flock.taken', 'flock.brokeIn'],
  ],
  // `wetPrev`, `wetNow`: the weather's wet flag for yesterday and today (a dry night is both dry);
  // `lured`: how many pack lures the flocks set last minute (pack.ts).
  initialState: { wetPrev: 0, wetNow: 0, lured: 0 },
  tables: FLOCK_TABLES,
  run(ctx) {
    const { world } = ctx;
    const tick = world.tick;
    if (tick % TICKS_PER_DAY === 0) dailyFlock(ctx);
    if (tick % TICKS_PER_HOUR === 0) hourly(ctx);
    moveFlocks(ctx);
    if (flocksOf(world).length) {
      syncLures(ctx);
      packTakes(ctx);
    }
  },
};

/** On the hour: a flock for each pasture newly built, the 06:00 mowing day, dusk and dawn. */
function hourly(ctx: Parameters<NonNullable<System['run']>>[0]): void {
  const { world, content } = ctx;
  for (const p of unflocked(world))
    addEntity(world, 'flock', {
      ...{ pasture: p.id, hay: 0, swaths: [], swathHay: [], swathDry: [], mown: [], mowDay: 0 },
      ...{ mowLog: 0, spoiled: 0, folded: 0, outLine: 0, takenAt: 0, takenLine: 0, onHay: 0 },
      ...{ cullLine: 0, full: 0, line: p['last'] as number, births: [], watch: 0, watchPiece: 0 },
      year: clockAt(world.tick, content.calendar).year,
    });
  const hour = clockAt(world.tick, content.calendar).hour;
  const night = content.wild.pack.night;
  for (const flock of flocksOf(world)) {
    if (hour === 6) setMowDay(ctx, flock);
    if (hour === night.from && !flock['folded'] && !flock['outLine'] && headOf(world, flock))
      noteLeftOut(ctx, flock, content.flock.why['none']!, 0);
    if (hour === night.to) flock['outLine'] = 0;
  }
}

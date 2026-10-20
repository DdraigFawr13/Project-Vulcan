// The wild system (P5.4a, V-110, V-111, V-122): herds and the one pack are laid out in `init`;
// each minute the animals move, each hour new prints reach the chunks and the pack's night visit
// begins or ends, and at midnight (after the weather, so it is listed after it) the day's
// hunger, snow losses and breeding are worked out.
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/index.ts';
import type { System } from '../sim/index.ts';
import { dailyWild } from './daily.ts';
import { moveAnimals } from './move.ts';
import { placeWild } from './place.ts';
import { raiseDirty } from './prints.ts';
import { visitOnHour } from './visit.ts';
import { WILD_TABLES } from './wild.ts';

export const wildSystem: System = {
  id: 'wild',
  every: 'minute',
  stream: 'wild',
  emits: [
    'wild.packNamed',
    'wild.herdLow',
    'wild.packKilled',
    'wild.packHungry',
    'wild.packAtEdge',
    'wild.packLeft',
    'wild.killed',
    'wild.predatorWounded',
    'wild.predatorKilled',
    'wild.packDrewOff',
  ],
  // `open`: open ground tiles (for snow cover); `fleeing`: animals running; `trot`: pack animals on a way; `lures`: see visit.ts.
  initialState: { open: 0, fleeing: 0, trot: 0, lures: 0 },
  tables: WILD_TABLES,
  init: placeWild,
  run(ctx) {
    const tick = ctx.world.tick;
    if (tick % TICKS_PER_DAY === 0) dailyWild(ctx);
    if (tick % TICKS_PER_HOUR === 0) {
      if (tick % (ctx.content.wild.printRedraw * TICKS_PER_HOUR) === 0) raiseDirty(ctx);
      visitOnHour(ctx);
    }
    moveAnimals(ctx);
  },
};

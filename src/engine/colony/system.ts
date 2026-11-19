// The colony system (P6.6, V-146, V-158, V-159): owns the colony's standing and its causes, the
// elder and the factions. Each hour it sees whether a law moved under a faction or the elder is
// gone; at colony.json `hour` each day it drops spent causes, tallies the winter, adds the weekly
// causes, picks the elder every `elder.every` days, and lets factions form, change and break up.
// The `letStand` lever turns down a petition; changing the law is the other answer.
import { clockAt, TICKS_PER_DAY } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { elderGone, pickElder } from './elder.ts';
import { factionsDay, lawsMoved, letStand } from './faction.ts';
import { expire, weekly, winterTally } from './standing.ts';
import { COLONY_TABLES } from './tables.ts';

function begin(ctx: SystemContext): void {
  addEntity(ctx.world, 'standing', {
    ...{ standing: ctx.content.colony.standing.start, elder: 0, line: 0, friends: [] },
  });
}

export const colonySystem: System = {
  id: 'colony',
  every: 'hour',
  emits: [
    'colony.standing',
    'colony.elder',
    'colony.faction',
    'colony.petition',
    'colony.joined',
    'colony.disbanded',
  ],
  tables: COLONY_TABLES,
  init: begin,
  commands: {
    letStand: (ctx, command, cause) =>
      letStand(ctx, Number((command.data as { faction?: unknown }).faction), cause),
  },
  run(ctx) {
    const { world, content } = ctx;
    // A world saved before P6.6 gets its row on first use.
    if (!world.entities['standing']?.length) begin(ctx);
    lawsMoved(ctx);
    elderGone(ctx);
    if (clockAt(world.tick, content.calendar).hour !== content.colony.hour) return;
    const day = Math.floor(world.tick / TICKS_PER_DAY);
    expire(ctx);
    winterTally(ctx);
    if (day > 0) weekly(ctx, day);
    if (day % content.colony.elder.every === 0) pickElder(ctx);
    factionsDay(ctx);
  },
};

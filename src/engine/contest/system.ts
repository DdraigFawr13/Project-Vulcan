// The contest system (6C Slice 7 part 3, V-236, V-241): watches the harvest-home suppers and holds
// the contests the minute one is eaten, before the lord (if he is at it) judges his supper. A
// supper let go holds none. The lord's coming is read from the reeve's row as data: contest imports
// nothing of the lord.
import { today, type EntityRow } from '../core/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { holdContests } from './hold.ts';
import { CONTEST_TABLES } from './tables.ts';

const harvest = (f: EntityRow): boolean => !(f['couple'] as number[]).length && !f['holy'];

/** Whether the lord rode in for supper `f` (the reeve's row says so while he is here). */
const lordAt = (ctx: SystemContext, f: EntityRow): boolean =>
  (ctx.world.entities['reeve'] ?? []).some((r) => r['feast'] === f.id && r['lord']);

export const contestSystem: System = {
  id: 'contest',
  every: 'minute',
  stream: 'contest',
  emits: ['contest.held', 'contest.rival', 'tale.byname'],
  initialState: { done: 0 },
  tables: CONTEST_TABLES,
  run(ctx) {
    const { world, state } = ctx;
    for (const f of world.entities['feast'] ?? []) {
      if (f.id <= (state['done'] ?? 0) || !harvest(f)) continue;
      if (f['state'] === 'eaten') holdContests(ctx, f, lordAt(ctx, f));
      else if (today(world) <= (f['on'] as number)) return;
      state['done'] = f.id;
    }
  },
};

// Work (P2.4): nobody is told what to do (V-015). In working hours a free person looks at what
// the colony wants and takes something up themselves, in their own priority order; each kind of
// work is a row of the job table (jobtable.ts), which says how it is taken up and how a minute of
// it goes. Taking up work is a line.
import { needOf } from '../needs/index.ts';
import type { EntityRow } from '../core/index.ts';
import { loadOf } from '../goods/index.ts';
import { isDark, lit } from '../lamp/index.ts';
import { afterDusk, workableInDark } from './dusk.ts';
import { lineOf } from './lines.ts';
import type { SystemContext } from '../sim/index.ts';
import { takeUpChange } from './trades.ts';
import { draughtFirst, nursing } from './nurse.ts';
import { deliver, LOOK_AGAIN, takeUpHauling } from './haul.ts';
import { hearthFirst } from './hearth.ts';
import { endHunt } from './hunt.ts';
import { herding } from './herd.ts';
import { takeUpMarked } from './gather.ts';
import { JOBS } from './jobtable.ts';
import { spotOf } from './spots.ts';
import { jobsInOrder } from './priority.ts';

const rowOf = (p: EntityRow) => JOBS[p['job'] as string];

/** The work in hand goes on: herding's dusk and dawn jobs, a walk to work, the job table's minute
 * of the work they are at (in the work hours, by the light it needs: outdoor work stops at dusk,
 * the finer trades need a candle in their room, P5.13), then nursing. */
function inHand(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  const can = (job: string) => hours && lit(ctx, p, job);
  // P5.4a: hunting and fishing end at dusk, wherever they have got to.
  if ((p['job'] === 'hunt' || p['job'] === 'fish') && !can(p['job'])) {
    endHunt(p);
    p['path'] = [];
  }
  if (herding(ctx, p, hours)) return true;
  if (p['doing'] === 'work' && (p['path'] as number[]).length > 0) return true;
  const row = rowOf(p);
  if (row?.work && (row.always || can(p['job'] as string)) && row.work(ctx, p)) return true;
  return nursing(ctx, p, hours);
}

/** A load in hand goes to a store, unless the work keeps it till morning (`holds`), as does a
 * sinker the shaft's ladder out of hours; undefined when there is no load to see to. */
function carryIn(ctx: SystemContext, p: EntityRow, hours: boolean): boolean | undefined {
  const load = loadOf(ctx.world, p.id);
  if (!load) return undefined;
  if (!hours && p['job'] === 'mine' && p['task'] === 'sink') return false;
  if (rowOf(p)?.holds) return undefined;
  p['job'] = 'haul';
  deliver(ctx, p, load);
  return true;
}

/** Under its seek line, recreation beats taking up new work (P2.2: the mind lets them relax), as
 * does the wait after finding none. */
function freeForNew(ctx: SystemContext, p: EntityRow): boolean {
  const fun = needOf(ctx.world, p.id, 'recreation');
  const seek = lineOf(ctx, p, 'recreation');
  if (fun && (fun['value'] as number) < seek) return false;
  return ctx.world.tick >= (p['next'] as number);
}

/** One minute of work for someone free; false when there is nothing for them to do. */
export function working(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  if (inHand(ctx, p, hours)) return true;
  const carried = carryIn(ctx, p, hours);
  if (carried !== undefined) return carried;
  if (!hours) return false;
  // After dusk only work that can be done in the dark or by light is taken up (P5.13).
  if (isDark(ctx.content, ctx.world.tick) && spotOf(p).z === 0) return afterDusk(ctx, p, takeUp);
  // By daylight, a minute at the tree, boulder, bush or load they chose.
  const row = rowOf(p);
  if (row?.atTarget && (p['target'] as number) >= 0 && row.atTarget(ctx, p)) return true;
  return freeForNew(ctx, p) && takeUp(ctx, p);
}

/** Chooses new work: a test-mode marked tree, a draught to give, then changing clothes
 * (trades.ts), then the Work sheet's kinds in their priority order (priority.ts), a cold room's
 * hearth first; after dusk only work the dark or a light allows (dusk.ts). */
function takeUp(ctx: SystemContext, p: EntityRow, dark = false): boolean {
  const { world, content } = ctx;
  if (!dark && (takeUpMarked(ctx, p, false) || draughtFirst(ctx, p) || takeUpChange(ctx, p)))
    return true;
  for (const job of hearthFirst(ctx, p, jobsInOrder(world, content, p))) {
    if (dark && !workableInDark(ctx, job)) continue;
    const before = p['took'];
    if (JOBS[job]?.takeUp?.(ctx, p)) return true;
    // Taken up (a line said) and stopped at once: look again later, not at the next kind.
    if (p['took'] !== before) break;
  }
  // Nothing else to do: carry in the food past its plate that would spoil out there (outdoor
  // work, so not after dusk).
  if (!dark && takeUpHauling(ctx, p, true)) return true;
  p['job'] = '';
  p['target'] = -1;
  p['next'] = world.tick + LOOK_AGAIN;
  return false;
}

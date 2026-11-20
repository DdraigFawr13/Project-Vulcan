// Working beside one's master (6B Bundle 6, P6.13, V-189 q4). The prototype bound masters and
// apprentices but they almost never stood at the same work, so nobody was taught. Now a free
// apprentice whose master is at work in the bond's skill, and who puts that work level with their
// best on their own Priorities (never above a higher priority, V-041), walks over and works beside
// them: each minute there practises the skill at the apprentice pace (band `learn.ts`). It is the
// bond's line that says why. The help adds nothing to the master's work: an apprentice is
// learning, not producing, which is the colony's cost of the bond.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { far, people } from '../entity/index.ts';
import { able, goBeside, levelOf, masterOf, practise } from '../band/index.ts';
import { coldHearth } from '../crafts/index.ts';
import type { SystemContext } from '../sim/index.ts';

const HELP = 'help';

/** The master and skill `p` would work beside now, if any. */
function besideNow(
  ctx: SystemContext,
  p: EntityRow,
): { m: EntityRow; bond: EntityRow } | undefined {
  const { world, content } = ctx;
  const bond = masterOf(world, p.id);
  const m = bond && people(world).find((q) => q.id === bond['master']);
  if (!bond || !m || m['status'] !== 'alive' || m['doing'] !== 'work') return undefined;
  const job = m['job'] as string;
  const jobs = content.work.priority.jobs;
  if (!jobs.includes(job) || content.jobs.find((j) => j.id === job)?.skill !== bond['skill'])
    return undefined;
  // Level with their best among the kinds they are able for.
  const kinds = jobs.filter((j) => able(content, p, j));
  const best = Math.min(...kinds.map((j) => levelOf(world, content, p.id, j)));
  if (levelOf(world, content, p.id, job) > best || !able(content, p, job)) return undefined;
  return { m, bond };
}

/** Takes up working beside one's master, when they are at the bond's work; false if not. */
export function takeUpHelping(ctx: SystemContext, p: EntityRow): boolean {
  const now = besideNow(ctx, p);
  if (!now || lessonDone(ctx, now.bond) || hearthBefore(ctx, p, now.m['job'] as string))
    return false;
  Object.assign(p, { job: HELP, target: now.m.id, took: now.bond['line'] as number });
  return helping(ctx, p);
}

/** A minute beside the master: walk over while they are out of reach, else practise their skill.
 * Stops when the master leaves that work or the bond ends. */
export function helping(ctx: SystemContext, p: EntityRow): boolean {
  const now = besideNow(ctx, p);
  if (!now || now.m.id !== p['target']) return stop(p);
  if (far(p, now.m) > 1)
    return (
      goBeside(ctx, p, now.m['x'] as number, now.m['y'] as number, now.m['z'] as number) || stop(p)
    );
  if (lessonDone(ctx, now.bond)) return stop(p);
  now.bond['beside'] = (now.bond['beside'] as number) + 1;
  practise(ctx, p, now.bond['skill'] as string, p['took'] as number);
  return true;
}

/** Whether today's lesson (teach.json `lesson` minutes beside the master) is over; a new day
 * starts the count again. */
function lessonDone(ctx: SystemContext, bond: EntityRow): boolean {
  const day = Math.floor(ctx.world.tick / TICKS_PER_DAY);
  if (bond['day'] !== day) Object.assign(bond, { day, beside: 0 });
  return (bond['beside'] as number) >= ctx.content.teach.lesson;
}

/** Whether a cold room's hearth comes before the master's work for `p`, as crafts `hearthFirst`
 * puts it first among the kinds at its level. */
function hearthBefore(ctx: SystemContext, p: EntityRow, job: string): boolean {
  const { world, content } = ctx;
  const build = content.buildings.job;
  if (!coldHearth(ctx) || !able(content, p, build)) return false;
  return levelOf(world, content, p.id, build) <= levelOf(world, content, p.id, job);
}

function stop(p: EntityRow): false {
  Object.assign(p, { job: '', target: -1 });
  return false;
}

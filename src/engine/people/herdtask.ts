// Herding's daytime work (Phase 5 Bundle 3, V-041): what a herder takes up when nobody must fold
// or let out. In order: butcher an animal marked to cull, shear, carry cured hay to the rick, mow
// the meadow on a mowing day, and sit near a wild herd until it lets one be taken in. The rules
// themselves are src/engine/flock; this picks the work and does the walking and the minutes.
import { clockAt, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import {
  canTame,
  flocksOf,
  marked,
  mowable,
  readySwaths,
  shearable,
  takeIn,
  tameTargets,
} from '../flock/index.ts';
import { animalsOf, herdOf, speciesOf } from '../wild/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { people, canStandBeside, skillOf, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

export interface Pick {
  task: 'butcher' | 'shear' | 'hay' | 'mow' | 'tame';
  /** An animal's id, a tile, or the wild herd being tamed. */
  target: number;
}

export const flockById = (world: WorldState, id: number): EntityRow | undefined =>
  flocksOf(world).find((f) => f.id === id);

/** Whether another herder already has this task on this target. */
const claimed = (world: WorldState, p: EntityRow, task: string, target: number): boolean =>
  people(world).some(
    (q) => q.id !== p.id && q['job'] === 'herd' && q['task'] === task && q['target'] === target,
  );

const cheb = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const at = (r: EntityRow) => ({ x: r['x'] as number, y: r['y'] as number });

/** The nearest of `spots` (by walking distance guess, then id) that `p` can get beside. */
function nearest<T extends { id: number }>(
  ctx: SystemContext,
  p: EntityRow,
  rows: readonly T[],
  where: (r: T) => { x: number; y: number },
): T | undefined {
  const here = spotOf(p);
  return rows
    .map((r) => [r, Math.abs(where(r).x - here.x) + Math.abs(where(r).y - here.y)] as const)
    .sort((a, b) => a[1] - b[1] || a[0].id - b[0].id)
    .map(([r]) => r)
    .find((r) => canStandBeside(ctx, p, where(r).x, where(r).y));
}

/** The minutes of a mowing, shearing... stroke, shorter with farming skill (as farm.ts's sow). */
export function strokeMinutes(
  ctx: SystemContext,
  p: EntityRow,
  minutes: number,
  skill: string,
): number {
  const skilled = ctx.content.work.farm.skilled;
  return Math.max(1, Math.ceil((minutes * 2 * skilled) / (skilled + skillOf(ctx.world, p, skill))));
}

/** What `p` would take up on `flock` now, in the order the brief sets. */
export function pickTask(ctx: SystemContext, p: EntityRow, flock: EntityRow): Pick | undefined {
  const { world, content } = ctx;
  const w = world.map.width;
  const tile = (i: number) => ({ x: i % w, y: Math.floor(i / w) });
  if ((p['hay'] as number) > 0) return { task: 'hay', target: -1 };
  const cull = nearest(
    ctx,
    p,
    marked(world, flock).filter((a) => !claimed(world, p, 'butcher', a.id)),
    at,
  );
  if (cull) return { task: 'butcher', target: cull.id };
  const wool = nearest(
    ctx,
    p,
    shearable(world, content, flock).filter((a) => !claimed(world, p, 'shear', a.id)),
    at,
  );
  if (wool) return { task: 'shear', target: wool.id };
  const swath = nearest(
    ctx,
    p,
    readySwaths(world, content, flock)
      .filter((t) => !claimed(world, p, 'hay', t))
      .map((id) => ({ id })),
    (r) => tile(r.id),
  );
  if (swath) return { task: 'hay', target: swath.id };
  const meadow = nearest(
    ctx,
    p,
    mowable(world, content, flock)
      .filter((t) => !claimed(world, p, 'mow', t))
      .map((id) => ({ id })),
    (r) => tile(r.id),
  );
  if (meadow) return { task: 'mow', target: meadow.id };
  // Taming is patient work: at most `tame.crew` sit at it on a flock at once.
  const taming = people(world).filter(
    (q) => q.id !== p.id && q['job'] === 'herd' && q['task'] === 'tame' && q['plan'] === flock.id,
  ).length;
  if (taming >= content.flock.tame.crew) return undefined;
  const herd = canTame(world, content, flock) ? tameTargets(world, content, flock)[0] : undefined;
  return herd ? { task: 'tame', target: herd.id } : undefined;
}

/** The wild animal of herd `herdId` nearest to `p`. */
function nearestOf(world: WorldState, p: EntityRow, herdId: number): EntityRow | undefined {
  return animalsOf(world)
    .filter((a) => a['herd'] === herdId)
    .sort((a, b) => cheb(at(a), spotOf(p)) - cheb(at(b), spotOf(p)) || a.id - b.id)[0];
}

/** Minutes of sitting that bring one in: young in a `tame.young` month, else a grown one. */
export const tameNeed = (world: WorldState, content: EngineContent): number =>
  content.flock.tame.young.includes(
    content.calendar.monthNames[clockAt(world.tick, content.calendar).month]!,
  )
    ? content.flock.tame.youngMinutes
    : content.flock.tame.adultMinutes;

/** Sets off for a tile `flee + 2` from the animal, on the side `p` stands; false with no way. */
function approach(ctx: SystemContext, p: EntityRow, animal: EntityRow, flee: number): boolean {
  const [a, here] = [at(animal), spotOf(p)];
  const clamp = (v: number, r: number) => Math.max(-r, Math.min(r, v));
  for (let r = flee + 2; r <= flee + 5; r += 1)
    if (walkTo(ctx, p, { x: a.x + clamp(here.x - a.x, r), y: a.y + clamp(here.y - a.y, r), z: 0 }))
      return true;
  return false;
}

/**
 * One minute of taming: walk to `flee + 2` tiles of the herd's nearest animal (nearer sets it
 * running), then sit `tame.session` minutes a sitting, the minutes adding up on the person (`sat`,
 * for the herd `herdId`; another herd starts again). At the total, `takeIn` the nearest animal.
 * False when there is nothing more to do (the caller stops the job).
 */
export function tameStep(ctx: SystemContext, p: EntityRow, flock: EntityRow): boolean {
  const { world, content } = ctx;
  // Mid-sitting only the herd and its nearest animal are looked at again; the room, the month
  // and the herd's spare animals at the start of each sitting and before the taking in.
  const sitting = (p['work'] as number) > 0 && p['herdId'] === p['target'];
  const herd = sitting
    ? herdOf(world, p['target'] as number)
    : tameTargets(world, content, flock).find((h) => h.id === p['target']);
  const animal =
    herd && (sitting || canTame(world, content, flock)) && nearestOf(world, p, herd.id);
  if (!herd || !animal) return false;
  if (p['herdId'] !== herd.id) Object.assign(p, { herdId: herd.id, sat: 0 });
  const flee = speciesOf(content, herd['species'] as string).flee;
  if (cheb(at(animal), spotOf(p)) > flee + 2) return approach(ctx, p, animal, flee);
  if ((p['work'] as number) <= 0) p['work'] = content.flock.tame.session;
  p['work'] = (p['work'] as number) - 1;
  p['sat'] = (p['sat'] as number) + 1;
  practise(ctx, p, skillName(content), p['took'] as number);
  if ((p['sat'] as number) >= tameNeed(world, content)) {
    if (!canTame(world, content, flock)) return false;
    Object.assign(p, { sat: 0, herdId: 0 });
    takeIn(ctx, flock, animal, p.id, (p['took'] as number) || (flock['line'] as number));
    return false;
  }
  return (p['work'] as number) > 0;
}

export const skillName = (content: EngineContent): string =>
  content.jobs.find((j) => j.id === content.flock.job)?.skill ?? '';

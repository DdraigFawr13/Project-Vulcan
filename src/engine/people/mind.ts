// A person's round (P2.2): each minute they choose what to do from their needs and the hour. In
// order: eat when food is under its `seek` line (waking for it), sleep at night or when tired, on
// their own bed or bedroll if they can get to it, take their leisure in the evening or when bored, and
// otherwise stroll near the camp. What they are doing is the `doing` field, which the needs
// system reads each hour; none of it is a ledger line until a need crosses its warning line.
import { clockAt, type EntityRow } from '../core/index.ts';
import { itemsAt, itemsOf } from '../goods/index.ts';
import { armOut } from '../health/index.ts';
import { needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { hoursOf } from '../law/index.ts';
import { bedOwnedBy } from '../build/index.ts';
import { bankFire } from '../fire/index.ts';
import { claimBed } from './claim.ts';
import { carryBed, movesIn } from './home.ts';
import { working } from './jobs.ts';
import { spotOf } from './spots.ts';
import { cooked, eat } from './eat.ts';
import { danger } from './care.ts';
import { walkTo, wander } from './walk.ts';
import { tendInEvening } from './tend.ts';
import { warming } from './warm.ts';

export const MIND_FIELDS = {
  /** `eat`, `sleep`, `moveBed` (home.ts), `work` (jobs.ts), `warm` (warm.ts), `hurt` (lying
   * hurt, care.ts), `flee` or `stand` (a predator in sight, flee.ts), `relax` or '' (idle). */
  doing: 'text',
  /** The tick before which they do not look for food again after finding none they can reach. */
  retry: 'int',
  /** While moving in: the surface tile (index + 1) they carry their bedroll to, else 0. */
  bedTo: 'int',
  /** The tick before which a cold person does not look for a warm place again after finding
   * none (warm.ts). */
  chill: 'int',
  /** The game day (1 + its index) they last ate seed grain, for one line a day (P4.7). */
  seeded: 'int',
} as const;

const RETRY = 60;

const valueOf = (ctx: SystemContext, p: EntityRow, need: string): number =>
  (needOf(ctx.world, p.id, need)?.['value'] as number) ?? ctx.content.life.scale;

const seekOf = (ctx: SystemContext, need: string): number =>
  ctx.content.life.needs.find((n) => n.id === need)?.seek ?? 0;

/** Food of last resort (seed grain, P4.7) is eaten only when `desperate`. */
const edible = (ctx: SystemContext, kind: string, desperate: boolean): boolean =>
  ctx.content.life.eat[kind] !== undefined &&
  (desperate || !ctx.content.life.lastResort.includes(kind));

/** Food on their tile: a cooked meal, then ordinary food, then (only when `desperate`) food of
 * last resort. */
const foodHere = (ctx: SystemContext, p: EntityRow, desperate: boolean): EntityRow | undefined => {
  const here = itemsAt(ctx.world, p['x'] as number, p['y'] as number, p['z'] as number);
  return (
    here.find((i) => cooked(ctx, i) && edible(ctx, i['kind'] as string, false)) ??
    here.find((i) => edible(ctx, i['kind'] as string, false)) ??
    here.find((i) => edible(ctx, i['kind'] as string, desperate))
  );
};

/** Sets off to the nearest food lying on the ground (food of last resort only when `desperate`),
 * or a cooked meal if it is no more than `work.cook.prefer` tiles further; false when there is
 * none to reach. */
function goEat(ctx: SystemContext, p: EntityRow, desperate: boolean): boolean {
  const { x, y, z } = { x: p['x'] as number, y: p['y'] as number, z: p['z'] as number };
  let best: EntityRow | undefined;
  let far = Infinity;
  let meal: EntityRow | undefined;
  let mealFar = Infinity;
  for (const i of itemsOf(ctx.world)) {
    if (i['holder'] || !edible(ctx, i['kind'] as string, desperate)) continue;
    const d =
      Math.max(Math.abs((i['x'] as number) - x), Math.abs((i['y'] as number) - y)) +
      Math.abs((i['z'] as number) - z) * 100;
    if (d < far) [best, far] = [i, d];
    if (cooked(ctx, i) && d < mealFar) [meal, mealFar] = [i, d];
  }
  if (meal && mealFar <= far + ctx.content.work.cook.prefer) best = meal;
  if (!best) return false;
  return walkTo(ctx, p, { x: best['x'] as number, y: best['y'] as number, z: best['z'] as number });
}

/** Lies down: on their own laid-out bedroll when there is a way to it, else where they stand;
 * first carrying it into a house that has room (home.ts). */
function goToBed(ctx: SystemContext, p: EntityRow, night: boolean): void {
  claimBed(ctx, p);
  if (movesIn(ctx, p)) return;
  p['doing'] = 'sleep';
  // Their own bed (P3.5), else their laid bedroll.
  const bed =
    bedOwnedBy(ctx.world, p.id) ??
    itemsOf(ctx.world).find((i) => i['owner'] === p.id && i['state'] === 'laid');
  const there = bed && bed['x'] === p['x'] && bed['y'] === p['y'] && bed['z'] === p['z'];
  if (bed && !there)
    walkTo(ctx, p, { x: bed['x'] as number, y: bed['y'] as number, z: bed['z'] as number });
  else p['path'] = [];
  // Going to bed for the night, they bank the fire that warms their bed (P3.6, V-048).
  if (night) bankFire(ctx, p, bed ? spotOf(bed) : spotOf(p));
}

/** One minute of choosing, after the minute's steps. */
export function think(ctx: SystemContext, p: EntityRow, hour: number): void {
  const { world, content } = ctx;
  const life = content.life;
  // Danger comes first (P5.6): lying hurt, carrying the hurt, binding a bleeding wound.
  if (danger(ctx, p)) return;
  const walking = (p['path'] as number[]).length > 0;
  if (p['doing'] === 'moveBed') {
    if (!walking) carryBed(ctx, p);
    return;
  }
  const low = life.needs.find((n) => n.id === 'food')?.low ?? 0;
  if (p['doing'] === 'eat') {
    if (walking) return;
    const item = foodHere(ctx, p, valueOf(ctx, p, 'food') < low);
    if (item) eat(ctx, p, item);
    p['doing'] = '';
  }
  // A tamer sits far from the store, so goes back sooner (flock.json `tame.back`, herdtask.ts).
  const taming = p['job'] === content.flock.job && p['task'] === 'tame';
  const seek = taming ? content.flock.tame.back : seekOf(ctx, 'food');
  if (valueOf(ctx, p, 'food') < seek && world.tick >= (p['retry'] as number)) {
    // Seed grain only when under the warning line with nothing else to reach (P4.7).
    if (goEat(ctx, p, false) || (valueOf(ctx, p, 'food') < low && goEat(ctx, p, true))) {
      p['doing'] = 'eat';
      return;
    }
    p['retry'] = world.tick + RETRY;
  }
  const day = hoursOf(world, content, p.id);
  const night = hour >= day.sleepFrom || hour < day.workFrom;
  const rest = valueOf(ctx, p, 'rest');
  // Below its warning line, warmth beats sleep as it beats work (P3.6, V-046; phase review: a
  // room built in a hard winter was slept in cold until its hearth stood).
  if (warming(ctx, p)) return;
  if (p['doing'] === 'sleep') {
    if (night || rest < life.sleep.wake) return;
    p['doing'] = '';
  }
  if (night || rest < seekOf(ctx, 'rest')) {
    goToBed(ctx, p, night);
    return;
  }
  // An open deep arm wound stops work with that hand until it heals (P5.6).
  const hours = hour >= day.workFrom && hour < day.workTo && !armOut(world, content, p.id);
  if (working(ctx, p, hours)) {
    p['doing'] = 'work';
    return;
  }
  if (!hours && tendInEvening(ctx, p)) {
    p['doing'] = 'work';
    return;
  }
  const leisure = hour >= day.workTo || valueOf(ctx, p, 'recreation') < seekOf(ctx, 'recreation');
  p['doing'] = leisure ? 'relax' : '';
  wander(ctx, p);
}

/** The hour of the day now, for everyone's choices this minute. */
export const hourNow = (ctx: SystemContext): number =>
  clockAt(ctx.world.tick, ctx.content.calendar).hour;

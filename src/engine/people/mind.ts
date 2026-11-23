// A person's round (P2.2): each minute they choose what to do from their needs and the hour. In
// order: eat when food is under its `seek` line (waking for it), sleep at night or when tired, on
// their own bed or bedroll if they can get to it, take their leisure in the evening or when bored, and
// otherwise stroll near the camp. What they are doing is the `doing` field, which the needs
// system reads each hour; none of it is a ledger line until a need crosses its warning line.
import { clockAt, type EntityRow } from '../core/index.ts';
import { haveOf, itemsAt, itemsOf } from '../goods/index.ts';
import { armOut } from '../health/index.ts';
import { needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isDark } from '../lamp/index.ts';
import { hoursOf, rationed } from '../law/index.ts';
import { bedOwnedBy, fieldTiles, liveFields } from '../build/index.ts';
import { bankFire } from '../fire/index.ts';
import { reachFrom } from '../paths/index.ts';
import { claimBed } from './claim.ts';
import { carryBed, movesIn } from './home.ts';
import { working } from './jobs.ts';
import { spotOf, cooked, eat, lineOf, walkTo, wander } from '../band/index.ts';
import { danger } from '../care/index.ts';
import { drinking } from './drink.ts';
import { banks, tendInEvening } from '../crafts/index.ts';
import { warming } from './warm.ts';
import { afield } from './afield.ts';
import { gathering, mendByAFire, practising } from './evening.ts';
import { feasting, HARD_STOP } from './feast.ts';
import { holyHours, praying } from '../faith/index.ts';
import { atTheInn, hungOver } from '../inn/index.ts';
import { trying } from '../discover/index.ts';
import { reading, scribing } from '../teach/index.ts';
import { lateUntil, watching } from '../herding/index.ts';
import { pilfer } from '../defy/index.ts';
import { departing, eatStash, extraWork, inStocks, raiding, slacking } from './defy.ts';

export const MIND_FIELDS = {
  /** `eat`, `drink` (drink.ts), `sleep`, `moveBed` (home.ts), `work` (jobs.ts), `warm` (warm.ts), `hurt` (lying
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

/** Food of last resort (seed grain, P4.7) is eaten only when `desperate`: Food at `life.seedAt`,
 * and (Phase 6 Bundle 0) only seed beyond what the colony's fields need to sow: the seed corn is
 * kept back, whoever goes hungry. */
const edible = (ctx: SystemContext, kind: string, desperate: boolean): boolean =>
  ctx.content.life.eat[kind] !== undefined &&
  (!ctx.content.life.lastResort.includes(kind) || (desperate && seedSpare(ctx) > 0));

/** Seed grain in the valley beyond one a tile of every live field. */
const seedSpare = (ctx: SystemContext): number => {
  const { world, content } = ctx;
  const tiles = liveFields(world).reduce((n, f) => n + fieldTiles(f).length, 0);
  return haveOf(world, content, content.buildings.field.seed) - tiles;
};

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
 * none to reach. When the nearest cannot be walked to (a store walled into a pocket), the nearest
 * of what can is tried instead (5B Bundle 3: a band went hungry beside turnips it could reach). */
function goEat(ctx: SystemContext, p: EntityRow, desperate: boolean): boolean {
  const best = nearestFood(ctx, p, desperate, () => true);
  if (!best) return false;
  if (walkTo(ctx, p, spotOf(best))) return true;
  const reach = reachFrom(ctx.content, ctx.world.map, spotOf(p));
  const next = nearestFood(ctx, p, desperate, (i) => reach(spotOf(i)));
  return !!next && walkTo(ctx, p, spotOf(next));
}

/** The nearest food `ok` allows, or a cooked meal up to `work.cook.prefer` tiles further. */
function nearestFood(
  ctx: SystemContext,
  p: EntityRow,
  desperate: boolean,
  ok: (i: EntityRow) => boolean,
): EntityRow | undefined {
  const { x, y, z } = spotOf(p);
  let best: EntityRow | undefined;
  let far = Infinity;
  let meal: EntityRow | undefined;
  let mealFar = Infinity;
  for (const i of itemsOf(ctx.world)) {
    if (i['holder'] || !edible(ctx, i['kind'] as string, desperate) || !ok(i)) continue;
    const d =
      Math.max(Math.abs((i['x'] as number) - x), Math.abs((i['y'] as number) - y)) +
      Math.abs((i['z'] as number) - z) * 100;
    if (d < far) [best, far] = [i, d];
    if (cooked(ctx, i) && d < mealFar) [meal, mealFar] = [i, d];
  }
  return meal && mealFar <= far + ctx.content.work.cook.prefer ? meal : best;
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
  // Under Roaring hearths (6B), those who keep it leave it burning high.
  if (night && banks(ctx.world, ctx.content, p)) bankFire(ctx, p, bed ? spotOf(bed) : spotOf(p));
}

/** One minute of choosing, after the minute's steps. */
export function think(ctx: SystemContext, p: EntityRow, hour: number): void {
  const { world, content } = ctx;
  const life = content.life;
  // Danger comes first (P5.6): lying hurt, carrying the hurt, binding a bleeding wound.
  if (danger(ctx, p)) return;
  // Leaving the valley (P6.7): nothing else until they are gone.
  if (departing(ctx, p)) return;
  const walking = (p['path'] as number[]).length > 0;
  if (p['doing'] === 'moveBed') {
    if (!walking) carryBed(ctx, p);
    return;
  }
  // The harvest-home supper (5B Bundle 4) is the evening's meal: after work, unless starving, it
  // comes before eating alone (even on the way to it), the jobs that run on past work and the
  // evening's leisure.
  // On a feast day (6B) work stops at noon for all who keep the Feasts law.
  const day = holyHours(world, content, p.id, hoursOf(world, content, p.id));
  // Out on a trip with a pack (6W Slice 5): their own round, at camp and on the way.
  if (afield(ctx, p, hour >= day.sleepFrom || hour < day.workFrom)) return;
  // Someone already on their way to it is waited for past bedtime, up to the supper's hard stop.
  const waited = p['doing'] === 'feast' ? HARD_STOP : 0;
  const minute = hour * 60 + (world.tick % 60);
  const evening = hour >= day.workTo && minute < day.sleepFrom * 60 + waited;
  if (evening && valueOf(ctx, p, 'food') > life.seedAt && feasting(ctx, p)) {
    p['doing'] = 'feast';
    return;
  }
  // Out walking to eat alone when the supper is called, they turn for the supper instead (above).
  if (p['doing'] === 'eat') {
    if (walking) return;
    const item = foodHere(ctx, p, valueOf(ctx, p, 'food') <= life.seedAt);
    if (item) {
      eat(ctx, p, item);
      // At the ladder's `take` step they pocket more from the store (P6.7).
      pilfer(ctx, p, item);
    }
    p['doing'] = '';
  }
  // A tamer sits far from the store, so goes back sooner (flock.json `tame.back`, herdtask.ts).
  const taming = p['job'] === content.flock.job && p['task'] === 'tame';
  const seek = taming ? content.flock.tame.back : lineOf(ctx, p, 'food');
  // Keeping the Rations law (P6.5), they eat no more once today's share is eaten.
  const held = rationed(world, content, p);
  // A stash pocketed from the store is eaten first, where they stand (P6.7).
  if (valueOf(ctx, p, 'food') < seek && !held && eatStash(ctx, p)) return;
  if (valueOf(ctx, p, 'food') < seek && !held && world.tick >= (p['retry'] as number)) {
    // Seed grain only when under the warning line with nothing else to reach (P4.7).
    if (goEat(ctx, p, false) || (valueOf(ctx, p, 'food') <= life.seedAt && goEat(ctx, p, true))) {
      p['doing'] = 'eat';
      return;
    }
    p['retry'] = world.tick + RETRY;
  }
  // Thirst next (P5.2): to the nearest water or the well, to drink to full.
  if (drinking(ctx, p)) return;
  const night = hour >= day.sleepFrom || hour < day.workFrom;
  const rest = valueOf(ctx, p, 'rest');
  // Below its warning line, warmth beats sleep as it beats work (P3.6, V-046; phase review: a
  // room built in a hard winter was slept in cold until its hearth stood).
  // The watch fire (Bundle 6): sat up by the fold from dusk to first light, by its warmth.
  if (watching(ctx, p)) return;
  if (warming(ctx, p)) return;
  // After a night's watch they sleep late (`flock.watch.wake`).
  const late = world.tick < lateUntil(ctx, p);
  if (p['doing'] === 'sleep') {
    if (night || late || rest < life.sleep.wake) return;
    p['doing'] = '';
  }
  if (night || late || rest < lineOf(ctx, p, 'rest')) {
    goToBed(ctx, p, night);
    return;
  }
  // An open deep arm wound stops work with that hand until it heals (P5.6).
  // A sentence of extra work keeps them at it to bedtime (P6.7).
  const workTo = extraWork(ctx, p) ? day.sleepFrom : day.workTo;
  const hours = hour >= day.workFrom && hour < workTo && !armOut(world, content, p.id);
  // A day in the stocks is the working day on the green; working slowly idles a minute in a few.
  if (inStocks(ctx, p, hours)) return;
  // Hung over (6B), a minute in a few is lost until noon; a puzzler under Encouraged New Ways
  // spends one in `trying` trying (6C, V-218).
  if (hours && p['doing'] === 'work' && (slacking(ctx, p) || hungOver(ctx, p) || trying(ctx, p)))
    return;
  if (working(ctx, p, hours)) {
    p['doing'] = 'work';
    return;
  }
  if (!hours && tendInEvening(ctx, p)) {
    p['doing'] = 'work';
    return;
  }
  // After dusk, with no work the dark allows, the rest of the working day is free time (P5.13).
  const leisure =
    hour >= day.workTo ||
    isDark(content, world.tick) ||
    valueOf(ctx, p, 'recreation') < lineOf(ctx, p, 'recreation');
  // The tithe barn raided by someone with a grievance against the Lord law, or hungry (6C).
  if ((leisure || p['doing'] === 'raid') && raiding(ctx, p)) return;
  // Prayer at their faith's shrine (6B), now and then, before other leisure.
  if (leisure && praying(ctx, p)) return;
  // The schoolroom (6B Bundle 6): the teacher writing down a master's ways, then reading a book.
  if (leisure && (scribing(ctx, p) || reading(ctx, p))) return;
  // The tavern of an evening (6B Bundle 5), once it stands.
  if (leisure && atTheInn(ctx, p, hour >= day.workTo)) {
    mendByAFire(ctx, p);
    return;
  }
  p['doing'] = leisure ? 'relax' : '';
  // Free time given to an ambition's skill (P6.4, V-146), a minute in every `every`.
  if (leisure) practising(ctx, p);
  // On a winter evening, free time is spent by a lit fire (P6.3, V-162).
  if (leisure && gathering(ctx, p)) return;
  wander(ctx, p);
}

/** The hour of the day now, for everyone's choices this minute. */
export const hourNow = (ctx: SystemContext): number =>
  clockAt(ctx.world.tick, ctx.content.calendar).hour;

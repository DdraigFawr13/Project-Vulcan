// Scouting (6W Slice 4, V-205): nobody is sent (V-041). When what the colony has of wood, stone or
// food plus what it knows of in reach is under its stock level, a free person takes up scouting,
// restless and hardy ones first, and walks out to the edge of the known land where the need looks
// likeliest. What they see counts once they are home and tell of it: a find becomes a place the
// colony works however far off (`workAreas`); a trip with no word waits `wait` days.
import { TICKS_PER_DAY, type EntityRow, type Find } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { haveOf, stockOf, storeOf, wantOf } from '../goods/index.ts';
import { compass, eachKnown, forgetSeen, inAreas, tellSeen, workAreas } from '../map/index.ts';
import { canReach, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, declineIfUnable, levelOf, outranked, people, priorityLine } from '../band/index.ts';
import { spotOf, walkTo } from '../band/index.ts';

type Good = SystemContext['content']['work']['scout']['goods'][number];

/** What the colony is short of: the good, its stock name, and have, known and want. */
export interface Need {
  def: Good;
  name: string;
  have: number;
  known: number;
  want: number;
}

/** The 16 ways out from the store, as whole steps on a square of 4 (no angles, V-006). */
const RAYS: readonly (readonly [number, number])[] = [
  [4, 0], [4, 2], [4, 4], [2, 4], [0, 4], [-2, 4], [-4, 4], [-4, 2],
  [-4, 0], [-4, -2], [-4, -4], [-2, -4], [0, -4], [2, -4], [4, -4], [4, -2],
]; // prettier-ignore

const apart = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Where the store stands (the green before there is one). */
function origin(ctx: SystemContext): [number, number] {
  const first = storeOf(ctx.world)[0];
  const map = ctx.world.map;
  return first ? [first['x'] as number, first['y'] as number] : [map.startX, map.startY];
}

/** Whether surface tile `i` holds a source of `def`'s good, and how much it gives. */
function sourceAt(ctx: SystemContext, def: Good, i: number): number {
  const f = ctx.world.map.features[i]!;
  const feature = f ? ctx.content.features[f - 1] : undefined;
  return feature && def.kinds.includes(feature.kind) ? feature.amount : 0;
}

/** The first of `scout.goods` whose stock plus its known sources within reach (and round finds)
 * is under its stock level; kept for the tick, as everyone asks the same question. */
const NEEDS = new WeakMap<object, { tick: number; need: Need | undefined }>();
export function needOf(ctx: SystemContext): Need | undefined {
  const { world, content } = ctx;
  const kept = NEEDS.get(world);
  if (kept?.tick === world.tick) return kept.need;
  const [ox, oy] = origin(ctx);
  const areas = workAreas(content, world.map, ox, oy, content.work.scout.reach);
  let need: Need | undefined;
  for (const def of content.work.scout.goods) {
    const want = wantOf(world, content, def.good);
    if (want <= 0) continue;
    const have = haveOf(world, content, def.good);
    let known = 0;
    eachKnown(world.map, areas, (i) => (known += sourceAt(ctx, def, i)));
    if (have + known >= want) continue;
    const name = content.work.stock.find((s) => s.good === def.good)?.name ?? def.good;
    need = { def, name, have, known, want };
    break;
  }
  NEEDS.set(world, { tick: world.tick, need });
  return need;
}

/** A tile within 5 of (x, y) they can stand on and get to, nearest first. */
function standable(ctx: SystemContext, p: EntityRow, x: number, y: number): Spot | undefined {
  const map = ctx.world.map;
  for (let r = 0; r <= 5; r += 1)
    for (let yy = y - r; yy <= y + r; yy += 1)
      for (let xx = x - r; xx <= x + r; xx += 1) {
        if (apart(xx, yy, x, y) !== r || xx < 0 || yy < 0) continue;
        if (xx >= map.width || yy >= map.height) continue;
        if (!walkAt(ctx.content, map, 0, yy * map.width + xx)) continue;
        const to = { x: xx, y: yy, z: 0 };
        if (canReach(ctx.content, map, spotOf(p), to)) return to;
      }
  return undefined;
}

/** Known sources of the need within 6 of (x, y): the land beyond looks likelier there. */
function likely(ctx: SystemContext, def: Good, x: number, y: number): number {
  const map = ctx.world.map;
  let n = 0;
  eachKnown(map, [[x, y, 6]], (i) => (n += sourceAt(ctx, def, i) ? 1 : 0));
  return n;
}

/** Where to make for: on each of the 16 ways out, the first unseen tile within `far`; the
 * nearest wins, less 3 tiles for each known source of the need beside it; the spot is a few
 * tiles past it, where they can stand. */
function frontier(ctx: SystemContext, p: EntityRow, need: Need): Spot | undefined {
  const map = ctx.world.map;
  const far = ctx.content.work.scout.far;
  const [ox, oy] = origin(ctx);
  let best: Spot | undefined;
  let score = Infinity;
  for (const [dx, dy] of RAYS)
    for (let d = 1; d <= far; d += 1) {
      const [x, y] = [ox + Math.round((dx * d) / 4), oy + Math.round((dy * d) / 4)];
      if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) break;
      if (map.known[y * map.width + x] === 1) continue;
      const s = d - 3 * likely(ctx, need.def, x, y);
      const on = Math.min(far, d + 6);
      const spot =
        s < score
          ? standable(ctx, p, ox + Math.round((dx * on) / 4), oy + Math.round((dy * on) / 4))
          : undefined;
      if (spot) [best, score] = [spot, s];
      break;
    }
  return best;
}

/** Restless and hardy people go first: `p` without one of `traits` waits while someone free
 * with one, who puts scouting no lower, is able. */
function others(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.scout;
  const keen = (q: EntityRow) =>
    (world.entities['trait'] ?? []).some(
      (t) => t['person'] === q.id && def.traits.includes(t['trait'] as string),
    );
  if (keen(p)) return false;
  const mine = levelOf(world, content, p.id, def.job);
  return people(world).some(
    (q) =>
      q.id !== p.id &&
      q['job'] === '' &&
      q['doing'] !== 'sleep' &&
      q['z'] === 0 &&
      keen(q) &&
      able(content, q, def.job) &&
      levelOf(world, content, q.id, def.job) <= mine,
  );
}

/** Whether a trip is under way; one whose scout is gone (dead, or at other work) is lost, and
 * what they saw with it. */
function underWay(ctx: SystemContext): boolean {
  const map = ctx.world.map;
  const last = map.finds.at(-1);
  if (last?.count !== -1) return false;
  if (people(ctx.world).some((q) => q['job'] === 'scout')) return true;
  lose(ctx, last);
  return false;
}

/** A trip given up away from home: what the scout saw is lost with it, one line. */
function lose(ctx: SystemContext, trip: Find): void {
  const { world, content } = ctx;
  forgetSeen(world.map);
  const who = (world.entities['person'] ?? []).find((q) => q.id === trip.who);
  const good = content.work.stock.find((s) => s.good === trip.good)?.name ?? trip.good;
  const line = ctx.emit('land.lost', {
    causes: [trip.line],
    actors: who ? [who.id] : [],
    data: { name: (who?.['name'] as string) ?? 'The scout', good },
  });
  Object.assign(trip, { count: 0, line, tick: world.tick });
}

/** Takes up scouting when the colony is short of something it knows too little of. */
export function takeUpScouting(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const def = content.work.scout;
  if (spotOf(p).z !== 0 || underWay(ctx)) return false;
  const last = world.map.finds.at(-1);
  const least = content.terrain.generator.known.least;
  if (last && last.count < least && world.tick - last.tick < def.wait * TICKS_PER_DAY) return false;
  const need = needOf(ctx);
  if (!need) return false;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  if (outranked(ctx, p, def.job, () => true) || others(ctx, p)) return false;
  const to = frontier(ctx, p, need);
  if (!to || !walkTo(ctx, p, to)) return false;
  const causes = [stockOf(world, need.def.good)?.['line'], priorityLine(world, p.id, def.job)];
  p['took'] = ctx.emit('work.tookUpScouting', {
    // The stock level that wants it, and the priority that put them to it if the player set one.
    causes: causes.filter((l): l is number => l !== undefined),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      good: need.name,
      have: need.have + need.known,
      want: need.want,
    },
  });
  const trip: Find = {
    ...to,
    good: need.def.good,
    count: -1,
    who: p.id,
    line: p['took'] as number,
    tick: world.tick,
  };
  world.map.finds.push(trip);
  const leg = world.tick + def.leg * TICKS_PER_DAY;
  Object.assign(p, { job: def.job, task: 'out', what: need.def.good, target: -1, work: leg });
  return true;
}

/** A minute of the trip once they are not walking: at the far spot (or a leg's days spent, or
 * no way on) they turn for home; home, they tell what they saw. */
export function scouting(ctx: SystemContext, p: EntityRow): boolean {
  const map = ctx.world.map;
  const trip = map.finds.at(-1);
  if (trip?.count !== -1) return endTrip(p);
  if ((p['path'] as number[]).length) return true;
  const here = spotOf(p);
  const def = ctx.content.work.scout;
  const leg = ctx.world.tick >= (p['work'] as number);
  if (p['task'] === 'out') {
    if (here.z === 0 && apart(here.x, here.y, trip.x, trip.y) > 1 && !leg)
      if (walkTo(ctx, p, { x: trip.x, y: trip.y, z: 0 })) return true;
    // They turn here: the news is of the land round where they got to.
    if (here.z === 0) Object.assign(trip, { x: here.x, y: here.y });
    Object.assign(p, { task: 'home', work: ctx.world.tick + def.leg * TICKS_PER_DAY });
  }
  const green = greenOf(ctx.world);
  if (apart(here.x, here.y, green.x, green.y) <= def.home && here.z === 0) {
    comeHome(ctx, p, trip);
    return endTrip(p);
  }
  // Home within a leg's days, or the trip and what they saw are lost.
  const home = ctx.world.tick < (p['work'] as number) && standable(ctx, p, green.x, green.y);
  if (home && walkTo(ctx, p, home)) return true;
  lose(ctx, trip);
  return endTrip(p);
}

const endTrip = (p: EntityRow): false => {
  Object.assign(p, { job: '', task: '', what: '', target: -1, work: 0, path: [] });
  return false;
};

/** Home: what they saw becomes known; the place round where they turned richest in the need
 * (sources not already in reach) is the news, a find when it holds at least `least`. */
function comeHome(ctx: SystemContext, p: EntityRow, trip: Find): void {
  const { world, content } = ctx;
  const map = world.map;
  const def = content.work.scout.goods.find((g) => g.good === trip.good)!;
  const [ox, oy] = origin(ctx);
  const before = workAreas(content, map, ox, oy, content.work.scout.reach);
  tellSeen(map);
  const r = content.terrain.generator.known.place;
  let best: [number, number, number] = [trip.x, trip.y, 0];
  for (let y = Math.max(0, trip.y - 20); y <= Math.min(map.height - 1, trip.y + 20); y += 4)
    for (let x = Math.max(0, trip.x - 20); x <= Math.min(map.width - 1, trip.x + 20); x += 4) {
      let n = 0;
      eachKnown(map, [[x, y, r]], (i, tx, ty) => {
        if (!inAreas(before, tx, ty)) n += sourceAt(ctx, def, i) ? 1 : 0;
      });
      if (n > best[2]) best = [x, y, n];
    }
  const [x, y, count] = best;
  const name = content.work.stock.find((s) => s.good === trip.good)?.name ?? trip.good;
  const found = count >= content.terrain.generator.known.least;
  const line = ctx.emit(found ? 'land.toldOf' : 'land.noWord', {
    causes: [trip.line],
    actors: [p.id],
    data: found
      ? {
          name: p['name'] as string,
          find: def.find,
          far: apart(x, y, ox, oy),
          dir: compass(x - ox, y - oy),
          count,
          unit: def.unit,
        }
      : { name: p['name'] as string, good: name, days: content.work.scout.wait },
  });
  Object.assign(trip, {
    x: found ? x : trip.x,
    y: found ? y : trip.y,
    count,
    line,
    tick: world.tick,
  });
}

// Scouting (6W Slice 4, V-205): nobody is sent (V-041). When what the colony has of wood, stone or
// food plus what it knows of in reach is under its stock level, a free person takes up scouting,
// restless and hardy ones first, and walks out to the edge of the known land where the need looks
// likeliest. What they see counts once they are home and tell of it: a find becomes a place the
// colony works however far off (`workAreas`); a trip with no word waits `wait` days.
import { TICKS_PER_DAY, type EntityRow, type Find, type WorldState } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { haveOf, stockOf, wantOf } from '../goods/index.ts';
import { compass, eachKnown, forgetSeen, inAreas, tellSeen, workAreas } from '../map/index.ts';
import { canReach, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, declineIfUnable, levelOf, outranked, people, priorityLine } from '../band/index.ts';
import { spotOf, walkTo } from '../band/index.ts';
import { isDown } from '../health/index.ts';
import { personOf } from '../entity/index.ts';
import { apart, kitFor, unpack } from './camp.ts';
import { astray } from './trouble.ts';
import { BEYOND, lastFound, origin, spotPlaces, toldBeyond } from './places.ts';
import { sourceAt, type Good } from './sources.ts';
import type { OreNeed } from './seams.ts';
import { alongWord, spendWord, wordOf } from './word.ts';
import { alongFaces, betterMiner, faceTarget, oreAsNeed, prospectHome } from './prospect.ts';
import { setOutProspecting, walkTrip } from './prospect.ts';

/** What the colony is short of: the good, its stock name, and have, known and want. */
export interface Need {
  def: Good;
  name: string;
  have: number;
  known: number;
  want: number;
  /** A prospecting trip's ore (V-215). */
  ore?: OreNeed;
}

/** The 16 ways out from the store, as whole steps on a square of 4 (no angles, V-006). */
const RAYS: readonly (readonly [number, number])[] = [
  [4, 0], [4, 2], [4, 4], [2, 4], [0, 4], [-2, 4], [-4, 4], [-4, 2],
  [-4, 0], [-4, -2], [-4, -4], [-2, -4], [0, -4], [2, -4], [4, -4], [4, -2],
]; // prettier-ignore

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
  // A newcomer's word of the good pulls the way it names (V-206).
  const word = wordOf(ctx, ctx.content.work.scout.goods.indexOf(need.def));
  let best: Spot | undefined;
  let score = Infinity;
  for (const [dx, dy] of RAYS)
    for (let d = 1; d <= far; d += 1) {
      const [x, y] = [ox + Math.round((dx * d) / 4), oy + Math.round((dy * d) / 4)];
      if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) break;
      if (map.known[y * map.width + x] === 1) continue;
      const lean = word && alongWord(word, dx, dy) ? ctx.content.work.scout.word.lean : 0;
      const s = d - 3 * likely(ctx, need.def, x, y) - lean;
      // To see what lies beyond, they go on `beyond.on` tiles past the edge (V-206).
      const on = Math.min(
        far,
        d + (need.def.good === BEYOND ? ctx.content.work.scout.beyond.on : 6),
      );
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

/** The trip under way, if any: the last one, while its count is -1. */
export const tripOf = (world: WorldState): Find | undefined => {
  const last = world.map.finds.at(-1);
  return last?.count === -1 ? last : undefined;
};

/** Whether a trip is under way (V-206): while its scout lives, at the trip, lying hurt, or
 * otherwise away (they take it up again, for home); home some other way (carried in), they tell
 * what they saw. One whose scout is dead or gone is lost, and what they saw with it. */
export function underWay(ctx: SystemContext): boolean {
  const { world, content } = ctx;
  const trip = tripOf(world);
  if (!trip) return false;
  const s = personOf(world, trip.who);
  if (s?.['status'] !== 'alive') {
    // A searcher still out looking finds the body first (search.ts).
    const q = personOf(world, trip.searcher ?? 0);
    if (s && q?.['status'] === 'alive' && ['search', 'seek'].includes(q['task'] as string))
      return true;
    lose(ctx, trip);
    return false;
  }
  if (s['job'] === content.work.scout.job || isDown(world, s.id)) return true;
  const green = greenOf(world);
  const home =
    apart(s['x'] as number, s['y'] as number, green.x, green.y) <= content.work.scout.home;
  if (home && s['z'] === 0) {
    comeHome(ctx, s, trip);
    return false;
  }
  if (!s['job']) Object.assign(s, { job: content.work.scout.job, task: 'home', path: [] });
  return true;
}

/** A trip given up away from home: what the scout saw is lost with it, one line; a dead scout's
 * pack lies where they are, a living one's is carried home. */
function lose(ctx: SystemContext, trip: Find): void {
  const { world, content } = ctx;
  forgetSeen(world.map);
  const who = personOf(world, trip.who);
  if (who?.['packed']) unpack(ctx, who, who['status'] !== 'alive');
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
  const need = needOf(ctx) ?? oreAsNeed(ctx, ...origin(ctx)) ?? beyond(ctx);
  if (!need) return false;
  if (!able(content, p, def.job)) {
    declineIfUnable(ctx, p, def.job);
    return false;
  }
  // A prospector is the best miner free (V-215); other trips, the restless and hardy first.
  const first = need.ore ? betterMiner(ctx, p) : others(ctx, p);
  return !outranked(ctx, p, def.job, () => true) && !first && goOut(ctx, p, need);
}

/** Sets them out on the trip for `need`, if there is a way to its first spot. */
function goOut(ctx: SystemContext, p: EntityRow, need: Need): boolean {
  const { world } = ctx;
  const def = ctx.content.work.scout;
  const to = need.ore ? faceTarget(ctx, p, need.ore, ...origin(ctx)) : frontier(ctx, p, need);
  if (!to || !walkTo(ctx, p, to)) return false;
  const { due, kit } = kitFor(ctx, p, need.ore ? def.prospect.day : 0);
  p['took'] = need.ore ? setOutProspecting(ctx, p, need.ore, kit) : setOut(ctx, p, need, kit);
  const trip: Find = {
    ...to,
    good: need.def.good,
    count: -1,
    who: p.id,
    line: p['took'] as number,
    tick: world.tick,
    ...{ due, worry: 0, searcher: 0, search: 0, strayed: 0 },
    ...(need.ore && { ore: 1, faces: 0, along: 0 }),
  };
  world.map.finds.push(trip);
  const leg = world.tick + def.leg * TICKS_PER_DAY;
  Object.assign(p, { job: def.job, task: 'out', what: need.def.good, target: -1, work: leg });
  return true;
}

/** With nothing short and no new find for `beyond.days` days, the colony wants to see what lies
 * beyond (V-206): a need with no sources, for the nearest unknown edge. */
function beyond(ctx: SystemContext): Need | undefined {
  const { world, content } = ctx;
  const last = lastFound(ctx);
  if (world.tick - last.tick < content.work.scout.beyond.days * TICKS_PER_DAY) return undefined;
  const def: Good = { good: BEYOND, kinds: [], find: '', unit: '' };
  return { def, name: BEYOND, have: 0, known: 0, want: 0 };
}

/** The setting-out line: the stock level that wants it (or the newest find, or the newcomer's
 * word that points the way), and the priority that put them to it if the player set one. */
function setOut(ctx: SystemContext, p: EntityRow, need: Need, kit: string): number {
  const { world, content } = ctx;
  const job = content.work.scout.job;
  const word = wordOf(ctx, content.work.scout.goods.indexOf(need.def));
  if (word) spendWord(ctx);
  if (need.def.good === BEYOND)
    return ctx.emit('work.tookUpScoutingBeyond', {
      causes: [lastFound(ctx).line || world.begunEvent, priorityLine(world, p.id, job)].filter(
        (l): l is number => l !== undefined && l > 0,
      ),
      actors: [p.id],
      data: { name: p['name'] as string, kit, days: content.work.scout.beyond.days },
    });
  const causes = [
    stockOf(world, need.def.good)?.['line'],
    word?.line,
    priorityLine(world, p.id, job),
  ];
  return ctx.emit('work.tookUpScouting', {
    causes: causes.filter((l): l is number => typeof l === 'number' && l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      good: need.name,
      kit,
      have: need.have + need.known,
      want: need.want,
    },
  });
}

/** A minute of the trip once they are not walking: at the far spot (or a leg's days spent, or
 * no way on) they turn for home; home, they tell what they saw. */
export function scouting(ctx: SystemContext, p: EntityRow): boolean {
  const map = ctx.world.map;
  const trip = map.finds.at(-1);
  if (trip?.count !== -1) return endTrip(p);
  if (trip.ore) walkTrip(ctx, p, trip);
  if ((p['path'] as number[]).length || astray(ctx, p)) return true;
  const here = spotOf(p);
  const def = ctx.content.work.scout;
  if (outward(ctx, p, trip)) return true;
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

/** Out to the far spot, then (a prospector) along the faces; true while still going out. Else they
 * turn here: the news is of the land round where they got to. */
function outward(ctx: SystemContext, p: EntityRow, trip: Find): boolean {
  const here = spotOf(p);
  const leg = ctx.world.tick >= (p['work'] as number);
  if (p['task'] === 'out') {
    if (here.z === 0 && apart(here.x, here.y, trip.x, trip.y) > 1 && !leg)
      if (walkTo(ctx, p, { x: trip.x, y: trip.y, z: 0 })) return true;
    // A prospector walks along the faces from here (V-215).
    p['task'] = trip.ore && !leg && here.z === 0 ? 'along' : 'turn';
  }
  if (p['task'] === 'along' && !leg && alongFaces(ctx, p, trip)) return true;
  if (p['task'] === 'home') return false;
  if (here.z === 0) Object.assign(trip, { x: here.x, y: here.y });
  const back = ctx.world.tick + ctx.content.work.scout.leg * TICKS_PER_DAY;
  Object.assign(p, { task: 'home', work: back });
  return false;
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
  const def = content.work.scout.goods.find((g) => g.good === trip.good);
  const [ox, oy] = origin(ctx);
  const before = workAreas(content, map, ox, oy, content.work.scout.reach);
  tellSeen(map);
  // What they came on out there is found as they tell of it (V-206).
  const finds = spotPlaces(ctx, p, trip.line);
  if (trip.ore) return prospectHome(ctx, p, trip);
  if (!def) return toldBeyond(ctx, p, trip, finds);
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
  // Home, the pack is put down (V-206).
  if (p['packed']) unpack(ctx, p);
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

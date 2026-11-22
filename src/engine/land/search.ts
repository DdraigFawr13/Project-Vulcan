// A scout late home (6W Slice 5, V-206): nobody is sent. A day past the time they meant to be
// home, those close to them (housemates, and those they swap tales with) worry, a line and a
// memory; next morning the colony wants a searcher, and whoever free puts Scouting highest goes
// the way the scout went, packed for the trip. Coming within `late.sight` tiles of the scout they
// go to them: a hurt scout is the searcher's to bind and carry (care `fetchHurt`), a lost one sets
// off home with them, a dead one is left for the burial. Care's after-work search, which walks
// straight to the hurt as if it knew where to look, leaves a scout out on a trip to this.
import {
  TICKS_PER_DAY,
  clockAt,
  list,
  pronouns,
  type EntityRow,
  type Find,
} from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { fetchHurt } from '../care/index.ts';
import { talkersOf } from '../colony/index.ts';
import { personOf } from '../entity/index.ts';
import { homeHouse, isDown, openWounds, stopFor, woundName, worstOf } from '../health/index.ts';
import { compass } from '../map/index.ts';
import { addMemory } from '../needs/index.ts';
import { walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { able, levelOf, people, spotOf, walkTo } from '../band/index.ts';
import { apart, awayFrom, packUp } from './camp.ts';
import { tripOf, underWay } from './scout.ts';

/** The searcher's tasks: going the scout's way, going to them once seen, and home again. */
export const SEARCH_TASKS = ['search', 'seek', 'back'];

/** Each hour: the trip under way is kept (underWay), the late are worried for, and the morning
 * after, the colony wants a searcher. */
export function tripHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % 60 !== 0 || !underWay(ctx)) return;
  const trip = tripOf(world)!;
  const s = personOf(world, trip.who)!;
  const late = content.work.scout.late;
  // Late, and not home: asleep in their own bed they are not missed.
  const away = awayFrom(ctx, s).far > content.work.scout.home;
  if (!trip.worry && trip.due && away && world.tick >= trip.due + late.days * TICKS_PER_DAY)
    return worry(ctx, trip, s);
  const hour = clockAt(world.tick, content.calendar).hour;
  if (trip.worry && !trip.searcher && hour === content.work.hours.from) seekSearcher(ctx, trip, s);
}

/** Those close to the scout worry: one line, a memory each. */
function worry(ctx: SystemContext, trip: Find, s: EntityRow): void {
  const { world, content } = ctx;
  const house = homeHouse(world, content, s);
  const talk = new Set(talkersOf(world, content, s));
  const close = people(world).filter(
    (q) =>
      q.id !== s.id &&
      q['status'] === 'alive' &&
      (talk.has(q.id) || (!!house && homeHouse(world, content, q) === house)),
  );
  const good = content.work.stock.find((g) => g.good === trip.good)?.name ?? trip.good;
  trip.worry = ctx.emit('land.late', {
    causes: [trip.line],
    actors: [s.id, ...close.map((q) => q.id)],
    data: {
      name: s['name'] as string,
      good,
      worried: close.length ? list(close.map((q) => q['name'] as string)) : 'Everyone',
      verb: close.length > 1 ? 'are' : 'is',
    },
  });
  for (const q of close) addMemory(ctx, q.id, content.work.scout.late.memory, trip.worry, s.id);
}

/** The free person who puts Scouting highest (then the lowest id) sets out the scout's way. */
function seekSearcher(ctx: SystemContext, trip: Find, s: EntityRow): void {
  const { world, content } = ctx;
  const def = content.work.scout;
  const g = greenOf(world);
  const q = people(world)
    .filter(
      (r) =>
        r.id !== s.id &&
        r['status'] === 'alive' &&
        r['z'] === 0 &&
        !isDown(world, r.id) &&
        !['carry', 'bind', 'bury', 'feed'].includes(r['job'] as string) &&
        able(content, r, def.job) &&
        apart(r['x'] as number, r['y'] as number, g.x, g.y) <= def.reach,
    )
    .sort(
      (a, b) =>
        levelOf(world, content, a.id, def.job) - levelOf(world, content, b.id, def.job) ||
        a.id - b.id,
    )[0];
  if (!q) return;
  stopFor(ctx, q, false);
  const to = endOf(ctx, trip);
  if (!to || !walkTo(ctx, q, to)) return;
  trip.searcher = q.id;
  packUp(ctx, q, def.pack.most);
  trip.search = ctx.emit('land.searching', {
    causes: [trip.worry!],
    actors: [q.id, s.id],
    data: {
      name: q['name'] as string,
      scout: s['name'] as string,
      dir: compass(trip.x - g.x, trip.y - g.y),
      they: pronouns(s).they,
    },
  });
  Object.assign(q, {
    ...{ job: def.job, task: 'search', target: s.id, what: '', took: trip.search, doing: 'work' },
    work: world.tick + 2 * def.leg * TICKS_PER_DAY,
  });
}

/** Where the scout was making for (or turned): a tile there they can stand on. */
function endOf(ctx: SystemContext, trip: Find): { x: number; y: number; z: number } | undefined {
  const map = ctx.world.map;
  for (let r = 0; r <= 4; r += 1)
    for (let y = trip.y - r; y <= trip.y + r; y += 1)
      for (let x = trip.x - r; x <= trip.x + r; x += 1)
        if (
          x >= 0 &&
          y >= 0 &&
          x < map.width &&
          y < map.height &&
          walkAt(ctx.content, map, 0, y * map.width + x)
        )
          return { x, y, z: 0 };
  return undefined;
}

/** Each minute, walking the scout's way: once the scout is in sight they make for them. */
export function lookFor(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  if (p['task'] !== 'search' && p['task'] !== 'seek') return;
  const s = personOf(world, p['target'] as number);
  if (!s || s['z'] !== p['z']) return;
  const d = apart(s['x'] as number, s['y'] as number, p['x'] as number, p['y'] as number);
  if (d > content.work.scout.late.sight || d <= 1) return;
  // A scout on the move is followed: the way is found again every 10 minutes.
  if (p['task'] === 'seek' && (p['path'] as number[]).length && world.tick % 10) return;
  p['task'] = 'seek';
  walkTo(ctx, p, spotOf(s));
}

/** A minute of the search once they are not walking: beside the scout, they find them; at the
 * end of the scout's way with no sight of them, or the days out, they turn for home; home, the
 * search ends. */
export function searching(ctx: SystemContext, p: EntityRow): boolean {
  const { world } = ctx;
  const s = personOf(world, p['target'] as number);
  const trip = tripOf(world);
  if (p['task'] === 'back' || !s || !trip || trip.who !== s.id)
    return goBack(ctx, p, !!trip && !!s && trip.who === s.id);
  if (
    apart(s['x'] as number, s['y'] as number, p['x'] as number, p['y'] as number) <= 1 &&
    s['z'] === p['z']
  )
    return found(ctx, p, s);
  if (p['task'] === 'seek' && walkTo(ctx, p, spotOf(s))) return true;
  const to = endOf(ctx, trip);
  const there = !to || apart(to.x, to.y, p['x'] as number, p['y'] as number) <= 1;
  if (!there && world.tick < (p['work'] as number) && walkTo(ctx, p, to)) return true;
  p['task'] = 'back';
  return true;
}

/** Home again from the search, or on the way there; `still` while the trip is under way. */
function goBack(ctx: SystemContext, p: EntityRow, still: boolean): boolean {
  const g = greenOf(ctx.world);
  const home = apart(p['x'] as number, p['y'] as number, g.x, g.y) <= ctx.content.work.scout.home;
  if (home || !walkTo(ctx, p, { x: g.x, y: g.y, z: 0 })) return endSearch(ctx, p, still);
  p['task'] = 'back';
  return true;
}

/** Beside the scout: one line, and what comes of it. */
function found(ctx: SystemContext, p: EntityRow, s: EntityRow): boolean {
  const { world, content } = ctx;
  const dead = s['status'] !== 'alive';
  const down = !dead && isDown(world, s.id);
  const w = down ? worstOf(content, openWounds(world, s.id)) : undefined;
  const how = dead
    ? 'dead'
    : w
      ? `lying hurt, with a ${woundName(content, w)}`
      : 'lost but unhurt, and they set off home together';
  const { far, dir } = awayFrom(ctx, s);
  const line = ctx.emit('land.foundScout', {
    causes: [p['took'] as number].filter((l) => l > 0),
    actors: [p.id, s.id],
    data: { name: p['name'] as string, scout: s['name'] as string, far, dir, how },
  });
  p['what'] = 'found';
  if (dead) {
    p['task'] = 'back';
    return true;
  }
  addMemory(ctx, p.id, 'found-lost', line, s.id);
  if (down && fetchHurt(ctx, p, s)) return true;
  p['task'] = 'back';
  if (down) return true;
  Object.assign(s, { astray: 0, task: 'home', path: [] });
  if ((s['work'] as number) < world.tick + content.work.scout.leg * TICKS_PER_DAY)
    s['work'] = world.tick + content.work.scout.leg * TICKS_PER_DAY;
  return true;
}

/** Home from the search: a line when they never found the scout. Their pack is put down by the
 * mind once the job is done. */
function endSearch(ctx: SystemContext, p: EntityRow, still: boolean): false {
  const s = personOf(ctx.world, p['target'] as number);
  if (p['what'] !== 'found' && s && still)
    ctx.emit('land.notFound', {
      causes: [p['took'] as number].filter((l) => l > 0),
      actors: [p.id, s.id],
      data: { name: p['name'] as string, scout: s['name'] as string },
    });
  Object.assign(p, { job: '', task: '', what: '', target: -1, work: 0, path: [] });
  return false;
}

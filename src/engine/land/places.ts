// Finding things (6W Slice 5 part 2, V-206). A find laid on the map (map `places.ts`) is found the
// first time its tile is known: by whoever on the surface is nearest it, or, for land a scout saw,
// by the scout once home and telling of it. Each is a `land.found` line, and so a tale. Curios come
// to anyone far out: each hour more than `curio.far` tiles from the green, 1 in `curio.per`, at
// most one a person a season; a third leave a memory. Rolls draw from the `trips` stream.
import { clockAt, streamFor, type EntityRow, type Place } from '../core/index.ts';
import { isDown } from '../health/index.ts';
import { compass, placeKind } from '../map/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { people } from '../band/index.ts';
import { apart, awayFrom } from './camp.ts';
import { greenOf } from '../build/index.ts';
import { wordHour } from './word.ts';
import { seamHour } from './seams.ts';

/** Every 10 minutes (and when a scout comes home, `scout` with their trip's line): each find
 * whose tile has become known is found. Returns the finds' lines. */
export function spotPlaces(ctx: SystemContext, scout?: EntityRow, trip = 0): number[] {
  const { world } = ctx;
  if (!scout && world.tick % 10 !== 0) return [];
  const map = world.map;
  const lines: number[] = [];
  for (const place of map.places) {
    if (place.line || map.known[place.y * map.width + place.x] !== 1) continue;
    const by = scout ?? nearest(ctx, place);
    lines.push(found(ctx, place, by, scout ? trip : 0));
  }
  return lines;
}

/** The living person on the surface nearest `place`. */
function nearest(ctx: SystemContext, place: Place): EntityRow | undefined {
  let best: EntityRow | undefined;
  let d = Infinity;
  for (const p of people(ctx.world)) {
    if (p['status'] !== 'alive' || p['z'] !== 0) continue;
    const e = apart(p['x'] as number, p['y'] as number, place.x, place.y);
    if (e < d) [best, d] = [p, e];
  }
  return best;
}

/** One find: its line (citing what the finder was about), and who and when. */
function found(ctx: SystemContext, place: Place, p: EntityRow | undefined, trip: number): number {
  const { world, content } = ctx;
  const def = content.work.scout.places;
  const kind = placeKind(content, place.kind)!;
  const g = greenOf(world);
  const magic = world.map.auraSpots.some(
    (s) => s.z === 0 && apart(s.x, s.y, place.x, place.y) <= def.magic,
  );
  const cause = trip || ((p?.['took'] as number) ?? 0);
  const line = ctx.emit('land.found', {
    causes: cause > 0 ? [cause] : [],
    actors: p ? [p.id] : [],
    data: {
      name: (p?.['name'] as string) ?? 'Someone',
      what: kind.name,
      far: apart(place.x, place.y, g.x, g.y),
      dir: compass(place.x - g.x, place.y - g.y),
      magic: magic ? def.magicWords : '',
      then: kind.then,
      sort: kind.tale,
    },
  });
  Object.assign(place, { by: p?.id ?? 0, line, tick: world.tick });
  return line;
}

/** The newest find, its tick and line: a place found, a scout's find, or a trip to see what lies
 * beyond; tick and line 0 if none. */
export function lastFound(ctx: SystemContext): { tick: number; line: number } {
  const map = ctx.world.map;
  const least = ctx.content.terrain.generator.known.least;
  let last = { tick: 0, line: 0 };
  for (const p of map.places)
    if (p.line && p.tick >= last.tick) last = { tick: p.tick, line: p.line };
  for (const f of map.finds)
    if ((f.count >= least || f.good === BEYOND) && f.tick >= last.tick)
      last = { tick: f.tick, line: f.line };
  return last;
}

/** The good a trip to see what lies beyond goes for. */
export const BEYOND = 'beyond';

/** Each hour: anyone far out may come on a curio, once a season. */
export function curioHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (world.tick % 60 !== 0) return;
  const def = content.work.scout.curio;
  const clock = clockAt(world.tick, content.calendar);
  const season = clock.year * 100 + clock.season + 1;
  const state = (world.systems['curio'] ??= {});
  for (const p of people(world)) {
    if (p['status'] !== 'alive' || p['z'] !== 0 || isDown(world, p.id)) continue;
    if (state[`p${p.id}`] === season) continue;
    const { far, dir } = awayFrom(ctx, p);
    if (far <= def.far || streamFor(world, 'trips').int(def.per) !== 0) continue;
    state[`p${p.id}`] = season;
    // One of the least found so far.
    const counts = def.list.map((_, j) => state[`c${j}`] ?? 0);
    const least = Math.min(...counts);
    const k = streamFor(world, 'trips').pick(counts.flatMap((n, j) => (n === least ? [j] : [])));
    state[`c${k}`] = (state[`c${k}`] ?? 0) + 1;
    const curio = def.list[k]!;
    const line = ctx.emit('land.curio', {
      causes: [(p['took'] as number) ?? 0].filter((l) => l > 0),
      actors: [p.id],
      data: { name: p['name'] as string, what: curio.what, far, dir, curio: curio.id },
    });
    if (curio.memory) addMemory(ctx, p.id, curio.memory, line);
  }
}

/** Each minute (V-206): finds seen are found, the far out may come on a curio, a newcomer tells
 * of their road in, and anyone beside a rock face may spot a seam in it (V-215). */
export function findsMinute(ctx: SystemContext): void {
  spotPlaces(ctx);
  curioHour(ctx);
  wordHour(ctx);
  seamHour(ctx);
}

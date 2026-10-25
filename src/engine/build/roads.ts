// Roads (P5.10, V-054, V-120): the Build sheet's Roads row. Once a day, while no stretch is
// planned and the store holds the stone for one, the colony looks at the ways between the places
// it uses (the green, each home's door, each field, the pasture, the smithy, the burial ground),
// takes the way with the most footfall not yet under road, and plans its most worn run of tiles
// in a row (`buildings.roads`), each worn to `least` or more. The line names the two places and
// how often the stretch is walked. Builders lay the road parts like floors; when all stand,
// `build.roadLaid`. There is no Send back: a road only follows feet (Morgan, 2026-10-25), and
// the row at 4 holds road work behind every other plan (people/build.ts).
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import { depotsOf, haveOf, inStore, onDepot } from '../goods/index.ts';
import { walksADay } from '../map/index.ts';
import { findPath, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import type { Schemas } from '../entity/index.ts';
import { burialGround } from './burial.ts';
import { liveFields, tilesOf } from './fields.ts';
import { whoseOf } from './homes.ts';
import { groundOf, housesOf } from './site.ts';
import { ROAD_KIND, sizeOf, wantOf } from './houses.ts';
import { livePastures, onPastureGround } from './pasturerows.ts';
import { partOf, planAt, planPart, plansOf, stillNeeded } from './plans.ts';
import { smithiesOf } from './smithy.ts';

export const ROAD_TABLES: Schemas = {
  /** A stretch of road. `from` and `to` name the places of the way it lies on; `tiles` its tile
   * indices in order along the way; `walks` about how many times a day it was walked when
   * chosen. `state`: `plan` until every tile's part stands, then `built`; or `next`, the day's
   * pick while the store lacks its stone (at most one, for the Build sheet; nothing is planned).
   * `line` planned it, `laid` said it was done. */
  road: {
    from: 'text',
    to: 'text',
    tiles: 'ints',
    walks: 'count',
    state: 'text',
    line: 'event',
    laid: 'event',
  },
};

export const roadsOf = (world: WorldState): EntityRow[] => world.entities['road'] ?? [];

/** The stretch of road (planned or laid) that surface tile `i` belongs to, if any. */
export const roadAt = (world: WorldState, i: number): EntityRow | undefined =>
  roadsOf(world).find((r) => r['state'] !== 'next' && (r['tiles'] as number[]).includes(i));

/** The stretch the colony would lay next once the store holds its stone, if it has found one. */
export const nextRoad = (world: WorldState): EntityRow | undefined =>
  roadsOf(world).find((r) => r['state'] === 'next');

interface Place {
  name: string;
  at: Spot;
}

const spotOf = (world: WorldState, i: number): Spot => ({
  x: i % world.map.width,
  y: Math.floor(i / world.map.width),
  z: 0,
});

/** A home's name for a line: "the hall", "Gwallog's house", or "the cottage". */
function homeName(world: WorldState, content: EngineContent, h: EntityRow): string {
  if (h['hall']) return 'the hall';
  if (h['owner']) return `${whoseOf(world, [h['owner'] as number])} house`;
  return `the ${sizeOf(content, h).name}`;
}

/** The places roads run between, the green first, at most `roads.places` of them. */
export function placesOf(world: WorldState, content: EngineContent, green: Spot): Place[] {
  const out: Place[] = [{ name: 'the green', at: green }];
  for (const h of housesOf(world))
    if (h['state'] === 'built' && !h['of'])
      out.push({ name: homeName(world, content, h), at: spotOf(world, h['door'] as number) });
  for (const f of liveFields(world)) {
    const tiles = tilesOf(f);
    if (tiles.length)
      out.push({ name: 'the field', at: spotOf(world, tiles[Math.floor(tiles.length / 2)]!) });
  }
  for (const p of livePastures(world))
    if (p['state'] === 'built')
      out.push({ name: 'the pasture', at: spotOf(world, p['gate'] as number) });
  for (const s of smithiesOf(world))
    if (s['state'] === 'built') {
      const [x, y] = [s['x'] as number, s['y'] as number];
      const [w, h] = [s['w'] as number, s['h'] as number];
      out.push({ name: 'the smithy', at: { x: x + (w >> 1), y: y + (h >> 1), z: 0 } });
    }
  const burial = burialGround(world);
  if (burial) {
    const [x, y] = [burial['x'] as number, burial['y'] as number];
    const [w, h] = [burial['w'] as number, burial['h'] as number];
    out.push({ name: 'the burial ground', at: { x: x + (w >> 1), y: y + (h >> 1), z: 0 } });
  }
  return out.slice(0, content.buildings.roads.places);
}

/** Whether surface tile `i` could take a road now: open, buildable dry ground with nothing on
 * or planned on it, off fields, pastures, the store and granaries, worn to `least`. `taken` is
 * siting's view (site.ts `groundOf`): stations, the campfire, burial grounds and the midden. */
function roadable(
  ctx: SystemContext,
  fields: Set<number>,
  taken: ReadonlySet<number>,
  i: number,
): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const kind = content.terrain.kinds[map.tiles[i]!]!;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  return (
    map.wear[i]! >= content.buildings.roads.least &&
    !!kind.buildable &&
    !kind.water &&
    !map.built[i] &&
    !map.features[i] &&
    !fields.has(i) &&
    !taken.has(i) &&
    !planAt(world, x, y) &&
    !inStore(world, x, y, 0) &&
    !depotsOf(world).some((d) => onDepot(d, x, y)) &&
    !livePastures(world).some((p) => onPastureGround(p, map.width, x, y))
  );
}

interface Pick {
  from: string;
  to: string;
  tiles: number[];
  total: number;
}

/** The way with the most wear not yet under road, and its most worn run of tiles in a row. */
function choose(ctx: SystemContext, green: Spot): Pick | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const dial = content.buildings.roads;
  const fields = new Set(liveFields(world).flatMap(tilesOf));
  const taken = groundOf(world).taken;
  const places = placesOf(world, content, green);
  const ok = new Map<number, boolean>();
  const fits = (i: number): boolean => {
    if (!ok.has(i)) ok.set(i, roadable(ctx, fields, taken, i));
    return ok.get(i)!;
  };
  let best: Pick | undefined;
  for (let a = 0; a < places.length; a += 1)
    for (let b = a + 1; b < places.length; b += 1) {
      const way = findPath(content, map, places[a]!.at, places[b]!.at);
      if (!way) continue;
      const tiles = way.filter((n) => n < map.width * map.height);
      let total = 0;
      let run: number[] = [];
      let top: number[] = [];
      let topWear = 0;
      for (const i of tiles) {
        if (!fits(i)) {
          run = [];
          continue;
        }
        total += map.wear[i]!;
        run.push(i);
        if (run.length > dial.stretch) run.shift();
        const sum = run.reduce((s, j) => s + map.wear[j]!, 0);
        if (sum > topWear) [topWear, top] = [sum, [...run]];
      }
      if (top.length < dial.shortest || (best && total <= best.total)) continue;
      best = { from: places[a]!.name, to: places[b]!.name, tiles: top, total };
    }
  return best;
}

/** Hourly: once a day, while no road is planned, finds the next stretch; plans it when no other
 * plan waits and the store holds its stone spare, else keeps it as the `next` row for the Build
 * sheet. */
export function planRoads(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  if (roadsOf(world).some((r) => r['state'] === 'plan')) return;
  if (state['roadTried'] && world.tick - state['roadTried'] < TICKS_PER_DAY) return;
  state['roadTried'] = world.tick;
  const dial = content.buildings.roads;
  const part = partOf(content, dial.part)!;
  const old = nextRoad(world);
  if (old) removeEntity(world, 'road', old.id);
  const pick = choose(ctx, green);
  if (!pick) return;
  const map = world.map;
  const walks = walksADay(
    content,
    pick.tiles.reduce((s, i) => s + map.wear[i]!, 0) / pick.tiles.length,
  );
  // Roads take only spare stone: what other plans still need of it is kept for them, and while
  // any other plan waits the stretch is only noted (people/build.ts ranks road work last too).
  const others = plansOf(world).filter((p) => p['state'] === 'plan' && p['part'] !== part.id);
  const kept = others
    .filter((p) => planPart(content, p).material === part.material)
    .reduce((n, p) => n + stillNeeded(content, p), 0);
  const spare = haveOf(world, content, part.material) - kept;
  if (others.length || spare < part.cost * pick.tiles.length) {
    addEntity(world, 'road', {
      ...{ from: pick.from, to: pick.to, tiles: pick.tiles, walks },
      ...{ state: 'next', line: 0, laid: 0 },
    });
    return;
  }
  const set = wantOf(world, content, ROAD_KIND).line;
  const line = ctx.emit('build.roadPlanned', {
    causes: set ? [set] : [],
    data: { from: pick.from, to: pick.to, tiles: pick.tiles.length, walks },
  });
  addEntity(world, 'road', {
    ...{ from: pick.from, to: pick.to, tiles: pick.tiles, walks },
    ...{ state: 'plan', line, laid: 0 },
  });
  for (const i of pick.tiles)
    addEntity(world, 'plan', {
      ...{ part: part.id, x: i % map.width, y: Math.floor(i / map.width), z: 0 },
      ...{ have: 0, also: 0, work: -1, state: 'plan' },
      ...{ line, done: 0, waited: 0, shut: 0, held: 0, house: 0 },
    });
}

/** Hourly: a planned stretch whose every tile has its road is laid. */
export function finishRoads(ctx: SystemContext): void {
  const { world, content } = ctx;
  const part = content.buildings.parts.findIndex((p) => p.id === content.buildings.roads.part);
  for (const r of roadsOf(world)) {
    if (r['state'] !== 'plan') continue;
    const tiles = r['tiles'] as number[];
    if (!tiles.every((i) => world.map.built[i] === part + 1)) continue;
    r['state'] = 'built';
    r['laid'] = ctx.emit('build.roadLaid', {
      causes: [r['line'] as number],
      data: { from: r['from'] as string, to: r['to'] as string, tiles: tiles.length },
    });
  }
}

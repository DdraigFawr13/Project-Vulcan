// A house finished and a house that grows (P3.7, P3.8, V-052). Each hour a planned house or
// room whose every part stands is built, with one line. A built house whose sleepers outnumber
// the beds it has room for adds a room (content `house.stage`) on its flattest side, walled in
// the house's own material (V-097); its plans wait if that cannot be had.
import { TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bedsOf, crowdedIn, mainOf, nthOf, placeHouse, rowsOf, sizeOf } from './houses.ts';
import { partOf, plansOf } from './plans.ts';
import { roomAt } from './rooms.ts';
import { isTreeAt, wayFrom, wayTo } from './way.ts';
import {
  housesOf,
  inRect,
  outsideOf,
  groundOf,
  rectOf,
  scoreRect,
  type Rect,
  type Site,
} from './site.ts';

const COUNTS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

/** Planned houses and rooms whose parts all stand are built. */
export function finishHouses(ctx: SystemContext): void {
  const { world, content } = ctx;
  for (const h of housesOf(world)) {
    if (h['state'] !== 'plan') continue;
    const plans = plansOf(world).filter((p) => p['house'] === h.id);
    if (!plans.length || plans.some((p) => p['state'] !== 'built')) continue;
    const last = Math.max(...plans.map((p) => p['done'] as number));
    const main = mainOf(world, h);
    const r = rectOf(h);
    const room = roomAt(world, content, r.x + 1, r.y + 1);
    h['state'] = 'built';
    if (h['of']) {
      h['built'] = ctx.emit('build.roomAdded', {
        causes: [last],
        data: { size: sizeOf(content, main).name, tiles: room?.tiles.length ?? 0 },
      });
      continue;
    }
    const rooms = rowsOf(world, main).filter((o) => o['state'] === 'built').length;
    h['built'] = ctx.emit('build.houseBuilt', {
      causes: [last],
      data: {
        size: sizeOf(content, h).name,
        rooms: `${COUNTS[rooms] ?? rooms} room${rooms > 1 ? 's' : ''}`,
        tiles: room?.tiles.length ?? 0,
      },
    });
  }
}

const SIDES = ['north', 'east', 'south', 'west'] as const;

/** The footprint of a room added on one side of a house, sharing the house's wall, and its door
 * in the middle of the far side. */
function stageRect(
  house: Rect,
  side: (typeof SIDES)[number],
  w: number,
  h: number,
): { r: Rect; door: Spot } {
  const x = house.x + Math.floor((house.w - w) / 2);
  const y = house.y + Math.floor((house.h - h) / 2);
  const mid = (a: number, n: number) => a + Math.floor(n / 2);
  if (side === 'north') {
    const r = { x, y: house.y - h + 1, w, h };
    return { r, door: { x: mid(r.x, w), y: r.y, z: 0 } };
  }
  if (side === 'south') {
    const r = { x, y: house.y + house.h - 1, w, h };
    return { r, door: { x: mid(r.x, w), y: r.y + h - 1, z: 0 } };
  }
  if (side === 'east') {
    const r = { x: house.x + house.w - 1, y, w, h };
    return { r, door: { x: r.x + w - 1, y: mid(r.y, h), z: 0 } };
  }
  const r = { x: house.x - w + 1, y, w, h };
  return { r, door: { x: r.x, y: mid(r.y, h), z: 0 } };
}

/** Where a house would add its next room: the flattest free side (ties north, east, south, west)
 * that does not hold its door and whose way in can be reached from the green (felling trees on
 * the way if need be). */
export function stageSite(
  ctx: SystemContext,
  main: EntityRow,
  green: Spot,
): (Site & { side: string }) | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const stage = content.buildings.house.stage;
  const rows = rowsOf(world, main);
  const own = new Set(rows.map((h) => h.id));
  const home = rectOf(main);
  const door = main['door'] as number;
  const [dx, dy] = [door % map.width, Math.floor(door / map.width)];
  let best: (Site & { side: string }) | undefined;
  const ground = groundOf(world);
  for (const side of SIDES) {
    const { r, door: d } = stageRect(home, side, stage.w, stage.h);
    const holdsDoor =
      inRect(r, dx, dy) ||
      rows.some((o) => o.id !== main.id && rectOf(o).x === r.x && rectOf(o).y === r.y);
    if (holdsDoor) continue;
    const s = scoreRect(world, content, r, own, ground);
    if (!s || (best && s.rise >= best.rise)) continue;
    // Its way in from the green goes round the room itself, felling trees if need be.
    const way = wayFrom(world, content, green, r);
    const out = outsideOf(r, d);
    if (way.trees[out.y * map.width + out.x]! < 0) continue;
    const tiles = wayTo(way, out.y * map.width + out.x);
    const extra = tiles.filter((i) => isTreeAt(world, content, i) && !s.trees.includes(i));
    best = { ...r, rise: s.rise, trees: [...s.trees, ...extra], far: 0, door: d, side };
  }
  return best;
}

/** Whether built house row `h` is a room nobody sleeps in yet. */
function emptyRoom(ctx: SystemContext, h: EntityRow): boolean {
  if (h['state'] !== 'built' || h['sick']) return false;
  const r = rectOf(h);
  return roomAt(ctx.world, ctx.content, r.x + 1, r.y + 1)?.sleepers === 0;
}

/** Each built house with more sleepers than room, or with a crowded sleeper (above), and no room planned, adds one: walls of
 * the house's own wall material (the plans wait for it). True when a built
 * house has a room planned or ground to add one, so homeless sleepers wait for it rather than
 * for another house. */
export function growHouses(ctx: SystemContext, green: Spot, sent = 0, only?: number): boolean {
  const { world, content } = ctx;
  let growing = false;
  for (const main of housesOf(world)) {
    if (main['of'] || main['state'] !== 'built' || (only && main.id !== only)) continue;
    // A home (P5.14) is sized for its household and does not grow.
    if (main['owner']) continue;
    const rows = rowsOf(world, main);
    if (rows.some((h) => h['state'] === 'plan')) {
      growing = true;
      continue;
    }
    const { sleepers, room } = bedsOf(world, content, main);
    // Short of beds, or someone crowded (privacy under its line) with no empty room to move to,
    // while the house has fewer rooms than `house.private` (phase review).
    const short = sleepers > room;
    if (!short && rows.filter((o) => !o['sick']).length >= content.buildings.house.private)
      continue;
    // A house that could not add a room looks again the next day, not every hour; one with
    // nobody short of a bed looks for someone crowded once a day too.
    if (!only && world.tick < (main['tried'] as number) + TICKS_PER_DAY) {
      if (short) growing ||= !main['full'];
      continue;
    }
    main['tried'] = world.tick;
    const crowded = short ? undefined : crowdedIn(world, main)[0];
    if (!short && (!crowded || rows.some((h) => emptyRoom(ctx, h)))) continue;
    const site = stageSite(ctx, main, green);
    if (!site) {
      // Say once why no room is coming: the player sees the crowding stay (V-078).
      if (!main['full'])
        ctx.emit('build.growBlocked', {
          causes: [main['built'] as number, crowded?.line ?? 0].filter((l) => l > 0),
          actors: crowded ? [crowded.p.id] : [],
          data: {
            size: sizeOf(content, main).name,
            for: crowded ? `${crowded.p['name']} wants a room of their own` : 'someone needs a bed',
          },
        });
      main['full'] = 1;
      continue;
    }
    main['full'] = 0;
    growing = true;
    const inHouse = (x: number, y: number) => rows.some((h) => inRect(rectOf(h), x, y));
    // One house, one material (V-097): the room is walled as the house is, and its plans wait
    // for that material if it cannot be had.
    const wall = partOf(content, main['wall'] as string)!;
    const stage = content.buildings.house.stage;
    const size = sizeOf(content, main).name;
    const line = crowded
      ? ctx.emit('build.growsPrivate', {
          causes: [main['built'] as number, crowded.line].filter((l) => l > 0),
          actors: [crowded.p.id],
          data: {
            name: crowded.p['name'] as string,
            size,
            nth: nthOf(rows.length),
            side: site.side,
          },
        })
      : ctx.emit('build.grows', {
          causes: [main['built'] as number, ...[main['moved'] as number].filter((l) => l > 0)],
          data: { sleepers, size, room, nth: nthOf(rows.length), side: site.side },
        });
    placeHouse(ctx, site, stage, wall, line, {
      why: `the flattest side of the ${sizeOf(content, main).name}: ${site.rise} m of rise`,
      of: main.id,
      sent,
      skip: inHouse,
    });
  }
  return growing;
}

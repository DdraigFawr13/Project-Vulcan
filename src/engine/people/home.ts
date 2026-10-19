// Moving in (P3.7; an assumption Morgan signed off with the mock-up): once a house stands, anyone
// whose bedroll lies out under the sky carries it in at bedtime and lays it on a free floor
// inside, then sleeps there; someone in a crowded room moves to a room added to the house that
// has space (P3.8). One line each, citing the house built. Claiming beds properly
// comes with furniture and ownership (P3.4, P3.5).
import type { EntityRow } from '../core/index.ts';
import { bedSpot, homeOf, houseAt, mainOf, roomAt } from '../build/index.ts';
import { itemsOf } from '../goods/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { same, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

const ownBed = (ctx: SystemContext, p: EntityRow, held: boolean): EntityRow | undefined =>
  itemsOf(ctx.world).find(
    (i) =>
      i['owner'] === p.id &&
      i['kind'] === ctx.content.life.cart.bedroll &&
      (held ? i['holder'] === p.id : !i['holder'] && i['state'] === 'laid'),
  );

/** The tiles others are carrying their bedrolls to, and those others. */
const movers = (ctx: SystemContext, p: EntityRow) =>
  (ctx.world.entities['person'] ?? []).filter((q) => q.id !== p.id && (q['bedTo'] as number) > 0);

/** At bedtime: sets off to carry their bedroll into a house when it lies outside one and a
 * house has a free floor, or out of a crowded room that others leaving would not uncrowd; false
 * when they sleep where it is. */
export function movesIn(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const bed = ownBed(ctx, p, false);
  if (!bed || bed['z'] !== 0) return false;
  const home = homeOf(world, content, bed);
  const others = movers(ctx, p);
  if (home) {
    const room = roomAt(world, content, bed['x'] as number, bed['y'] as number);
    if (!room) return false;
    const leaving = others.filter((q) => {
      const b = ownBed(ctx, q, false);
      return b && room.tiles.includes((b['y'] as number) * world.map.width + (b['x'] as number));
    }).length;
    if ((room.beds - leaving) * content.buildings.rooms.crowd.tiles <= room.tiles.length)
      return false;
  }
  const reserved = others.map((q) => (q['bedTo'] as number) - 1);
  const spot = bedSpot(world, content, home && spotOf(bed), reserved);
  if (!spot || !canReach(content, world.map, spotOf(bed), spot)) return false;
  if (!same(spotOf(bed), spotOf(p)) && !walkTo(ctx, p, spotOf(bed))) return false;
  p['doing'] = 'moveBed';
  p['bedTo'] = spot.y * world.map.width + spot.x + 1;
  return true;
}

/** Lays the bedroll they carry where they stand and goes to sleep on it. */
function layDown(ctx: SystemContext, p: EntityRow, bed: EntityRow): void {
  const { world, content } = ctx;
  const was = houseAt(world, bed['x'] as number, bed['y'] as number);
  Object.assign(bed, { ...spotOf(p), holder: 0, state: 'laid' });
  const h = houseAt(world, p['x'] as number, p['y'] as number);
  const home = h && homeOf(world, content, bed) ? mainOf(world, h) : undefined;
  const name = content.buildings.house.sizes.find((s) => s.id === home?.['size'])?.name ?? '';
  if (home && h !== was)
    home['moved'] = ctx.emit('people.movedIn', {
      causes: [home['built'] as number],
      actors: [p.id],
      data: {
        name: p['name'] as string,
        // Out of a crowded room into one added to the house, or in from the open.
        size: was && h!['of'] ? `${name}'s new room` : name,
      },
    });
  p['doing'] = 'sleep';
  p['bedTo'] = 0;
  p['path'] = [];
}

/** One minute of moving in, once they have stopped walking: pick the bedroll up, carry it to the
 * first free floor in a house, and lay it down there (or where they stand if none is left). */
export function carryBed(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const held = ownBed(ctx, p, true);
  if (!held) {
    const bed = ownBed(ctx, p, false);
    if (!bed || !same(spotOf(bed), spotOf(p))) {
      p['doing'] = '';
      p['bedTo'] = 0;
      return;
    }
    Object.assign(bed, { holder: p.id, state: '' });
    return carryBed(ctx, p);
  }
  // The tile they set off for, unless something now lies there; else another that will do
  // (where it came from, as a carried bedroll keeps its last tile, says which).
  const width = world.map.width;
  const to = (p['bedTo'] as number) - 1;
  const free = (i: number) =>
    !itemsOf(world).some(
      (it) =>
        !it['holder'] && it['z'] === 0 && (it['y'] as number) * width + (it['x'] as number) === i,
    );
  const was = houseAt(world, held['x'] as number, held['y'] as number);
  const spot =
    to >= 0 && free(to)
      ? { x: to % width, y: Math.floor(to / width), z: 0 }
      : bedSpot(
          world,
          content,
          was && spotOf(held),
          movers(ctx, p).map((q) => (q['bedTo'] as number) - 1),
        );
  if (spot) p['bedTo'] = spot.y * width + spot.x + 1;
  if (spot && !same(spot, spotOf(p)) && walkTo(ctx, p, spot)) return;
  layDown(ctx, p, held);
}

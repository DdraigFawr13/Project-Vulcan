// Carrying (P2.4): anyone free carries what lies outside the stores into the nearest that takes
// it, onto a matching stack; the home store grows when a load finds no room. Once a store of a
// kind stands (5B Bundle 1), its kind's stacks in the home store are carried over to it. Each load
// picked up off the ground is a trip gathered there (goods/trips.ts). Split out of jobs.ts.
import type { EntityRow } from '../core/index.ts';
import {
  depotAt,
  depotsFor,
  storeKindOf,
  depotSlot,
  growSpot,
  growStore,
  inHomeStore,
  inStore,
  itemsAt,
  itemsOf,
  layItem,
  mergeTrails,
  noteTrip,
  slotFor,
  storedEnough,
  takeFrom,
  trailOf,
  trailText,
} from '../goods/index.ts';
import { middensOf, planTiles, roomAt, roomsOf } from '../build/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { busy, layAround, same, spotOf } from './spots.ts';
import { tallyAdd } from './tally.ts';
import { walkTo } from './walk.ts';

/** The tick before which they do not look for work again after finding none. */
export const LOOK_AGAIN = 30;

/** Work that keeps what it fetched when the working day ends, instead of carrying it back. */
export const HOLDS = ['station', 'charcoal', 'smelt', 'smith'];

/** Carrying: to the nearest store that takes what they hold; the home store grows when the load
 * finds no room. A good the stores already hold their plate of goes only to a store of its kind
 * (goods/plates.ts). */
export function deliver(ctx: SystemContext, p: EntityRow, load: EntityRow): void {
  const { world, content } = ctx;
  const kind = load['kind'] as string;
  const count = load['count'] as number;
  const here = spotOf(p);
  const made = load['made'] as number;
  if (content.work.haul.midden.includes(kind)) return deliverWaste(ctx, p, load, here);
  // Past its plate a good goes only to a store of its kind, once one stands; till then (a cleared
  // site's logs) to the home store as before. Carried out of a room, it goes wherever there is room.
  const own = storedEnough(world, content)(load) && depotsFor(world, content, kind).length > 0;
  const home = () => slotFor(world, content, kind, count, here) ?? growStore(ctx, made);
  const slot = own
    ? (depotSlot(world, content, kind, count, here) ?? (indoors(ctx, here) ? home() : undefined))
    : home();
  if (!slot && aside(ctx, p, load, here)) return;
  if (!slot) {
    // Nowhere to put it: set it down here and look for work again later.
    Object.assign(load, { ...here, holder: 0 });
    p['next'] = world.tick + LOOK_AGAIN;
    p['job'] = '';
    return;
  }
  if (!same(slot, here)) {
    if (!walkTo(ctx, p, slot)) {
      Object.assign(load, { ...here, holder: 0 });
      p['job'] = '';
    }
    return;
  }
  tallyAdd(ctx, 'hauled', count);
  const stack = itemsAt(world, here.x, here.y, here.z).find((i) => i['kind'] === kind);
  if (stack) {
    stack['count'] = (stack['count'] as number) + count;
    // The stack keeps where both lots came from.
    const trails = [trailOf(stack), trailOf(load)];
    stack['trail'] = trailText(mergeTrails(trails, content.metal.trail.most));
    takeFrom(world, load, count);
  } else Object.assign(load, { ...here, holder: 0 });
  p['job'] = '';
}

/** Waste (offal) goes to the midden, where it is used up with no line (P5.4a, V-072). */
function deliverWaste(ctx: SystemContext, p: EntityRow, load: EntityRow, here: Spot): void {
  const { world } = ctx;
  const midden = middensOf(world)[0];
  const at = midden && { x: midden.x, y: midden.y, z: 0 };
  if (at && same(at, here)) {
    takeFrom(world, load, load['count'] as number);
    p['job'] = '';
    return;
  }
  if (at && walkTo(ctx, p, at)) return;
  Object.assign(load, { ...here, holder: 0 });
  p['job'] = '';
  p['next'] = world.tick + LOOK_AGAIN;
}

/** Whether a spot is on a house room's floor: nothing is left lying there (a hearth's tile). */
const indoors = (ctx: SystemContext, at: Spot): boolean =>
  at.z === 0 && !!roomAt(ctx.world, ctx.content, at.x, at.y);

/** In a store of another kind (true), of its own kind (false), or in none (undefined). */
function astray(ctx: SystemContext, kind: string, at: Spot): boolean | undefined {
  const d = depotAt(ctx.world, at.x, at.y, at.z);
  return d && d['store'] !== storeKindOf(ctx.content, kind)?.id;
}

/** Goods lying where a house or room is planned (build/clearing.ts), or in a store of another
 * kind, that no store has room for are set down on the nearest free tile outside every plan and
 * store; true when all of it was. */
function aside(ctx: SystemContext, p: EntityRow, load: EntityRow, here: Spot): boolean {
  if (here.z !== 0) return false;
  const planned = planTiles(ctx.world).has(here.y * ctx.world.map.width + here.x);
  if (!planned && !astray(ctx, load['kind'] as string, here)) return false;
  const count = load['count'] as number;
  const laid = layAround(
    ctx,
    load['kind'] as string,
    count,
    here,
    load['made'] as number,
    load['trail'] as string,
  );
  if (!laid) return false;
  takeFrom(ctx.world, load, laid);
  p['job'] = '';
  return laid === count;
}

/** Picks up what lies on their tile: all of it, or a load. */
export function pickUp(ctx: SystemContext, p: EntityRow, item: EntityRow): void {
  const load = ctx.content.work.haul.load;
  const count = item['count'] as number;
  const [x, y, z] = [item['x'] as number, item['y'] as number, item['z'] as number];
  if (z === 0 && !inStore(ctx.world, x, y, z)) noteTrip(ctx.world, item['kind'] as string, x, y, 0);
  if (count <= load) {
    item['holder'] = p.id;
    return;
  }
  takeFrom(ctx.world, item, load);
  const id = layItem(
    ctx.world,
    {
      kind: item['kind'] as string,
      count: load,
      ...spotOf(p),
      made: item['made'] as number,
    },
    { trail: item['trail'] as string },
  );
  const carried = itemsOf(ctx.world).find((i) => i.id === id)!;
  carried['holder'] = p.id;
}

/** Something that should be carried to a store, nearest them: lying outside the stores, or in the
 * home store when a store of its kind has room for it. */
function chooseLoad(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const kinds = content.work.haul.kinds;
  const waste = content.work.haul.midden;
  const midden = middensOf(world)[0];
  const taken = busy(world, p, 'haul');
  const from = spotOf(p);
  let best: EntityRow | undefined;
  let far = Infinity;
  // A load the full store has no room for, and cannot grow for, stays where it lies; carrying
  // it would only set it down again (seen on a forest seed once a house's site was cleared).
  // Worked out only for a load that would be nearest, once per kind and size.
  let grows: boolean | undefined;
  const fits = new Map<string, boolean>();
  const room = (i: EntityRow) => {
    grows ??= growSpot(world, content) !== undefined;
    if (grows) return true;
    const key = `${i['kind']}:${i['count']}`;
    if (!fits.has(key))
      fits.set(key, !!slotFor(world, content, i['kind'] as string, i['count'] as number, from));
    return fits.get(key)!;
  };
  // Goods in the home store are carried over to a store of their kind with room for the load.
  const slots = new Map<string, boolean>();
  const keeps = (i: EntityRow) => {
    const key = `${i['kind']}:${i['count']}`;
    if (!slots.has(key))
      slots.set(
        key,
        depotSlot(world, content, i['kind'] as string, i['count'] as number, from) !== undefined,
      );
    return slots.get(key)!;
  };
  const enough = storedEnough(world, content);
  // Past its plate a good lying on a room's floor (a carpenter's spare logs) is carried out all the
  // same: it would take the hearth's tile (furniture.test). Food by the hearth stays to be eaten.
  let floors: Set<number> | undefined;
  const cluttered = (i: EntityRow, at: Spot) => {
    if (at.z !== 0 || content.life.eat[i['kind'] as string] !== undefined) return false;
    floors ??= new Set(roomsOf(world, content).flatMap((r) => r.room.tiles));
    return floors.has(at.y * world.map.width + at.x);
  };
  // Goods on a planned house's tiles are carried off whatever the Stock level (clearing.ts).
  const clearing = planTiles(world);
  for (const i of itemsOf(world)) {
    // Kept with the cart (the band's candles) stays there.
    if (i['holder'] || taken.has(i.id) || i['state'] === 'kept') continue;
    const at = spotOf(i);
    const marked = at.z === 0 && clearing.has(at.y * world.map.width + at.x);
    // Offal is carried to the midden and nowhere else; a midden sited, and not already on it.
    const dirt = waste.includes(i['kind'] as string);
    if (dirt && (!midden || (at.x === midden.x && at.y === midden.y))) continue;
    if (!marked && !dirt && !kinds.includes(i['kind'] as string)) continue;
    const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y));
    if (d >= far) continue;
    // In a store of its kind it stays; in another's (logs of the site's own trees) it goes out.
    const stray = astray(ctx, i['kind'] as string, at);
    if (stray === false) continue;
    // In the home store: only to be carried over to a store of its kind. Past its plate, a good
    // lies where it was made (LESSONS: carried, a surplus kept the band hauling all year).
    if (inHomeStore(world, at.x, at.y, at.z)) {
      if (!keeps(i)) continue;
    } else if (!marked && !dirt && !stray && (enough(i) ? !cluttered(i, at) : !room(i))) continue;
    if (canReach(content, world.map, from, at)) [best, far] = [i, d];
  }
  return best;
}

/** Carrying the nearest load to a store. */
export function takeUpHauling(ctx: SystemContext, p: EntityRow): boolean {
  const item = chooseLoad(ctx, p);
  if (!item || !walkTo(ctx, p, spotOf(item))) return false;
  p['job'] = 'haul';
  p['target'] = item.id;
  return true;
}

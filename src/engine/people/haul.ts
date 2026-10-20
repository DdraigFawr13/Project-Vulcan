// Carrying (P2.4): anyone free carries what lies outside the store into it, onto a matching stack;
// the store grows when a load finds no room. Split out of jobs.ts, which calls it.
import type { EntityRow } from '../core/index.ts';
import {
  granaryGrowSpot,
  granaryOf,
  granarySlot,
  growGranary,
  growSpot,
  growStore,
  inGranary,
  inStore,
  itemsAt,
  itemsOf,
  keepable,
  layItem,
  mergeTrails,
  slotFor,
  storedEnough,
  takeFrom,
  trailOf,
  trailText,
} from '../goods/index.ts';
import { middensOf, planTiles } from '../build/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { busy, layAround, same, spotOf } from './spots.ts';
import { tallyAdd } from './tally.ts';
import { walkTo } from './walk.ts';

/** The tick before which they do not look for work again after finding none. */
export const LOOK_AGAIN = 30;

/** Carrying: to the store with what they hold; the store grows when the load finds no room. Food
 * and seed the store already holds enough of go to a granary instead (goods/granary.ts). */
export function deliver(ctx: SystemContext, p: EntityRow, load: EntityRow): void {
  const { world, content } = ctx;
  const kind = load['kind'] as string;
  const count = load['count'] as number;
  const here = spotOf(p);
  const made = load['made'] as number;
  if (content.work.haul.midden.includes(kind)) return deliverWaste(ctx, p, load, here);
  const slot =
    keepable(content, kind) && granaryOf(world).length && storedEnough(world, content)(load)
      ? (granarySlot(world, content, kind, count, here) ?? growGranary(ctx, here, made))
      : (slotFor(world, content, kind, count, here) ?? growStore(ctx, made));
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

/** Goods lying where a house or room is planned (build/clearing.ts) that the store has no room
 * for are set down on the nearest free tile outside every plan; true when all of it was. */
function aside(ctx: SystemContext, p: EntityRow, load: EntityRow, here: Spot): boolean {
  if (here.z !== 0 || !planTiles(ctx.world).has(here.y * ctx.world.map.width + here.x))
    return false;
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

/** Something lying outside the store that should be carried in, nearest them. */
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
  // Food and seed the store holds enough of go to a granary: a slot there, or room to grow.
  let growable: boolean | undefined;
  const keeps = (i: EntityRow) => {
    if (!keepable(content, i['kind'] as string) || !granaryOf(world).length) return false;
    if (inGranary(world, i['x'] as number, i['y'] as number, i['z'] as number)) return false;
    growable ??= granaryGrowSpot(world, content, from) !== undefined;
    return (
      growable ||
      granarySlot(world, content, i['kind'] as string, i['count'] as number, from) !== undefined
    );
  };
  const enough = storedEnough(world, content);
  // Goods on a planned house's tiles are carried off whatever the Stock level (clearing.ts).
  const clearing = planTiles(world);
  for (const i of itemsOf(world)) {
    if (i['holder'] || taken.has(i.id)) continue;
    const at = spotOf(i);
    const marked = at.z === 0 && clearing.has(at.y * world.map.width + at.x);
    // Offal is carried to the midden and nowhere else; a midden sited, and not already on it.
    const dirt = waste.includes(i['kind'] as string);
    if (dirt && (!midden || (at.x === midden.x && at.y === midden.y))) continue;
    if (!marked && !dirt && !kinds.includes(i['kind'] as string)) continue;
    const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y));
    if (d >= far || inStore(world, at.x, at.y, at.z)) continue;
    if (!marked && !dirt && (enough(i) ? !keeps(i) : !room(i))) continue;
    if (canReach(content, world.map, from, at)) [best, far] = [i, d];
  }
  return best;
}

/** Carrying the nearest load lying outside the store. */
export function takeUpHauling(ctx: SystemContext, p: EntityRow): boolean {
  const item = chooseLoad(ctx, p);
  if (!item || !walkTo(ctx, p, spotOf(item))) return false;
  p['job'] = 'haul';
  p['target'] = item.id;
  return true;
}

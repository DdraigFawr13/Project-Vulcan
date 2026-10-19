// Carrying (P2.4): anyone free carries what lies outside the store into it, onto a matching stack;
// the store grows when a load finds no room. Split out of jobs.ts, which calls it.
import type { EntityRow } from '../core/index.ts';
import {
  growSpot,
  growStore,
  inStore,
  itemsAt,
  itemsOf,
  layItem,
  mergeTrails,
  slotFor,
  stackSize,
  takeFrom,
  trailOf,
  trailText,
  wantOf,
} from '../goods/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { busy, same, spotOf } from './spots.ts';
import { tallyAdd } from './tally.ts';
import { walkTo } from './walk.ts';

/** The tick before which they do not look for work again after finding none. */
export const LOOK_AGAIN = 30;

/** Carrying: to the store with what they hold; the store grows when the load finds no room. */
export function deliver(ctx: SystemContext, p: EntityRow, load: EntityRow): void {
  const { world, content } = ctx;
  const kind = load['kind'] as string;
  const count = load['count'] as number;
  const here = spotOf(p);
  const slot = slotFor(world, content, kind, count, here) ?? growStore(ctx, load['made'] as number);
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

/** Whether the store already holds what a Stock plate asks of this item's kind (at least a
 * stack): then the rest stays where it lies until it is used or wanted, so the logs of a cleared
 * house site cannot fill the store (seen on anvil: 760 logs, no room left for ore). Builders
 * fetch from where it lies. A kind counts towards its own plate, else its good's (grain and
 * turnips are food: a harvest of 3,000 grain filled the store 225 days a year on every seed, the
 * Phase 4 review). Kinds with no plate of either are always carried. */
function storedEnough(ctx: SystemContext): (i: EntityRow) => boolean {
  const { world, content } = ctx;
  const good = new Map(content.items.map((d) => [d.id, d.good]));
  const plated = (kind: string): string | undefined => {
    if (content.work.stock.some((s) => s.good === kind)) return kind;
    const g = good.get(kind);
    return g && content.work.stock.some((s) => s.good === g) ? g : undefined;
  };
  const stored = new Map<string, number>();
  for (const i of itemsOf(world)) {
    if (i['holder'] || !inStore(world, i['x'] as number, i['y'] as number, i['z'] as number))
      continue;
    const plate = plated(i['kind'] as string);
    if (plate) stored.set(plate, (stored.get(plate) ?? 0) + (i['count'] as number));
  }
  return (i) => {
    const kind = i['kind'] as string;
    const plate = plated(kind);
    if (!plate) return false;
    const keep = Math.max(wantOf(world, content, plate), stackSize(content, kind));
    return (stored.get(plate) ?? 0) >= keep;
  };
}

/** Something lying outside the store that should be carried in, nearest them. */
function chooseLoad(ctx: SystemContext, p: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const kinds = content.work.haul.kinds;
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
  const enough = storedEnough(ctx);
  for (const i of itemsOf(world)) {
    if (i['holder'] || !kinds.includes(i['kind'] as string) || taken.has(i.id)) continue;
    const at = spotOf(i);
    const d = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y));
    if (d >= far || inStore(world, at.x, at.y, at.z) || enough(i) || !room(i)) continue;
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

// The people's side of defiance (P6.7, V-160; engine defy decides, this acts): working slowly
// idles one work minute in `slow.every`; someone held back by nothing eats their stash first;
// a sentence of the stocks keeps them on the green through the working day, and one of extra
// work keeps them working to bedtime; someone leaving walks out by their home's road and, once
// off the map, is gone with their clothes, bedroll and stash; tools and loads are left behind.
import type { EntityRow } from '../core/index.ts';
import { leavingOf, sentenceOf, slacks, stashOf, takesWith } from '../defy/index.ts';
import { greenOf } from '../build/index.ts';
import { itemsOf } from '../goods/index.ts';
import { removeEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { edgeSpot, toGreen } from './edge.ts';
import { eat } from './eat.ts';
import { walkTo } from './walk.ts';

/** A minute idled at work by someone working slowly. */
export const slacking = (ctx: SystemContext, p: EntityRow): boolean =>
  slacks(ctx.world, ctx.content, p.id);

/** Hungry and free to eat: their pocketed stash first, where they stand. */
export function eatStash(ctx: SystemContext, p: EntityRow): boolean {
  const stash = stashOf(ctx.world, p.id);
  if (!stash) return false;
  eat(ctx, p, stash);
  return true;
}

/** Whether `p` works on to bedtime today (a sentence of extra work). */
export const extraWork = (ctx: SystemContext, p: EntityRow): boolean =>
  !!sentenceOf(ctx.world, p.id, 'work');

/** In working hours on a day in the stocks: to the green and stay there. */
export function inStocks(ctx: SystemContext, p: EntityRow, hours: boolean): boolean {
  if (!hours || !sentenceOf(ctx.world, p.id, 'stocks')) return false;
  p['doing'] = 'stocks';
  const g = greenOf(ctx.world);
  const near = Math.max(Math.abs((p['x'] as number) - g.x), Math.abs((p['y'] as number) - g.y));
  if ((p['path'] as number[]).length === 0 && (near > 1 || p['z'] !== 0)) toGreen(ctx, p);
  return true;
}

/** Someone leaving walks to the edge on their home's side; there (or with no way) they are gone
 * with what they own and carry. True while they are leaving. */
export function departing(ctx: SystemContext, p: EntityRow): boolean {
  if (!leavingOf(ctx.world, p.id)) return false;
  p['doing'] = 'leave';
  if ((p['path'] as number[]).length) return true;
  const edge = edgeSpot(ctx.world, ctx.content, (p['homeDir'] as string) || 'south');
  const there = edge && p['x'] === edge.x && p['y'] === edge.y && p['z'] === edge.z;
  if (edge && !there && walkTo(ctx, p, edge)) return true;
  for (const i of [...itemsOf(ctx.world)]) {
    if (takesWith(ctx.content, i, p.id)) removeEntity(ctx.world, 'item', i.id);
    else if (i['holder'] === p.id || i['owner'] === p.id)
      Object.assign(i, { holder: 0, owner: 0, x: p['x'], y: p['y'], z: p['z'] });
  }
  p['status'] = 'gone';
  return true;
}

// Carrying the lord's share to the tithe barn (6C Slice 2, V-222). The lord system says how much of
// each kind is due (goods `tithe` rows, from the Lord law and the lord's temper) and, under a
// Defiant law, who wants the lord paid and so may carry their own share (`by`). A hauler free to
// carry takes that first: the nearest stack of the kind lying free (the store's first), picks up
// what is due as a load marked `tithe`, and carries it into the barn, where it stops being an item.
// Nobody is sent (V-041): it is hauling like any other, taken up by whoever is free.
import type { EntityRow } from '../core/index.ts';
import { barnSpot } from '../build/index.ts';
import {
  dropTithe,
  inStore,
  itemsOf,
  layItem,
  takeFrom,
  titheRow,
  titheRows,
} from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { busy, same, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** A load carried for the lord. */
export const TITHE = 'tithe';

const free = (i: EntityRow): boolean =>
  !i['holder'] && !i['state'] && (i['x'] as number) >= 0 && (i['count'] as number) > 0;

const cheb = (a: Spot, b: Spot) =>
  a.z === b.z ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : 999;

/** Taking up the lord's share: with the barn standing and some due that `p` may carry, the
 * nearest free stack of it (in a store first) they can reach. */
export function takeUpTithe(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (!barnSpot(world)) return false;
  const rows = titheRows(world).filter(
    (r) =>
      (r['due'] as number) > 0 &&
      !(r['going'] as number[]).length &&
      (!(r['by'] as number[]).length || (r['by'] as number[]).includes(p.id)),
  );
  if (!rows.length) return false;
  const kinds = new Set(rows.map((r) => r['kind'] as string));
  const taken = busy(world, p, 'haul');
  const from = spotOf(p);
  let best: EntityRow | undefined;
  let far = Infinity;
  for (const i of itemsOf(world)) {
    if (!kinds.has(i['kind'] as string) || !free(i) || taken.has(i.id)) continue;
    const at = spotOf(i);
    const d = cheb(at, from) + (inStore(world, at.x, at.y, at.z) ? 0 : 1000);
    if (d >= far || !canReach(content, world.map, from, at)) continue;
    [best, far] = [i, d];
  }
  if (!best || !walkTo(ctx, p, spotOf(best))) return false;
  titheRow(world, best['kind'] as string)!['going'] = [p.id];
  p['job'] = 'haul';
  p['target'] = best.id;
  return true;
}

/** Stood on the stack they came for the lord's share of: they pick up what is due as a `tithe`
 * load. False when they did not come for the tithe. */
export function tithePickUp(ctx: SystemContext, p: EntityRow, item: EntityRow): boolean {
  const { world, content } = ctx;
  const row = titheRow(world, item['kind'] as string);
  if (!row || !(row['going'] as number[]).includes(p.id)) return false;
  row['going'] = [];
  const n = Math.min(row['due'] as number, item['count'] as number, content.work.haul.load);
  if (n <= 0) return false;
  takeFrom(world, item, n);
  const id = layItem(
    world,
    { kind: item['kind'] as string, count: n, ...spotOf(p), made: item['made'] as number },
    { trail: item['trail'] as string, state: TITHE },
  );
  itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  row['due'] = (row['due'] as number) - n;
  row['set'] = (row['set'] as number) + n;
  return true;
}

/** A minute carrying a `tithe` load: to the barn, then into it, with a line once the kind's share
 * is all in, or (under a Defiant law) one for whoever carried their own share. True while it is
 * theirs to see to; false when the load went back to the colony (deliver it as any other). */
export function deliverTithe(ctx: SystemContext, p: EntityRow, load: EntityRow): boolean {
  const { world, content } = ctx;
  const at = barnSpot(world);
  if (!at) {
    dropTithe(ctx.world, load);
    return false;
  }
  if (!same(spotOf(p), at)) {
    if (walkTo(ctx, p, at)) return true;
    dropTithe(ctx.world, load);
    return false;
  }
  const kind = load['kind'] as string;
  const n = load['count'] as number;
  const row = titheRow(world, kind)!;
  row['barn'] = (row['barn'] as number) + n;
  takeFrom(world, load, n);
  p['job'] = '';
  const what = (content.items.find((d) => d.id === kind)?.name ?? kind).toLowerCase();
  const causes = (row['lines'] as number[]).slice(-1);
  if ((row['by'] as number[]).length)
    ctx.emit('lord.carried', {
      causes,
      actors: [p.id],
      data: { name: p['name'] as string, what },
    });
  else if (!(row['due'] as number))
    ctx.emit('lord.barned', { causes, data: { what, count: row['set'] as number } });
  return true;
}

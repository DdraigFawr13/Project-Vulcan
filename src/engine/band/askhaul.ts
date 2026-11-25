// Carrying what an ask wants to the tithe barn (6C Slice 3, V-225). A taken-up ask is work at the
// colony's priority for it (crafts askwork.ts); for goods it is carrying: the nearest free stack
// that fits (the store's first), picked up as a load marked `ask` and carried into the barn, where
// it is set apart on the ask and stops being an item. Nobody is sent (V-041).
import type { EntityRow } from '../core/index.ts';
import { barnSpot } from '../build/index.ts';
import { fitsAsk, inStore, itemsOf, layItem, setApart, stillWanted } from '../goods/index.ts';
import { takeFrom } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { busy, same, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';
import { free } from './tithehaul.ts';

/** A load carried for an ask. */
export const ASK = 'ask';

const apart = (a: Spot, b: Spot) =>
  a.z === b.z ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : 999;

const askOf = (ctx: SystemContext, p: EntityRow): EntityRow | undefined =>
  (ctx.world.entities['ask'] ?? []).find((a) => a.id === p['ask'] && a['state'] === 'taken');

/** The nearest free item `p` can reach that ask `a` wants (in a store first), if any. */
export function askItem(ctx: SystemContext, p: EntityRow, a: EntityRow): EntityRow | undefined {
  const { world, content } = ctx;
  const taken = busy(world, p, 'haul');
  const from = spotOf(p);
  let best: EntityRow | undefined;
  let far = Infinity;
  for (const i of itemsOf(world)) {
    if (!free(i) || taken.has(i.id) || !fitsAsk(content, a, i)) continue;
    const at = spotOf(i);
    const d = apart(at, from) + (inStore(world, at.x, at.y, at.z) ? 0 : 1000);
    if (d >= far || !canReach(content, world.map, from, at)) continue;
    [best, far] = [i, d];
  }
  return best;
}

/** Taking up carrying for ask `a`: with the barn standing, nobody else on the way and something
 * that fits lying free, they walk to it. */
export function takeUpAskHaul(ctx: SystemContext, p: EntityRow, a: EntityRow): boolean {
  if (!barnSpot(ctx.world) || (a['going'] as number[]).length || !stillWanted(a)) return false;
  const item = askItem(ctx, p, a);
  if (!item || !walkTo(ctx, p, spotOf(item))) return false;
  a['going'] = [p.id];
  Object.assign(p, { job: 'haul', target: item.id, ask: a.id });
  return true;
}

/** Stood on the stack they came for an ask's sake: they pick up what it still wants as an `ask`
 * load. False when they did not come for an ask. */
export function askPickUp(ctx: SystemContext, p: EntityRow, item: EntityRow): boolean {
  const a = askOf(ctx, p);
  if (!a || !(a['going'] as number[]).includes(p.id)) return false;
  const n = Math.min(stillWanted(a), item['count'] as number, ctx.content.work.haul.load);
  if (n <= 0 || !fitsAsk(ctx.content, a, item)) return false;
  takeFrom(ctx.world, item, n);
  const id = layItem(
    ctx.world,
    { kind: item['kind'] as string, count: n, ...spotOf(p), made: item['made'] as number },
    { trail: item['trail'] as string, state: ASK },
  );
  itemsOf(ctx.world).find((i) => i.id === id)!['holder'] = p.id;
  return true;
}

/** A minute carrying an `ask` load: to the barn, then into it, set apart on the ask; a line once
 * the ask has all it wants. True while it is theirs to see to; false when the load went back to
 * the colony (deliver it as any other). */
export function deliverAsk(ctx: SystemContext, p: EntityRow, load: EntityRow): boolean {
  const { world } = ctx;
  const a = askOf(ctx, p);
  const at = barnSpot(world);
  const back = () => {
    load['state'] = '';
    if (a) a['going'] = [];
    p['ask'] = 0;
    return false;
  };
  if (!a || !at) return back();
  if (!same(spotOf(p), at)) return walkTo(ctx, p, at) || back();
  setApart(a, load['kind'] as string, load['count'] as number);
  takeFrom(world, load, load['count'] as number);
  a['going'] = [];
  Object.assign(p, { job: '', ask: 0 });
  if (!stillWanted(a))
    ctx.emit('ask.ready', {
      causes: [a['line'] as number, a['answer'] as number].filter((l) => l > 0),
      actors: [p.id],
      data: { what: a['what'] as string, asker: a['asker'] as string },
    });
  return true;
}

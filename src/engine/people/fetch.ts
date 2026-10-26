// Fetching by kind (Phase 4 Bundle 3): charcoal burning and smelting carry several kinds, a few
// of each, from wherever they lie. A person holds what they fetched (`holder`), so it still
// counts as the colony's (goods `haveOf`) and goes back to the store if the work is dropped.
import type { EntityRow } from '../core/index.ts';
import { itemsOf, layItem, takeFrom } from '../goods/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { busy, same, spotOf } from './spots.ts';
import { walkTo } from './walk.ts';

/** How many of `kind` `p` holds (not the cloak they wear). */
export const heldOf = (ctx: SystemContext, p: EntityRow, kind: string): number =>
  itemsOf(ctx.world)
    .filter((i) => i['holder'] === p.id && i['kind'] === kind && i['state'] !== 'worn')
    .reduce((n, i) => n + (i['count'] as number), 0);

/** The free stacks of `kind` `p` can reach, nearest first (ties by id) and not taken by another's job. */
function stacksOf(
  ctx: SystemContext,
  p: EntityRow,
  kind: string,
  only: (i: EntityRow) => boolean = () => true,
): EntityRow[] {
  const { world, content } = ctx;
  const jobs = ['charcoal', 'smelt', 'smith', 'cure', 'cooper', 'potter'];
  const taken = new Set(jobs.flatMap((j) => [...busy(world, p, j)]));
  const from = spotOf(p);
  const far = (i: EntityRow) =>
    Math.max(Math.abs((i['x'] as number) - from.x), Math.abs((i['y'] as number) - from.y));
  return itemsOf(world)
    .filter((i) => i['kind'] === kind && !i['holder'] && !taken.has(i.id) && only(i))
    .filter((i) => canReach(content, world.map, from, spotOf(i)))
    .sort((a, b) => far(a) - far(b) || a.id - b.id);
}

/** How many of `kind` `p` could fetch now. */
export const reachableOf = (
  ctx: SystemContext,
  p: EntityRow,
  kind: string,
  only?: (i: EntityRow) => boolean,
): number =>
  heldOf(ctx, p, kind) +
  stacksOf(ctx, p, kind, only).reduce((n, i) => n + (i['count'] as number), 0);

/** One minute of fetching until `p` holds `need` of `kind`: `done` when they do, `walking` while
 * on the way to a stack or just having taken from one, `none` when no more can be reached.
 * `only` limits the stacks to those it accepts (the curer takes from the stores only). */
export function fetchKind(
  ctx: SystemContext,
  p: EntityRow,
  kind: string,
  need: number,
  only?: (i: EntityRow) => boolean,
): 'done' | 'walking' | 'none' {
  const { world } = ctx;
  const left = need - heldOf(ctx, p, kind);
  if (left <= 0) return 'done';
  const stack =
    itemsOf(world).find((i) => i.id === p['target'] && i['kind'] === kind && !i['holder']) ??
    stacksOf(ctx, p, kind, only)[0];
  if (!stack) return 'none';
  p['target'] = stack.id;
  if (!same(spotOf(stack), spotOf(p))) return walkTo(ctx, p, spotOf(stack)) ? 'walking' : 'none';
  const count = Math.min(left, stack['count'] as number);
  if (count === stack['count']) stack['holder'] = p.id;
  else {
    takeFrom(world, stack, count);
    const id = layItem(
      world,
      { kind, count, ...spotOf(p), made: stack['made'] as number },
      { trail: stack['trail'] as string },
    );
    itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
  }
  p['target'] = -1;
  return 'walking';
}

/** Takes `count` of `kind` from what `p` holds; the items that go, for their trails. */
export function useHeld(
  ctx: SystemContext,
  p: EntityRow,
  kind: string,
  count: number,
): EntityRow[] {
  const used: EntityRow[] = [];
  let left = count;
  for (const i of itemsOf(ctx.world).filter((i) => i['holder'] === p.id && i['kind'] === kind)) {
    if (left <= 0) break;
    used.push({ ...i } as EntityRow);
    left -= takeFrom(ctx.world, i, left);
  }
  return used;
}

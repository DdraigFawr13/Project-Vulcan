// Poaching (6C Slice 2, V-222): the lord's forest (goods `inForest`) is his. Woodcutters and
// hunters keep out of it unless they have a reason the Lord law cannot hold: hunger, or a
// grievance against the law at the `take` step, with the memory and belief behind it (as from the
// barn, acts.ts `takeWhy`). Felling or hunting there is a line citing the deed and the reasons;
// whoever sees it is kept (a `poach` row) for the reeve's next visit (engine lord).
import type { EntityRow } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { inForest } from '../goods/index.ts';
import { seenBy } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { takeWhy } from './acts.ts';
import { whyWords } from './why.ts';

/** Whether `p` would work in the lord's forest: hungry, or set against the Lord law. */
export const poaches = (ctx: SystemContext, p: EntityRow): boolean =>
  !!takeWhy(ctx, p, ctx.content.lord.tithe.law);

/** Whether `p` keeps out of surface tile (x, y): it is the lord's forest and they would not
 * poach. `may` is asked at most once, the first time the forest is met. */
export function keepsOut(ctx: SystemContext, p: EntityRow): (x: number, y: number) => boolean {
  let may: boolean | undefined;
  return (x, y) => {
    if (!inForest(ctx.world, ctx.content, x, y)) return false;
    may ??= poaches(ctx, p);
    return !may;
  };
}

/** `p` did `deed` ("felled an oak", "went after the deer") in the lord's forest at (x, y), on
 * line `by`: the poaching line, citing it and their reasons, and who saw it. */
export function poached(
  ctx: SystemContext,
  p: EntityRow,
  at: { x: number; y: number },
  deed: string,
  by: number,
): void {
  const { world, content } = ctx;
  if (!inForest(world, content, at.x, at.y)) return;
  const reason = takeWhy(ctx, p, content.lord.tithe.law);
  const line = ctx.emit('defy.poached', {
    causes: [by, ...(reason?.cites ?? [])].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      deed,
      why: reason ? whyWords(world, content, reason.why) : 'no reason they would give',
    },
  });
  const saw = seenBy(world, content, p).map((q) => q.id);
  addEntity(world, 'poach', { person: p.id, deed, line, saw });
}

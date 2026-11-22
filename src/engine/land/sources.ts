// What a scout looks for (6W Slice 4, V-205): the sources of a scouted good on a surface tile.
import type { SystemContext } from '../sim/index.ts';

/** One of `work.scout.goods`: the good, the feature kinds that give it, and its words. */
export type Good = SystemContext['content']['work']['scout']['goods'][number];

/** Whether surface tile `i` holds a source of `def`'s good, and how much it gives. */
export function sourceAt(ctx: SystemContext, def: Good, i: number): number {
  const f = ctx.world.map.features[i]!;
  const feature = f ? ctx.content.features[f - 1] : undefined;
  return feature && def.kinds.includes(feature.kind) ? feature.amount : 0;
}

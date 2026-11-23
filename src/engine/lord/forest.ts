// The lord's forest (6C Slice 2, V-222): when the lord is named, the find of kind `forest.place`
// (an old wood) farthest from the green is his, with every tile within `forest.reach` of it
// (goods `inForest`). Felling and hunting there is poaching (engine defy). High favour grants it.
import { greenOf } from '../build/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lordRow } from './tables.ts';

export function markForest(ctx: SystemContext): void {
  const { world, content } = ctx;
  const lord = lordRow(world);
  if (!lord) return;
  const g = greenOf(world);
  let far = -1;
  for (const p of world.map.places) {
    if (p.kind !== content.lord.forest.place) continue;
    const d = Math.max(Math.abs(p.x - g.x), Math.abs(p.y - g.y));
    if (d > far) [far, lord['fx'], lord['fy']] = [d, p.x, p.y];
  }
}

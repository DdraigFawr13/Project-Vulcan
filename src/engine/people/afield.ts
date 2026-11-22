// A person out on a trip with a pack (6W Slice 5, V-206): they eat from the pack, drink where
// they are, warm themselves at a small fire of the wood about, sleep at camp, and otherwise go on
// with the trip at any hour; the troubles of the way are rolled as they walk. Back home with the
// job done, the pack is put down (land `unpack`).
import type { EntityRow } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { needOf } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { lineOf, wander } from '../band/index.ts';
import { breakCamp, campWarm, eatPack, lookFor, makeCamp, trouble, unpack } from '../land/index.ts';
import { drinking } from './drink.ts';
import { working } from './jobs.ts';

/** One minute's choice for someone packed for a trip; false when they are not on one (their
 * pack put down once they are home) and the ordinary round goes on. */
export function afield(ctx: SystemContext, p: EntityRow, night: boolean): boolean {
  const { world, content } = ctx;
  if (!p['packed']) return false;
  if (p['job'] !== content.work.scout.job) {
    const g = greenOf(world);
    const near = Math.max(Math.abs((p['x'] as number) - g.x), Math.abs((p['y'] as number) - g.y));
    if (near <= content.work.scout.home && p['z'] === 0) unpack(ctx, p);
    return false;
  }
  if (p['doing'] === 'sleep') {
    const rest = needOf(world, p.id, 'rest')?.['value'] as number;
    if (night || rest < content.life.sleep.wake) return true;
    breakCamp(ctx, p);
    p['doing'] = '';
  }
  if (eatPack(ctx, p) || drinking(ctx, p) || campWarm(ctx, p)) return true;
  const rest = needOf(world, p.id, 'rest')?.['value'] as number;
  if (night || rest < lineOf(ctx, p, 'rest')) {
    makeCamp(ctx, p, night);
    return true;
  }
  trouble(ctx, p);
  lookFor(ctx, p);
  if (working(ctx, p, true)) p['doing'] = 'work';
  else wander(ctx, p);
  return true;
}

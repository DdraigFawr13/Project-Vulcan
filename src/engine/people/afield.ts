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
import { isDark } from '../lamp/index.ts';
import { drinking } from './drink.ts';
import { working } from './jobs.ts';

/** Whether `p` is on a trip with their pack: a scout, or a miner gone to a far shaft (V-225).
 * Anyone else packed puts the pack down once home. */
function onTrip(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  if (p['job'] === content.work.scout.job || p['job'] === content.work.mine.job) return true;
  const g = greenOf(world);
  const near = Math.max(Math.abs((p['x'] as number) - g.x), Math.abs((p['y'] as number) - g.y));
  if (near <= content.work.scout.home && p['z'] === 0) unpack(ctx, p);
  return false;
}

/** Whether they lie down now: at night, tired, or (a miner on the surface, whose work wants
 * daylight) at dusk, by the shaft with the ladder's logs kept, not carried home. */
function campNow(ctx: SystemContext, p: EntityRow, night: boolean): boolean {
  const { world, content } = ctx;
  const rest = needOf(world, p.id, 'rest')?.['value'] as number;
  const miner = p['job'] === content.work.mine.job;
  const dusk = miner && p['z'] === 0 && isDark(content, world.tick);
  if (!night && !dusk && rest >= lineOf(ctx, p, 'rest')) return false;
  makeCamp(ctx, p, night || dusk);
  return true;
}

/** One minute's choice for someone packed for a trip; false when they are not on one (their
 * pack put down once they are home) and the ordinary round goes on. */
export function afield(ctx: SystemContext, p: EntityRow, night: boolean): boolean {
  const { world, content } = ctx;
  if (!p['packed'] || !onTrip(ctx, p)) return false;
  if (p['doing'] === 'sleep') {
    const rest = needOf(world, p.id, 'rest')?.['value'] as number;
    if (night || rest < content.life.sleep.wake) return true;
    breakCamp(ctx, p);
    p['doing'] = '';
  }
  if (eatPack(ctx, p) || drinking(ctx, p) || campWarm(ctx, p) || campNow(ctx, p, night))
    return true;
  // The troubles of the way and a search are a scout's.
  if (p['job'] !== content.work.mine.job) {
    trouble(ctx, p);
    lookFor(ctx, p);
  }
  if (working(ctx, p, true)) p['doing'] = 'work';
  else wander(ctx, p);
  return true;
}

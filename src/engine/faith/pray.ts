// Prayer (6B Bundle 4, P6.8, V-187): in free time a faithful or devout person walks to their own
// faith's standing shrine and prays there `pray.minutes`, at most once in the `pray.every` days
// their devotion reaches (the lukewarm only at a feast day's rite). It is leisure (recreation rises
// as when relaxing) and leaves `pray.memory`. No line: the shrine's sheet counts the week's prayers.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import { spotOf, walkTo } from '../band/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { creedsOf, faithOf, shrineOf } from './tables.ts';

/** Minutes between looks for the shrine, spread across people by id. */
const LOOK = 15;

/** Days between prayers at `devotion`, or none (Infinity) under the last step. */
function everyDays(content: EngineContent, devotion: number): number {
  return content.worship.pray.every.find((e) => devotion >= e.from)?.days ?? Infinity;
}

/** The standing shrine of `p`'s faith, if any. */
function shrineFor(world: WorldState, p: EntityRow): EntityRow | undefined {
  const f = faithOf(world, p.id);
  const creed = f && creedsOf(world).find((c) => c.id === f['creed']);
  const shrine = creed && shrineOf(world, creed);
  return shrine && shrine['state'] === 'built' ? shrine : undefined;
}

/** Whether `p` stands beside (not on) the piece. */
function beside(p: EntityRow, piece: EntityRow): boolean {
  const d = Math.max(
    Math.abs((p['x'] as number) - (piece['x'] as number)),
    Math.abs((p['y'] as number) - (piece['y'] as number)),
  );
  return p['z'] === 0 && d === 1;
}

/** One minute of a prayer under way; false once it ends (with the memory) or the shrine is gone. */
function keepPraying(ctx: SystemContext, p: EntityRow, f: EntityRow, shrine?: EntityRow): boolean {
  if (!shrine || ctx.world.tick >= (f['until'] as number)) {
    if (shrine) addMemory(ctx, p.id, ctx.content.worship.pray.memory, shrine['made'] as number);
    f['until'] = 0;
    return false;
  }
  p['path'] = [];
  p['doing'] = 'pray';
  return true;
}

/** Sets `p` walking to the free tile beside the shrine they can reach, nearest first. */
function walkToPray(ctx: SystemContext, p: EntityRow, shrine: EntityRow): boolean {
  const from = spotOf(p);
  const spots: { x: number; y: number; z: number }[] = [];
  for (let dy = -1; dy <= 1; dy += 1)
    for (let dx = -1; dx <= 1; dx += 1)
      if (dx || dy)
        spots.push({ x: (shrine['x'] as number) + dx, y: (shrine['y'] as number) + dy, z: 0 });
  const far = (s: { x: number; y: number }) =>
    Math.max(Math.abs(s.x - from.x), Math.abs(s.y - from.y));
  for (const s of spots.sort((a, b) => far(a) - far(b)))
    if (walkTo(ctx, p, s)) {
      p['doing'] = 'pray';
      return true;
    }
  return false;
}

/** One minute of free time; true while `p` prays or walks to pray. */
export function praying(ctx: SystemContext, p: EntityRow): boolean {
  const { world, content } = ctx;
  const f = faithOf(world, p.id);
  if (!f) return false;
  const shrine = shrineFor(world, p);
  if ((f['until'] as number) > 0) return keepPraying(ctx, p, f, shrine);
  if (!shrine) return false;
  const days = everyDays(content, f['devotion'] as number);
  const last = f['prayed'] as number;
  if (last && world.tick - last < days * TICKS_PER_DAY) return false;
  if (beside(p, shrine)) {
    Object.assign(f, { prayed: world.tick, until: world.tick + content.worship.pray.minutes });
    p['path'] = [];
    p['doing'] = 'pray';
    return true;
  }
  if ((p['path'] as number[]).length && p['doing'] === 'pray') return true;
  if ((world.tick + p.id) % LOOK !== 0) return false;
  return walkToPray(ctx, p, shrine);
}

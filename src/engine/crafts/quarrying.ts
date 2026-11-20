// Breaking a boulder for what lies in it (6B Bundle 3 part 2): the mason splits one by slate rock
// into slate and stone (mason.ts), the lime burner breaks one by limestone into limestone and stone
// (lime.ts). Shared here so both walk beside it the same way and leave the same line.
import type { EntityRow } from '../core/index.ts';
import { raiseChunk } from '../map/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { goBeside, layAround, practise, spotOf } from '../band/index.ts';

/** Ends the work in hand; false, for a work function to return. */
export const stopWork = (p: EntityRow): false => {
  Object.assign(p, { job: '', plan: 0, target: -1, work: 0, make: '' });
  return false;
};

/** One minute at the boulder on surface tile `p.plan`: walks beside it, works `minutes`, then the
 * boulder goes and `yields` lie round it, with line `event` naming each count. */
export function breakBoulder(
  ctx: SystemContext,
  p: EntityRow,
  how: { skill: string; yields: Record<string, number>; minutes: number; event: string },
): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const i = p['plan'] as number;
  const f = map.features[i] ?? 0;
  if (content.features[f - 1]?.kind !== 'boulder') return stopWork(p);
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  const here = spotOf(p);
  if (!(here.z === 0 && Math.abs(here.x - x) + Math.abs(here.y - y) === 1))
    return goBeside(ctx, p, x, y) || stopWork(p);
  if (!(p['work'] as number)) p['work'] = how.minutes;
  p['work'] = (p['work'] as number) - 1;
  practise(ctx, p, how.skill, p['took'] as number);
  if ((p['work'] as number) > 0) return true;
  const line = ctx.emit(how.event, {
    causes: [p['took'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, ...how.yields },
  });
  map.features[i] = 0;
  map.tileCauses[i] = line;
  raiseChunk(map, x, y);
  for (const [kind, n] of Object.entries(how.yields))
    if (n > 0) layAround(ctx, kind, n, { x, y, z: 0 }, line);
  return stopWork(p);
}

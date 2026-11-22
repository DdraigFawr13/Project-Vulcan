// One home for the carers' measure of who is nearest (nurse, draught, feed, care).
import type { EntityRow, WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';

/** Steps apart for choosing whom to reach first: the larger axis, plus 100 a level. */
export const far = (a: Spot, b: Spot): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 100;

/** Whether `p` is the scout of the trip under way (6W Slice 5, V-206): out of earshot, nobody
 * walks straight to them; the late are searched for along their way (land `search.ts`). */
export const afar = (world: WorldState, p: EntityRow): boolean => {
  const trip = world.map.finds.at(-1);
  return trip?.count === -1 && trip.who === p.id;
};

/** Whether `q` is out searching for a late scout (they find by sight, not by a call). */
export const searching = (q: EntityRow): boolean =>
  q['job'] === 'scout' && ['search', 'seek'].includes(q['task'] as string);

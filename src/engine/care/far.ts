// One home for the carers' measure of who is nearest (nurse, draught, feed, care).
import type { Spot } from '../paths/index.ts';

/** Steps apart for choosing whom to reach first: the larger axis, plus 100 a level. */
export const far = (a: Spot, b: Spot): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 100;

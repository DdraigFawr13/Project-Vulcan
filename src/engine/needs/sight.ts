// Who sees what (6A review P6): one rule for every witness, whether to a tale, a law flouted, a
// theft or a brawl. The awake on the same level within life.json `sight` tiles see someone, and
// so does anyone in the same house on the surface.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { houseAt } from '../build/index.ts';
import { awake, far } from '../entity/index.ts';

/** Whether `q` can see `p` (wake aside): within sight on the same level, or the same house. */
export function sees(world: WorldState, content: EngineContent, q: EntityRow, p: EntityRow) {
  if (far(p, q) <= content.life.sight) return true;
  if (p['z'] !== 0 || q['z'] !== 0) return false;
  const house = houseAt(world, p['x'] as number, p['y'] as number);
  return !!house && house === houseAt(world, q['x'] as number, q['y'] as number);
}

/** The awake (but `p` and `but`) who see `p` now. */
export const seenBy = (
  world: WorldState,
  content: EngineContent,
  p: EntityRow,
  but: readonly number[] = [],
): EntityRow[] =>
  awake(world).filter((q) => q.id !== p.id && !but.includes(q.id) && sees(world, content, q, p));

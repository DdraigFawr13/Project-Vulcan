// Ground dug for a good (V-097, clay): the one rule for which tiles of the first level below count,
// shared by what a house may count on (`withinReach`, site.ts) and by the miner who digs it
// (people/clay.ts), so a house is never sized by clay nobody can get at.
import type { EngineContent, WorldState } from '../core/index.ts';
import { besideReachable } from '../paths/index.ts';

/** The level whose known ground is dug for building material (the first below the surface). */
export const DUG_LEVEL = 1;

/** Whether tile `i` of the dug level is known, its kind digs `good`, and someone who can reach
 * what `reach` says can stand on an orthogonal side of it. */
export function digsFor(
  world: WorldState,
  content: EngineContent,
  reach: (to: { x: number; y: number; z: number }) => boolean,
  i: number,
  good: string,
): boolean {
  const layer = world.map.levels[DUG_LEVEL - 1];
  return (
    !!layer &&
    layer.known[i] === 1 &&
    content.terrain.kinds[layer.tiles[i]!]!.digs?.item === good &&
    besideReachable(world, content, reach, i, DUG_LEVEL)
  );
}

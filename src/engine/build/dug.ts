// Ground dug for a good (V-097, clay): the one rule for which tiles of the first level below count,
// shared by what a house may count on (`withinReach`, site.ts) and by the miner who digs it
// (land/clay.ts), so a house is never sized by clay nobody can get at.
import type { EngineContent, WorldState } from '../core/index.ts';
import { bankTiles } from '../map/index.ts';
import { besideReachable } from '../paths/index.ts';

/** The level whose known ground is dug for building material (the first below the surface). */
export const DUG_LEVEL = 1;

/** Whether tile `i` of level `z` (the dug level, or the surface for a found clay bank, V-206) is
 * known, its kind digs `good`, and someone who can reach what `reach` says can stand on an
 * orthogonal side of it. */
export function digsFor(
  world: WorldState,
  content: EngineContent,
  reach: (to: { x: number; y: number; z: number }) => boolean,
  i: number,
  good: string,
  z = DUG_LEVEL,
): boolean {
  const layer = z === 0 ? world.map : world.map.levels[z - 1];
  return (
    !!layer &&
    layer.known[i] === 1 &&
    content.terrain.kinds[layer.tiles[i]!]!.digs?.item === good &&
    besideReachable(world, content, reach, i, z)
  );
}

/** What found clay banks on the surface (V-206) would give of `good`, however far off, from the
 * tiles someone who can reach what `reach` says could dig. */
export function bankClay(
  world: WorldState,
  content: EngineContent,
  reach: (to: { x: number; y: number; z: number }) => boolean,
  good: string,
): number {
  let n = 0;
  for (const i of bankTiles(content, world.map))
    if (digsFor(world, content, reach, i, good, 0))
      n += content.terrain.kinds[world.map.tiles[i]!]!.digs!.count;
  return n;
}

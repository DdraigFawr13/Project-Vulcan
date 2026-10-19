// Standing beside a tile (P4.1): whether any of its four sides can be walked on and reached.
import type { EngineContent, WorldState } from '../core/index.ts';
import { walkAt } from './grid.ts';

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Whether someone who can reach what `reach` says can stand on a side of tile `i` of level `z`
 * (never a corner, paths). */
export function besideReachable(
  world: WorldState,
  content: EngineContent,
  reach: (to: { x: number; y: number; z: number }) => boolean,
  i: number,
  z = 0,
): boolean {
  const map = world.map;
  const [x, y] = [i % map.width, Math.floor(i / map.width)];
  return SIDES.some(([dx, dy]) => {
    const [sx, sy] = [x + dx, y + dy];
    if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) return false;
    if (!walkAt(content, map, z, sy * map.width + sx)) return false;
    return reach({ x: sx, y: sy, z });
  });
}

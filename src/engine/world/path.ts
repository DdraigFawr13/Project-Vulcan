// Breadth-first search on the 4-connected grid. Grass is walkable; water and rock are not.
// Neighbour order is fixed, so ties always resolve the same way.

import { Terrain, type TileMap } from '../core/types.ts';

const STEPS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function walkable(map: TileMap, index: number): boolean {
  return map.terrain[index] === Terrain.Grass;
}

export function tileIndex(map: TileMap, x: number, y: number): number {
  return y * map.width + x;
}

/**
 * Finds the nearest tile (by walking distance) for which `accept` is true and returns the
 * path to it as tile indices, start excluded. Returns null when no reachable tile matches.
 * `maxSteps` bounds the search radius.
 */
export function findNearest(
  map: TileMap,
  start: number,
  accept: (index: number) => boolean,
  maxSteps = Infinity,
): number[] | null {
  if (accept(start)) return [];
  const from = new Int32Array(map.width * map.height).fill(-1);
  const depth = new Int32Array(map.width * map.height);
  from[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    if (depth[current]! >= maxSteps) continue;
    const cx = current % map.width;
    const cy = Math.floor(current / map.width);
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const next = ny * map.width + nx;
      if (from[next] !== -1 || !walkable(map, next)) continue;
      from[next] = current;
      depth[next] = depth[current]! + 1;
      if (accept(next)) return unwind(from, start, next);
      queue.push(next);
    }
  }
  return null;
}

/** Path from start to a known goal, or null when unreachable. */
export function findPath(map: TileMap, start: number, goal: number): number[] | null {
  return findNearest(map, start, (index) => index === goal);
}

function unwind(from: Int32Array, start: number, end: number): number[] {
  const path: number[] = [];
  for (let at = end; at !== start; at = from[at]!) path.push(at);
  return path.reverse();
}

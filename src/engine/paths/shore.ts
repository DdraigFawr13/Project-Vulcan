// The way out of water that can no longer be stood on (ice that thawed under someone): through
// water only, side or corner, to the nearest tile that can be stood on. Breadth first in a fixed
// order of neighbours, so one place always gives one way.
import type { EngineContent, MapState } from '../core/index.ts';
import { isWater, pack, walkAt, type Node, type Spot } from './grid.ts';

const AROUND = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

/** The surface tiles stepped onto from `from` to the nearest tile that can be stood on, ending on
 * it; empty when `from` can be stood on; undefined when no water leads anywhere that can. */
export function wayAshore(content: EngineContent, map: MapState, from: Spot): Node[] | undefined {
  const w = map.width;
  const start = from.y * w + from.x;
  if (from.z !== 0 || walkAt(content, map, 0, start)) return [];
  const back = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (let k = 0; k < queue.length; k += 1) {
    const i = queue[k]!;
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of AROUND) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const n = ny * w + nx;
      if (back.has(n)) continue;
      back.set(n, i);
      if (walkAt(content, map, 0, n)) {
        const way: Node[] = [];
        for (let at = n; at !== start; at = back.get(at)!)
          way.push(pack(map, { x: at % w, y: Math.floor(at / w), z: 0 }));
        return way.reverse();
      }
      if (isWater(content, map, n)) queue.push(n);
    }
  }
  return undefined;
}

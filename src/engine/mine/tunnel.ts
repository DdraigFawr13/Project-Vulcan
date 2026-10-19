// Tunnelling toward a vein (P4.1): on the shaft's vein level, open ground costs a step and each
// rock or earth tile the minutes digging it takes, so the way found runs through open ground
// first and then the cheapest line of tiles to dig. Ties go to the lower tile index.
import type { EngineContent, WorldState } from '../core/index.ts';
import { layerOf } from '../map/index.ts';
import { walkAt } from '../paths/index.ts';

const SIDES = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;

/** The next tile to dig on level `z` on the cheapest way from the shaft foot at (x, y) to a vein
 * tile of `metal`, and the open tile it is dug from; undefined when no such way exists.
 * `taken` are tile indices others are working, which the way goes round. */
export function nextDig(
  world: WorldState,
  content: EngineContent,
  at: { x: number; y: number; z: number },
  metal: string,
  taken: ReadonlySet<number>,
): { tile: number; from: number } | undefined {
  const map = world.map;
  const layer = layerOf(map, at.z);
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  if (!layer || !f) return undefined;
  const { kinds } = content.terrain;
  const { dig, vein } = content.work.mine;
  const [W, H] = [map.width, map.height];
  const size = W * H;
  /** Cost to enter tile `i`; 0 when it can be neither walked nor dug. */
  const enter = (i: number): number => {
    if (taken.has(i)) return 0;
    if (walkAt(content, map, at.z, i)) return 1;
    if (layer.features[i]) return vein;
    const kind = kinds[layer.tiles[i]!]!;
    return kind.stone || kind.solid ? dig : 0;
  };
  const far = new Float64Array(size).fill(Infinity);
  const prev = new Int32Array(size).fill(-1);
  const start = at.y * W + at.x;
  far[start] = 0;
  // A binary heap of cost * size + tile, so the lowest cost and then the lowest tile come first.
  const heap: number[] = [start];
  const push = (key: number): void => {
    heap.push(key);
    for (let c = heap.length - 1; c > 0;) {
      const p = (c - 1) >> 1;
      if (heap[p]! <= heap[c]!) break;
      [heap[p], heap[c]] = [heap[c]!, heap[p]!];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let p = 0; ;) {
        let c = 2 * p + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && heap[c + 1]! < heap[c]!) c += 1;
        if (heap[p]! <= heap[c]!) break;
        [heap[p], heap[c]] = [heap[c]!, heap[p]!];
        p = c;
      }
    }
    return top;
  };
  while (heap.length) {
    const key = pop();
    const i = key % size;
    const cost = (key - i) / size;
    if (cost > far[i]!) continue;
    if (layer.features[i] === f) {
      // Walk back to the first tile on the way that is not open ground.
      let tile = i;
      for (let j = i; j !== start; j = prev[j]!) if (!walkAt(content, map, at.z, j)) tile = j;
      return { tile, from: prev[tile]! };
    }
    const [x, y] = [i % W, Math.floor(i / W)];
    for (const [dx, dy] of SIDES) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      const step = enter(j);
      if (!step || cost + step >= far[j]!) continue;
      far[j] = cost + step;
      prev[j] = i;
      push((cost + step) * size + j);
    }
  }
  return undefined;
}

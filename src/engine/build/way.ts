// The way from the green (P3.7): where the camp sits in a clearing, the only ground for a house
// may lie past trees. The colony counts the fewest trees to fell to walk from the green to each
// tile (a 0-1 search, four sides a step), so a site's score can include clearing its way in and
// the felling marks can cover those trees too.
import type { EngineContent, WorldState } from '../core/index.ts';
import { walkAt, type Spot } from '../paths/index.ts';

/** A footprint: the rectangle's top-left tile and size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A chosen site: the footprint, its door, what it costs to clear and why it won. */
export interface Site extends Rect {
  door: Spot;
  rise: number;
  far: number;
  trees: number[];
}

export const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export interface Way {
  /** Trees to fell to reach each surface tile from the green, -1 where none would do. */
  trees: Int32Array;
  /** The tile each was reached from, -1 at the green. */
  from: Int32Array;
}

export const isTreeAt = (world: WorldState, content: EngineContent, i: number): boolean => {
  const f = world.map.features[i]!;
  const kind = f ? content.features[f - 1]!.kind : '';
  return kind === 'tree' || kind === 'log';
};

/** The fewest trees between the green and every surface tile, going round `block` if given. */
export function wayFrom(world: WorldState, content: EngineContent, green: Spot, block?: Rect): Way {
  const map = world.map;
  const n = map.width * map.height;
  const trees = new Int32Array(n).fill(-1);
  const from = new Int32Array(n).fill(-1);
  const start = green.y * map.width + green.x;
  // A deque as an array with a moving head: a step onto a tree goes to the back, else the front.
  const queue = new Int32Array(8 * n);
  let head = 4 * n;
  let tail = 4 * n;
  queue[tail++] = start;
  trees[start] = 0;
  const done = new Uint8Array(n);
  while (head < tail) {
    const i = queue[head++]!;
    if (done[i]) continue;
    done[i] = 1;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const j = ny * map.width + nx;
      if (block && inRect(block, nx, ny)) continue;
      const tree = isTreeAt(world, content, j);
      if (!tree && !walkAt(content, map, 0, j)) continue;
      if (tree) {
        const kind = content.terrain.kinds[map.tiles[j]!]!;
        if (kind.water || kind.solid) continue;
      }
      const cost = trees[i]! + (tree ? 1 : 0);
      if (trees[j]! >= 0 && trees[j]! <= cost) continue;
      trees[j] = cost;
      from[j] = i;
      if (tree) queue[tail++] = j;
      else queue[--head] = j;
    }
  }
  return { trees, from };
}

/** The tiles on the way from the green to tile `i`, the tile first and the green last. */
export function wayTo(way: Way, i: number): number[] {
  const out: number[] = [];
  for (let k = i; k >= 0; k = way.from[k]!) out.push(k);
  return out;
}

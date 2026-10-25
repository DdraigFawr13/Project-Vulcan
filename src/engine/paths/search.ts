// Path search (P2.3): first over regions, which says at once whether the goal can be reached and
// which regions the way runs through; then tile by tile inside those regions only. Both are A*
// with whole-number costs and ties broken by node number, so a search always gives one answer.
import type { EngineContent, MapState } from '../core/index.ts';
import { downAt, pack, type Node, type Spot } from './grid.ts';
import { anyCheap, octile, regionsOf, type Regions } from './regions.ts';

/** A binary heap of nodes by cost, ties by node number. */
class Heap {
  private readonly cost: number[] = [];
  private readonly node: number[] = [];
  get size(): number {
    return this.node.length;
  }
  private less(a: number, b: number): boolean {
    return (
      this.cost[a]! < this.cost[b]! ||
      (this.cost[a] === this.cost[b] && this.node[a]! < this.node[b]!)
    );
  }
  private swap(a: number, b: number): void {
    [this.cost[a], this.cost[b]] = [this.cost[b]!, this.cost[a]!];
    [this.node[a], this.node[b]] = [this.node[b]!, this.node[a]!];
  }
  push(cost: number, node: number): void {
    this.cost.push(cost);
    this.node.push(node);
    let c = this.node.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (!this.less(c, p)) break;
      this.swap(c, p);
      c = p;
    }
  }
  pop(): number {
    const top = this.node[0]!;
    const lastCost = this.cost.pop()!;
    const lastNode = this.node.pop()!;
    if (this.node.length) {
      this.cost[0] = lastCost;
      this.node[0] = lastNode;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < this.node.length && this.less(l, m)) m = l;
        if (r < this.node.length && this.less(r, m)) m = r;
        if (m === c) break;
        this.swap(m, c);
        c = m;
      }
    }
    return top;
  }
}

/** The region of a spot, or -1 when it cannot be stood on. */
export function regionAt(r: Regions, map: MapState, s: Spot): number {
  return r.labels[s.z]?.[s.y * map.width + s.x] ?? -1;
}

/** The regions a way from `from` to `to` runs through, or undefined when there is none. */
function corridor(r: Regions, map: MapState, from: number, to: number): Set<number> | undefined {
  if (r.regions.get(from)!.component !== r.regions.get(to)!.component) return undefined;
  const goal = r.regions.get(to)!;
  const g = new Map<number, number>([[from, 0]]);
  const back = new Map<number, number>();
  const done = new Set<number>();
  const heap = new Heap();
  const h = (id: number): number => {
    const reg = r.regions.get(id)!;
    return reg.z === goal.z ? octile(map, reg.rep, goal.rep) : 0;
  };
  heap.push(h(from), from);
  while (heap.size) {
    const id = heap.pop();
    if (done.has(id)) continue;
    done.add(id);
    if (id === to) break;
    for (const [n, cost] of r.regions.get(id)!.links) {
      const next = g.get(id)! + cost;
      if (!g.has(n) || next < g.get(n)!) {
        g.set(n, next);
        back.set(n, id);
        heap.push(next + h(n), n);
      }
    }
  }
  const way = new Set<number>([to]);
  for (let at = to; at !== from;) {
    at = back.get(at)!;
    way.add(at);
  }
  return way;
}

/** Arrays reused by every tile search on a map, stamped with the search's number instead of
 * cleared: `stamp` marks a node reached (with its cost and step back), `shut` one settled. */
interface Scratch {
  g: Int32Array;
  back: Int32Array;
  stamp: Uint32Array;
  shut: Uint32Array;
  now: number;
}

const scratch = new WeakMap<MapState, Scratch>();

function scratchOf(map: MapState): Scratch {
  const size = (1 + map.levels.length) * map.width * map.height;
  let s = scratch.get(map);
  if (!s || s.g.length < size) {
    s = {
      g: new Int32Array(size),
      back: new Int32Array(size),
      stamp: new Uint32Array(size),
      shut: new Uint32Array(size),
      now: 0,
    };
    scratch.set(map, s);
  }
  s.now += 1;
  return s;
}

/**
 * A way from `from` to `to` as the nodes stepped onto, ending on `to` (empty when they are the
 * same place), or undefined when no way exists now.
 */
export function findPath(
  content: EngineContent,
  map: MapState,
  from: Spot,
  to: Spot,
): Node[] | undefined {
  const r = regionsOf(content, map);
  const a = regionAt(r, map, from);
  const b = regionAt(r, map, to);
  if (a < 0 || b < 0) return undefined;
  const way = corridor(r, map, a, b);
  if (!way) return undefined;
  return tiles(content, map, r, pack(map, from), pack(map, to), way);
}

function tiles(
  content: EngineContent,
  map: MapState,
  r: Regions,
  start: Node,
  goal: Node,
  way: Set<number>,
): Node[] | undefined {
  if (start === goal) return [];
  const w = map.width;
  const n = map.width * map.height;
  const walking = content.terrain.walking;
  const s = scratchOf(map);
  const gx = (goal % n) % w;
  const gy = Math.floor((goal % n) / w);
  // With roads about, the estimate counts every step as a road step, so it never overshoots
  // and the way found is still the cheapest (P5.10). Each step is floored as `stepCost` floors
  // it: flooring the sum instead overshot on long diagonals (9.8 a step against a real 9).
  const least = anyCheap(r) ? walking.road : 10;
  const side = Math.floor((walking.straight * least) / 10);
  const corner = Math.floor((walking.diagonal * least) / 10);
  const h = (node: number): number => {
    const i = node % n;
    const dx = Math.abs((i % w) - gx);
    const dy = Math.abs(Math.floor(i / w) - gy);
    return side * Math.max(dx, dy) + (corner - side) * Math.min(dx, dy);
  };
  const open = (z: number, i: number): number => {
    const id = r.labels[z]?.[i] ?? -1;
    return id >= 0 && way.has(id) ? r.walk[z]![i]! : 0;
  };
  const visit = (node: number, from: number, cost: number, heap: Heap): void => {
    if (s.stamp[node] !== s.now || cost < s.g[node]!) {
      s.stamp[node] = s.now;
      s.g[node] = cost;
      s.back[node] = from;
      heap.push(cost + h(node), node);
    }
  };
  const heap = new Heap();
  s.stamp[start] = s.now;
  s.g[start] = 0;
  s.back[start] = -1;
  heap.push(h(start), start);
  while (heap.size) {
    const node = heap.pop();
    if (s.shut[node] === s.now) continue;
    s.shut[node] = s.now;
    if (node === goal) break;
    const z = Math.floor(node / n);
    const i = node % n;
    const x = i % w;
    const y = (i - x) / w;
    const here = s.g[node]!;
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
        const walk = open(z, ny * w + nx);
        if (!walk) continue;
        if (dx && dy && (!open(z, y * w + nx) || !open(z, ny * w + x))) continue;
        const step = Math.floor(((dx && dy ? walking.diagonal : walking.straight) * walk) / 10);
        visit(node + dy * w + dx, node, here + step, heap);
      }
    const down = downAt(content, map, z, i);
    if (down && open(z + 1, i)) visit(node + n, node, here + down, heap);
    const up = z > 0 ? downAt(content, map, z - 1, i) : 0;
    if (up && open(z - 1, i)) visit(node - n, node, here + up, heap);
  }
  if (s.shut[goal] !== s.now) return undefined;
  const path: Node[] = [];
  for (let at = goal; at !== start; at = s.back[at]!) path.push(at);
  return path.reverse();
}

/** Whether `to` can be reached from `from` now: a lookup, no search. */
export function canReach(content: EngineContent, map: MapState, from: Spot, to: Spot): boolean {
  const r = regionsOf(content, map);
  const a = regionAt(r, map, from);
  const b = regionAt(r, map, to);
  return a >= 0 && b >= 0 && r.regions.get(a)!.component === r.regions.get(b)!.component;
}

/** canReach from one spot to many: the regions are looked at once, not once a target. */
export function reachFrom(
  content: EngineContent,
  map: MapState,
  from: Spot,
): (to: Spot) => boolean {
  const r = regionsOf(content, map);
  const a = regionAt(r, map, from);
  const home = a >= 0 ? r.regions.get(a)!.component : -1;
  return (to) => {
    const b = regionAt(r, map, to);
    return home >= 0 && b >= 0 && r.regions.get(b)!.component === home;
  };
}

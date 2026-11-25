// Path search (P2.3): first over regions, which says at once whether the goal can be reached and
// which regions the way runs through; then tile by tile inside those regions only. Both are A*
// with whole-number costs and ties broken by node number, so a search always gives one answer.
import type { EngineContent, MapState } from '../core/index.ts';
import { chunksAcross, chunksDown, layerOf } from '../map/index.ts';
import { downAt, downKinds, pack, type Node, type Spot } from './grid.ts';
import { KeyHeap } from './heap.ts';
import { anyCheap, octile, PER_CHUNK, regionsOf, type Regions } from './regions.ts';

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
  const span = regionSpan(map);
  const heap = corridorHeap;
  heap.clear();
  const h = (id: number): number => {
    const reg = r.regions.get(id)!;
    return reg.z === goal.z ? octile(map, reg.rep, goal.rep) : 0;
  };
  heap.push(h(from) * span + from);
  while (heap.size) {
    const id = heap.pop() % span;
    if (done.has(id)) continue;
    done.add(id);
    if (id === to) break;
    for (const [n, cost] of r.regions.get(id)!.links) {
      const next = g.get(id)! + cost;
      if (!g.has(n) || next < g.get(n)!) {
        g.set(n, next);
        back.set(n, id);
        heap.push((next + h(n)) * span + n);
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
 * cleared: `stamp` marks a node reached (with its cost and step back), `shut` one settled, `way`
 * a region on the search's way. */
interface Scratch {
  g: Int32Array;
  back: Int32Array;
  stamp: Uint32Array;
  shut: Uint32Array;
  way: Uint32Array;
  now: number;
}

const scratch = new WeakMap<MapState, Scratch>();
const corridorHeap = new KeyHeap();
const tileHeap = new KeyHeap();

/** One more than the highest region id the map's levels can hold. */
const regionSpan = (map: MapState): number =>
  (1 + map.levels.length) * chunksAcross(map) * chunksDown(map) * PER_CHUNK;

function scratchOf(map: MapState): Scratch {
  const size = (1 + map.levels.length) * map.width * map.height;
  const ids = regionSpan(map);
  let s = scratch.get(map);
  if (!s || s.g.length < size || s.way.length < ids) {
    s = {
      g: new Int32Array(size),
      back: new Int32Array(size),
      stamp: new Uint32Array(size),
      shut: new Uint32Array(size),
      way: new Uint32Array(ids),
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
  const start = pack(map, from);
  const goal = pack(map, to);
  if (start === goal) return [];
  const s = scratchOf(map);
  for (const id of way) s.way[id] = s.now;
  return tiles(content, map, r, s, start, goal);
}

/** The estimate of a way's cost from a node to `goal`: every step at road cost while any road
 * exists, so it never overshoots and the way found is still the cheapest (P5.10). Each step is
 * floored as `stepCost` floors it: flooring the sum instead overshot on long diagonals. */
function estimate(content: EngineContent, map: MapState, r: Regions, goal: Node) {
  const w = map.width;
  const n = w * map.height;
  const walking = content.terrain.walking;
  const least = anyCheap(r) ? walking.road : 10;
  const side = Math.floor((walking.straight * least) / 10);
  const corner = Math.floor((walking.diagonal * least) / 10) - side;
  const gx = (goal % n) % w;
  const gy = Math.floor((goal % n) / w);
  return (node: number): number => {
    const i = node % n;
    const dx = Math.abs((i % w) - gx);
    const dy = Math.abs(Math.floor(i / w) - gy);
    return dx > dy ? side * dx + corner * dy : side * dy + corner * dx;
  };
}

/** A* over tiles inside the regions stamped in `s.way`; ties break by node number. */
function tiles(
  content: EngineContent,
  map: MapState,
  r: Regions,
  s: Scratch,
  start: Node,
  goal: Node,
): Node[] | undefined {
  const span = s.g.length;
  const h = estimate(content, map, r, goal);
  const heap = tileHeap;
  heap.clear();
  const visit = (node: number, from: number, cost: number): void => {
    if (s.stamp[node] !== s.now || cost < s.g[node]!) {
      s.stamp[node] = s.now;
      s.g[node] = cost;
      s.back[node] = from;
      heap.push((cost + h(node)) * span + node);
    }
  };
  const expand = expander(content, map, r, s, visit);
  s.stamp[start] = s.now;
  s.g[start] = 0;
  s.back[start] = -1;
  heap.push(h(start) * span + start);
  while (heap.size) {
    const node = heap.pop() % span;
    if (s.shut[node] === s.now) continue;
    s.shut[node] = s.now;
    if (node === goal) break;
    expand(node);
  }
  if (s.shut[goal] !== s.now) return undefined;
  const path: Node[] = [];
  for (let at = goal; at !== start; at = s.back[at]!) path.push(at);
  return path.reverse();
}

/** What one settled node offers: its eight neighbours (a corner only with both sides beside it
 * open) and the levels above and below, each at its step's cost. */
function expander(
  content: EngineContent,
  map: MapState,
  r: Regions,
  s: Scratch,
  visit: (node: number, from: number, cost: number) => void,
): (node: number) => void {
  const w = map.width;
  const n = w * map.height;
  const { side, corner } = stepTables(content);
  const down = downKinds(content);
  const tilesOn = (z: number) => layerOf(map, z)?.tiles;
  const open = (z: number, i: number): number => {
    const id = r.labels[z]?.[i] ?? -1;
    return id >= 0 && s.way[id] === s.now ? r.walk[z]![i]! : 0;
  };
  return (node) => {
    const z = Math.floor(node / n);
    const i = node - z * n;
    const x = i % w;
    const y = (i - x) / w;
    const here = s.g[node]!;
    const north = y > 0 ? open(z, i - w) : 0;
    const south = y + 1 < map.height ? open(z, i + w) : 0;
    const west = x > 0 ? open(z, i - 1) : 0;
    const east = x + 1 < w ? open(z, i + 1) : 0;
    const cornerTo = (j: number): void => {
      const c = open(z, j);
      if (c) visit(node + j - i, node, here + corner[c]!);
    };
    if (north && west) cornerTo(i - w - 1);
    if (north) visit(node - w, node, here + side[north]!);
    if (north && east) cornerTo(i - w + 1);
    if (west) visit(node - 1, node, here + side[west]!);
    if (east) visit(node + 1, node, here + side[east]!);
    if (south && west) cornerTo(i + w - 1);
    if (south) visit(node + w, node, here + side[south]!);
    if (south && east) cornerTo(i + w + 1);
    if (down[tilesOn(z)?.[i] ?? 0] && open(z + 1, i)) {
      const climb = downAt(content, map, z, i);
      if (climb) visit(node + n, node, here + climb);
    }
    if (z > 0 && down[tilesOn(z - 1)?.[i] ?? 0] && open(z - 1, i)) {
      const climb = downAt(content, map, z - 1, i);
      if (climb) visit(node - n, node, here + climb);
    }
  };
}

const tables = new WeakMap<EngineContent, { side: Int32Array; corner: Int32Array }>();

/** A side and a corner step's cost onto a tile of each `costAt` (0 to 255), floored. */
function stepTables(content: EngineContent): { side: Int32Array; corner: Int32Array } {
  let t = tables.get(content);
  if (!t) {
    const walking = content.terrain.walking;
    t = { side: new Int32Array(256), corner: new Int32Array(256) };
    for (let c = 0; c < 256; c += 1) {
      t.side[c] = Math.floor((walking.straight * c) / 10);
      t.corner[c] = Math.floor((walking.diagonal * c) / 10);
    }
    tables.set(content, t);
  }
  return t;
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

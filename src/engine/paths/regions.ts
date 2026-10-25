// The coarse map a search runs on first (P2.3): each 16 by 16 chunk of each reached level is cut
// into regions, the pieces of walkable ground joined side to side inside it; regions touch across
// chunk edges and through stairs and shafts. Regions that can reach each other share a component,
// so "can't get there" is known without a search. All of it is worked out from the map and kept
// beside it, never saved: a chunk is relabelled when its version changes (felling, digging, ice).
// Region ids are fixed by place (level, chunk, order of first tile), never by when they were
// made, so a loaded world searches exactly as the running one did.
import type { EngineContent, MapState } from '../core/index.ts';
import { CHUNK, chunksAcross, chunksDown, layerOf } from '../map/index.ts';
import { costAt, downAt } from './grid.ts';

/** Up to 128 regions fit in a 16 by 16 chunk (a checkerboard), so 256 ids a chunk is enough. */
const PER_CHUNK = 256;

export interface Region {
  id: number;
  z: number;
  /** Its first tile in reading order, which stands for it in the coarse search. */
  rep: number;
  /** Neighbouring regions and the cost of getting from this one's tile to theirs. */
  links: Map<number, number>;
  component: number;
}

export interface Regions {
  /** Per level: each tile's region id, -1 where nothing can walk. */
  labels: Int32Array[];
  regions: Map<number, Region>;
  /** Per level: each tile's cost (`costAt`, tenths of a plain step) when the labels were made
   * (0 never walked). */
  walk: Uint8Array[];
  /** Per level and chunk: how many of its tiles cost less than plain ground (roads, P5.10), so a
   * search knows whether its estimate must allow for them. */
  cheap: Int32Array[];
  /** Per level: the chunk versions the labels were made from. */
  seen: Int32Array[];
}

const cache = new WeakMap<MapState, Regions>();

const levels = (map: MapState): number => 1 + map.levels.length;

/** The regions of the map as it is now, relabelling only the chunks that changed. */
export function regionsOf(content: EngineContent, map: MapState): Regions {
  let r = cache.get(map);
  if (!r) {
    r = { labels: [], walk: [], cheap: [], regions: new Map(), seen: [] };
    cache.set(map, r);
  }
  const across = chunksAcross(map);
  const chunks = across * chunksDown(map);
  let changed = false;
  for (let z = 0; z < levels(map); z += 1) {
    const layer = layerOf(map, z);
    if (!layer) continue;
    if (!r.labels[z]) {
      r.labels[z] = new Int32Array(map.width * map.height).fill(-1);
      r.walk[z] = new Uint8Array(map.width * map.height);
      r.seen[z] = new Int32Array(chunks).fill(-1);
      r.cheap[z] = new Int32Array(chunks);
    }
    for (let c = 0; c < chunks; c += 1)
      if (r.seen[z]![c] !== layer.chunkVersions[c]) {
        const [cx, cy] = [c % across, Math.floor(c / across)];
        // A version raised for something that is not walking (a print, lying snow) relabels nothing.
        const same = r.seen[z]![c] !== -1 && sameWalk(content, map, r, z, cx, cy);
        if (!same) {
          label(content, map, r, z, cx, cy);
          changed = true;
        }
        r.seen[z]![c] = layer.chunkVersions[c]!;
      }
  }
  // Frozen water changes walking without a new tile kind; the weather raises the chunk's
  // version when ice comes or goes, so it is caught above.
  if (changed) link(content, map, r);
  return r;
}

/** Whether every tile of a chunk walks as it did when the chunk was last labelled. */
function sameWalk(
  content: EngineContent,
  map: MapState,
  r: Regions,
  z: number,
  cx: number,
  cy: number,
): boolean {
  const walk = r.walk[z]!;
  const y1 = Math.min(map.height, (cy + 1) * CHUNK);
  const x1 = Math.min(map.width, (cx + 1) * CHUNK);
  for (let y = cy * CHUNK; y < y1; y += 1)
    for (let x = cx * CHUNK; x < x1; x += 1)
      if (walk[y * map.width + x] !== costAt(content, map, z, y * map.width + x)) return false;
  return true;
}

/** Labels one chunk's regions with 4-way flood fills in reading order. */
function label(
  content: EngineContent,
  map: MapState,
  r: Regions,
  z: number,
  cx: number,
  cy: number,
): void {
  const w = map.width;
  const labels = r.labels[z]!;
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const x1 = Math.min(map.width, x0 + CHUNK);
  const y1 = Math.min(map.height, y0 + CHUNK);
  const base = (z * chunksAcross(map) * chunksDown(map) + cy * chunksAcross(map) + cx) * PER_CHUNK;
  for (let id = base; id < base + PER_CHUNK; id += 1) r.regions.delete(id);
  const walk = r.walk[z]!;
  let cheap = 0;
  for (let y = y0; y < y1; y += 1)
    for (let x = x0; x < x1; x += 1) {
      labels[y * w + x] = -1;
      walk[y * w + x] = costAt(content, map, z, y * w + x);
      if (walk[y * w + x]! && walk[y * w + x]! < 10) cheap += 1;
    }
  r.cheap[z]![cy * chunksAcross(map) + cx] = cheap;
  let next = 0;
  const stack: number[] = [];
  for (let y = y0; y < y1; y += 1)
    for (let x = x0; x < x1; x += 1) {
      const i = y * w + x;
      if (labels[i] !== -1 || !walk[i]) continue;
      const id = base + next;
      next += 1;
      r.regions.set(id, { id, z, rep: i, links: new Map(), component: id });
      labels[i] = id;
      stack.push(i);
      while (stack.length) {
        const j = stack.pop()!;
        const jx = j % w;
        const jy = (j - jx) / w;
        for (const [nx, ny] of [
          [jx + 1, jy],
          [jx - 1, jy],
          [jx, jy + 1],
          [jx, jy - 1],
        ] as const) {
          if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
          const k = ny * w + nx;
          if (labels[k] === -1 && walk[k]) {
            labels[k] = id;
            stack.push(k);
          }
        }
      }
    }
}

/** Whether any tile of the map costs less than plain ground (a road). */
export const anyCheap = (r: Regions): boolean => r.cheap.some((c) => c?.some((n) => n > 0));

/** Distance in tenths of a straight step between two tiles of a level, corners counted. */
export function octile(map: MapState, a: number, b: number): number {
  const dx = Math.abs((a % map.width) - (b % map.width));
  const dy = Math.abs(Math.floor(a / map.width) - Math.floor(b / map.width));
  return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy);
}

/** Rebuilds every region's links and the components: across chunk edges side to side, and
 * through stairs and shafts. Cheap next to a search (about 30k tile checks at full depth). */
function link(content: EngineContent, map: MapState, r: Regions): void {
  for (const region of r.regions.values()) region.links.clear();
  const w = map.width;
  const join = (a: number, b: number, cost: number): void => {
    const ra = r.regions.get(a)!;
    const rb = r.regions.get(b)!;
    const base = cost + octile(map, ra.rep, rb.rep);
    if (!ra.links.has(b)) ra.links.set(b, base);
    if (!rb.links.has(a)) rb.links.set(a, base);
  };
  for (let z = 0; z < levels(map); z += 1) {
    const labels = r.labels[z];
    if (!labels) continue;
    for (let y = 0; y < map.height; y += 1)
      for (let x = 0; x < map.width; x += 1) {
        const i = y * w + x;
        const a = labels[i]!;
        if (a < 0) continue;
        // Only the tiles on a chunk's right and bottom edges can touch another chunk.
        if (x % CHUNK === CHUNK - 1 && x + 1 < map.width && labels[i + 1]! >= 0)
          join(a, labels[i + 1]!, 0);
        if (y % CHUNK === CHUNK - 1 && y + 1 < map.height && labels[i + w]! >= 0)
          join(a, labels[i + w]!, 0);
        const below = r.labels[z + 1];
        if (below && below[i]! >= 0) {
          const climb = downAt(content, map, z, i);
          if (climb) join(a, below[i]!, climb);
        }
      }
  }
  // Components by flood over the links, each named by its smallest region id.
  const ids = [...r.regions.keys()].sort((a, b) => a - b);
  for (const id of ids) r.regions.get(id)!.component = -1;
  for (const id of ids) {
    const first = r.regions.get(id)!;
    if (first.component !== -1) continue;
    first.component = id;
    const stack = [first];
    while (stack.length)
      for (const n of stack.pop()!.links.keys()) {
        const next = r.regions.get(n)!;
        if (next.component === -1) {
          next.component = id;
          stack.push(next);
        }
      }
  }
}

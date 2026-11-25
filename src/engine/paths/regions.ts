// The coarse map a search runs on first (P2.3): each 16 by 16 chunk of each reached level is cut
// into regions, the pieces of walkable ground joined side to side inside it; regions touch across
// chunk edges and through stairs and shafts. Regions that can reach each other share a component,
// so "can't get there" is known without a search. All of it is worked out from the map and kept
// beside it, never saved: a chunk is relabelled when its version changes (felling, digging, ice).
// Region ids are fixed by place (level, chunk, order of first tile), never by when they were
// made, so a loaded world searches exactly as the running one did.
import type { EngineContent, MapState } from '../core/index.ts';
import { CHUNK, chunkEpoch, chunksAcross, chunksDown, layerOf } from '../map/index.ts';
import { costAt, downAt, leadsDown } from './grid.ts';

/** Up to 128 regions fit in a 16 by 16 chunk (a checkerboard), so 256 ids a chunk is enough. */
export const PER_CHUNK = 256;

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
  /** Per level and chunk: its tiles that lead down (stairs, shafts), the only ones that can link
   * to the level below. */
  downs: Map<number, number[]>[];
  /** Chunks (level times chunks plus chunk) whose version changed since the links were last
   * made: only their links are made again, unless there are many (`relink`). */
  pending: Set<number>;
  linked: boolean;
  /** The map's `chunkEpoch` and how many levels below were reached when the versions were last
   * read: while both are the same, no version has changed and nothing is read again. */
  epoch: number;
  depth: number;
}

const cache = new WeakMap<MapState, Regions>();

const levels = (map: MapState): number => 1 + map.levels.length;

/** The regions of the map as it is now, relabelling only the chunks that changed. */
export function regionsOf(content: EngineContent, map: MapState): Regions {
  let r = cache.get(map);
  if (!r) {
    r = {
      labels: [],
      walk: [],
      cheap: [],
      regions: new Map(),
      seen: [],
      downs: [],
      pending: new Set(),
      linked: false,
      epoch: -1,
      depth: -1,
    };
    cache.set(map, r);
  }
  const reached = map.levels.filter(Boolean).length;
  if (r.epoch === chunkEpoch(map) && r.depth === reached) return r;
  r.epoch = chunkEpoch(map);
  r.depth = reached;
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
      r.downs[z] = new Map();
    }
    for (let c = 0; c < chunks; c += 1)
      if (r.seen[z]![c] !== layer.chunkVersions[c]) {
        const [cx, cy] = [c % across, Math.floor(c / across)];
        // A version raised for something that is not walking (a print, lying snow) relabels nothing.
        const same = r.seen[z]![c] !== -1 && sameWalk(content, map, r, z, cx, cy);
        // Stairs cut on open ground walk the same but now lead down, so the links change.
        if (same && String(downsIn(content, map, z, cx, cy)) !== String(r.downs[z]!.get(c))) {
          r.downs[z]!.set(c, downsIn(content, map, z, cx, cy));
          changed = true;
        }
        if (!same) {
          label(content, map, r, z, cx, cy);
          changed = true;
        }
        r.seen[z]![c] = layer.chunkVersions[c]!;
        r.pending.add(z * chunks + c);
      }
  }
  // Frozen water changes walking without a new tile kind; the weather raises the chunk's
  // version when ice comes or goes, so it is caught above.
  if (changed) {
    // Few changed chunks (a wall tried, a tree felled) mend their own links; a new level or a
    // big change makes them all again. Both give the same links and costs.
    if (r.linked && r.pending.size * 8 < levels(map) * chunks) relink(content, map, r);
    else link(content, map, r);
    r.pending.clear();
    r.linked = true;
  }
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
  r.downs[z]!.set(cy * chunksAcross(map) + cx, downsIn(content, map, z, cx, cy));
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
  const join = joiner(map, r);
  for (let z = 0; z < levels(map); z += 1) {
    const labels = r.labels[z];
    if (!labels) continue;
    const below = r.labels[z + 1];
    // Only chunk edges link, and tiles leading down to a reached level below: each row is read
    // at those tiles alone, in reading order as before (the 250-tile map, V-202).
    const downs = below ? [...r.downs[z]!.values()].flat().sort((a, b) => a - b) : [];
    let d = 0;
    for (let y = 0; y < map.height; y += 1)
      for (const x of rowTiles(map.width, y, downs, d)) {
        const i = y * w + x;
        while (d < downs.length && downs[d]! <= i) d += 1;
        const a = labels[i]!;
        if (a < 0) continue;
        // Only the tiles on a chunk's right and bottom edges can touch another chunk.
        if (x % CHUNK === CHUNK - 1 && x + 1 < map.width && labels[i + 1]! >= 0)
          join(a, labels[i + 1]!, 0);
        if (y % CHUNK === CHUNK - 1 && y + 1 < map.height && labels[i + w]! >= 0)
          join(a, labels[i + w]!, 0);
        if (below && below[i]! >= 0) {
          const climb = downAt(content, map, z, i);
          if (climb) join(a, below[i]!, climb);
        }
      }
  }
  components(r);
}

/** Links two regions both ways at `cost` plus the distance between them; the first link made
 * between two regions stands. */
function joiner(map: MapState, r: Regions) {
  return (a: number, b: number, cost: number): void => {
    const ra = r.regions.get(a)!;
    const rb = r.regions.get(b)!;
    const base = cost + octile(map, ra.rep, rb.rep);
    if (!ra.links.has(b)) ra.links.set(b, base);
    if (!rb.links.has(a)) rb.links.set(a, base);
  };
}

/** Components by flood over the links, each named by its smallest region id. */
function components(r: Regions): void {
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

/** The x of each tile in row `y` that can link: every tile of a chunk's bottom row, else each
 * chunk's right edge and the row's tiles leading down (`downs` sorted, read from `from`). */
function rowTiles(width: number, y: number, downs: readonly number[], from: number): number[] {
  if (y % CHUNK === CHUNK - 1) return Array.from({ length: width }, (_, x) => x);
  const xs: number[] = [];
  for (let x = CHUNK - 1; x < width; x += CHUNK) xs.push(x);
  for (let k = from; k < downs.length && downs[k]! < (y + 1) * width; k += 1)
    if (downs[k]! >= y * width) xs.push(downs[k]! - y * width);
  return xs.length > width / CHUNK ? [...new Set(xs)].sort((a, b) => a - b) : xs;
}

/** A chunk's tiles that lead down, in reading order. */
function downsIn(content: EngineContent, map: MapState, z: number, cx: number, cy: number) {
  const tiles = layerOf(map, z)!.tiles;
  const out: number[] = [];
  for (let y = cy * CHUNK; y < Math.min(map.height, (cy + 1) * CHUNK); y += 1)
    for (let x = cx * CHUNK; x < Math.min(map.width, (cx + 1) * CHUNK); x += 1)
      if (leadsDown(content, tiles[y * map.width + x]!)) out.push(y * map.width + x);
  return out;
}

/** `link` for the pending chunks alone: their regions' links, and the links into them from the
 * chunks beside, above and below, are dropped and made again from the same tiles in the same
 * order, so every link and cost is as a full `link` would make it. */
function relink(content: EngineContent, map: MapState, r: Regions): void {
  const across = chunksAcross(map);
  const chunks = across * chunksDown(map);
  const touching = (g: number): number[] => {
    const c = g % chunks;
    const [cx, cy] = [c % across, Math.floor(c / across)];
    const out = [g - chunks, g + chunks];
    if (cx > 0) out.push(g - 1);
    if (cx + 1 < across) out.push(g + 1);
    if (cy > 0) out.push(g - across);
    if (cy + 1 < chunksDown(map)) out.push(g + across);
    return out.filter((n) => n >= 0 && n < levels(map) * chunks);
  };
  const regionsIn = (g: number): Region[] => {
    const out: Region[] = [];
    for (let id = g * PER_CHUNK; id < (g + 1) * PER_CHUNK; id += 1) {
      const region = r.regions.get(id);
      if (region) out.push(region);
    }
    return out;
  };
  for (const g of r.pending) {
    for (const region of regionsIn(g)) region.links.clear();
    for (const n of touching(g))
      if (!r.pending.has(n))
        for (const region of regionsIn(n))
          for (const to of region.links.keys())
            if (Math.floor(to / PER_CHUNK) === g) region.links.delete(to);
  }
  const join = joiner(map, r);
  for (const g of r.pending) joinChunk(content, map, r, g, join);
  components(r);
}

/** Makes again a chunk's links: across its four edges, and through the tiles leading down from
 * it and into it, in reading order. */
function joinChunk(
  content: EngineContent,
  map: MapState,
  r: Regions,
  g: number,
  join: (a: number, b: number, cost: number) => void,
): void {
  const w = map.width;
  const chunks = chunksAcross(map) * chunksDown(map);
  const [z, c] = [Math.floor(g / chunks), g % chunks];
  const labels = r.labels[z];
  if (!labels) return;
  const x0 = (c % chunksAcross(map)) * CHUNK;
  const y0 = Math.floor(c / chunksAcross(map)) * CHUNK;
  const x1 = Math.min(w, x0 + CHUNK);
  const y1 = Math.min(map.height, y0 + CHUNK);
  const side = (i: number, j: number): void => {
    if (labels[i]! >= 0 && labels[j]! >= 0) join(labels[i]!, labels[j]!, 0);
  };
  for (let y = y0; y < y1; y += 1) {
    if (x1 < w) side(y * w + x1 - 1, y * w + x1);
    if (x0 > 0) side(y * w + x0 - 1, y * w + x0);
  }
  for (let x = x0; x < x1; x += 1) {
    if (y1 < map.height) side((y1 - 1) * w + x, y1 * w + x);
    if (y0 > 0) side((y0 - 1) * w + x, y0 * w + x);
  }
  for (const top of [z - 1, z]) joinDowns(content, map, r, top, c, join);
}

/** Links level `top` to the level below through chunk `c`'s tiles leading down, in reading order. */
function joinDowns(
  content: EngineContent,
  map: MapState,
  r: Regions,
  top: number,
  c: number,
  join: (a: number, b: number, cost: number) => void,
): void {
  const [upper, lower] = [r.labels[top], r.labels[top + 1]];
  if (!upper || !lower) return;
  for (const i of r.downs[top]!.get(c) ?? []) {
    if (upper[i]! < 0 || lower[i]! < 0) continue;
    const climb = downAt(content, map, top, i);
    if (climb) join(upper[i]!, lower[i]!, climb);
  }
}

// Search tunnels (6W Slice 7, V-215): with a shaft sunk to an ore's level and that ore wanted but
// no vein of it known, miners dig out into the dark looking for it, one tunnel at a time, each at
// most `work.mine.search` tiles: from the caves or water they know down there, else from the
// shaft's foot, the way that holds most of the rock the ore likes (`vein.rocks`) among the tiles
// they know. A tunnel ends at its length, at water or the map's edge; the next goes another way.
// A vein it passes is shown by the digging (map `openAround`), and then mined as any other.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { compass, diggable } from '../map/index.ts';
import { reachFrom, walkAt } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { shaftsOf } from './shafts.ts';

/** The eight ways out, clockwise from north. */
const WAYS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;

export interface SearchDig {
  shaft: EntityRow;
  z: number;
  /** The next tile to dig and the open tile it is dug from. */
  tile: number;
  from: number;
  /** A tunnel not yet begun: what `beginSearch` notes and says once someone takes it up. */
  fresh?: SearchBegin;
}

/** A search tunnel chosen: its key and way, and its line's causes and words. */
export interface SearchBegin {
  key: string;
  way: number;
  causes: number[];
  data: Record<string, string | number>;
}

/** The tiles of a way from `start`, side by side (a slant goes as a stair, across then along),
 * at most `n`; ends at the map's edge. */
function wayFrom(map: WorldState['map'], start: number, way: number, n: number): number[] {
  const [dx, dy] = WAYS[way]!;
  const out: number[] = [];
  let [x, y] = [start % map.width, Math.floor(start / map.width)];
  for (let k = 0; out.length < n; k += 1) {
    if (dx && (!dy || k % 2 === 0)) x += dx;
    else y += dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) break;
    out.push(y * map.width + x);
  }
  return out;
}

/** Where to start: the known open tiles beside the dark that the shaft's foot reaches, in a cave
 * or by water (farthest from the foot first, ties to the lower tile), then the foot itself. */
function startsOf(world: WorldState, content: EngineContent, shaft: EntityRow, z: number): number[] {
  const map = world.map;
  const layer = map.levels[z - 1]!;
  const [W, H] = [map.width, map.height];
  const [fx, fy] = [shaft['x'] as number, shaft['y'] as number];
  const reach = reachFrom(content, map, { x: fx, y: fy, z });
  const kinds = content.terrain.kinds;
  const cave = kinds.findIndex((k) => k.id === content.terrain.generator.underground.caves.kind);
  const wet = (i: number) => !!layer.known[i] && !!kinds[layer.tiles[i]!]!.water;
  const out: [number, number][] = [];
  for (let i = 0; i < layer.tiles.length; i += 1) {
    if (!layer.known[i] || !walkAt(content, map, z, i)) continue;
    const [x, y] = [i % W, Math.floor(i / W)];
    const sides = WAYS.filter(([dx, dy]) => !(dx && dy))
      .map(([dx, dy]) => [x + dx, y + dy] as const)
      .filter(([sx, sy]) => sx >= 0 && sy >= 0 && sx < W && sy < H)
      .map(([sx, sy]) => sy * W + sx);
    if (!sides.some((j) => !layer.known[j])) continue;
    if (layer.tiles[i] !== cave && !sides.some(wet)) continue;
    if (!reach({ x, y, z })) continue;
    out.push([Math.max(Math.abs(x - fx), Math.abs(y - fy)), i]);
  }
  out.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return [...out.map(([, i]) => i), fy * W + fx];
}

/** How much of the ore's rock the miners know of within 2 tiles of a way, by `vein.rocks`. */
function rockAlong(world: WorldState, content: EngineContent, metal: string, z: number, way: number[]): number {
  const map = world.map;
  const layer = map.levels[z - 1]!;
  const rocks = content.features.find((f) => f.id === metal)?.vein?.rocks ?? {};
  const ids = content.terrain.kinds.map((k) => k.id);
  const seen = new Set<number>();
  let n = 0;
  for (const t of way) {
    const [x, y] = [t % map.width, Math.floor(t / map.width)];
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = -2; dx <= 2; dx += 1) {
        const [sx, sy] = [x + dx, y + dy];
        if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) continue;
        const i = sy * map.width + sx;
        if (seen.has(i) || !layer.known[i]) continue;
        seen.add(i);
        n += rocks[ids[layer.tiles[i]!]!] ?? 0;
      }
  }
  return n;
}

/** The next tile of the way; 'done' when it is all open or ends at water, 'wait' while someone
 * else digs it. */
function nextOn(
  world: WorldState,
  content: EngineContent,
  z: number,
  start: number,
  way: number,
  taken: ReadonlySet<number>,
): { tile: number; from: number } | 'done' | 'wait' {
  const map = world.map;
  const layer = map.levels[z - 1]!;
  let from = start;
  for (const i of wayFrom(map, start, way, content.work.mine.search)) {
    if (layer.known[i] && walkAt(content, map, z, i)) {
      from = i;
      continue;
    }
    if (layer.known[i] && !diggable(content.terrain.kinds[layer.tiles[i]!]!)) return 'done';
    return taken.has(i) ? 'wait' : { tile: i, from };
  }
  return 'done';
}

/** The search tunnel under way for `metal`, or a new one begun (its line citing `causes`), and
 * its next tile; undefined when no shaft reaches the ore's level or every way has been tried. */
export function searchDig(
  ctx: SystemContext,
  metal: string,
  causes: readonly number[],
  taken: ReadonlySet<number>,
): SearchDig | undefined {
  const { world, content } = ctx;
  const z = content.features.find((f) => f.id === metal)?.vein?.level ?? 0;
  if (!world.map.levels[z - 1]) return undefined;
  const shafts = shaftsOf(world).filter(
    (s) => ['done', 'spent'].includes(s['state'] as string) && s['to'] === z,
  );
  const state = (world.systems['search'] ??= {});
  for (const shaft of shafts) {
    const key = `${metal}-${shaft.id}`;
    for (let tries = 0; tries < 64; tries += 1) {
      const cur = state[key] ?? 0;
      if (!cur) {
        // A new tunnel is chosen here and begun only when someone takes it up (`beginSearch`).
        const fresh = choose(ctx, metal, shaft, z, causes);
        if (!fresh) break;
        const [start, way] = [Math.floor(fresh.way / 8), fresh.way % 8];
        const next = nextOn(world, content, z, start, way, taken);
        if (next === 'wait') return undefined;
        if (next !== 'done') return { shaft, z, ...next, fresh };
        state[`${key}@${start}`] = (state[`${key}@${start}`] ?? 0) | (1 << way);
        continue;
      }
      const [start, way] = [Math.floor((cur - 1) / 8), (cur - 1) % 8];
      const next = nextOn(world, content, z, start, way, taken);
      if (next === 'wait') return undefined;
      if (next !== 'done') return { shaft, z, ...next };
      state[`${key}@${start}`] = (state[`${key}@${start}`] ?? 0) | (1 << way);
      state[key] = 0;
    }
  }
  return undefined;
}

/** A search tunnel taken up: noted as under way, and its line. */
export function beginSearch(ctx: SystemContext, begin: SearchBegin): void {
  const state = (ctx.world.systems['search'] ??= {});
  state[begin.key] = begin.way + 1;
  ctx.emit('mine.searchBegun', { causes: begin.causes, data: begin.data });
}

/** The next search tunnel from `shaft`: the first start with a way left untried, the way richest
 * in the ore's known rock (ties to the first clockwise from north). */
function choose(
  ctx: SystemContext,
  metal: string,
  shaft: EntityRow,
  z: number,
  causes: readonly number[],
): SearchBegin | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const state = world.systems['search']!;
  const key = `${metal}-${shaft.id}`;
  const foot = (shaft['y'] as number) * map.width + (shaft['x'] as number);
  for (const start of startsOf(world, content, shaft, z)) {
    const tried = state[`${key}@${start}`] ?? 0;
    let best = -1;
    let score = -1;
    for (let way = 0; way < 8; way += 1) {
      if (tried & (1 << way)) continue;
      const tiles = wayFrom(map, start, way, content.work.mine.search);
      if (!tiles.length) continue;
      const s = rockAlong(world, content, metal, z, tiles);
      if (s > score) [best, score] = [way, s];
    }
    if (best < 0) continue;
    const [dx, dy] = WAYS[best]!;
    const where = start === foot ? 'the shaft foot' : 'the edge of what they know';
    return {
      key,
      way: start * 8 + best,
      causes: [...causes, shaft['line'] as number].filter((l) => l > 0),
      data: { metal, level: z, dir: compass(dx, dy), from: where, tiles: content.work.mine.search },
    };
  }
  return undefined;
}

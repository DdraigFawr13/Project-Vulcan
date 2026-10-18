// The region's land: value noise, the rivers that run downhill and the named mountain ranges.
// Only + - * / and floor (V-006).
import type { EngineContent, RngStream } from '../core/index.ts';
import { geoName } from './names.ts';
import type { Region, RegionCell, RegionRange } from './region.ts';

const smooth = (t: number): number => t * t * (3 - 2 * t);
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
export const RAYS = [...SIDES, [1, 1], [-1, -1], [1, -1], [-1, 1]] as const;

/** Value noise in [0, 1] over a width by height grid (x and y from 0). */
export function noise(rng: RngStream, width: number, height: number, cell: number) {
  const across = Math.floor(width / cell) + 2;
  const down = Math.floor(height / cell) + 2;
  const lattice = Array.from({ length: across * down }, () => rng.int(65_536) / 65_535);
  return (x: number, y: number): number => {
    const gx = clamp(x, 0, width) / cell;
    const gy = clamp(y, 0, height) / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smooth(gx - x0);
    const fy = smooth(gy - y0);
    const at = (i: number, j: number): number => lattice[j * across + i]!;
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

/** The band a value falls in: 0 below the first edge. */
export const band = (v: number, edges: readonly number[]): number =>
  edges.filter((b) => v >= b).length;

/** Up to `rivers.count` rivers from the wettest high cells, downhill to the edge or a lake. */
export function layRivers(
  rng: RngStream,
  content: EngineContent,
  cells: RegionCell[],
  W: number,
  H: number,
) {
  const dials = content.region.rivers;
  const sources = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.e > 0.6 && c.biome !== 'alpine')
    .sort((a, b) => b.c.r - a.c.r || a.i - b.i)
    .slice(0, dials.sources);
  const rivers: Region['rivers'] = [];
  const edge = (x: number, y: number): number => Math.min(x, y, W - 1 - x, H - 1 - y);
  const onRiver = new Set<number>();
  for (const { i: src } of sources) {
    if (rivers.length === dials.count) break;
    const sx = src % W;
    const sy = (src - sx) / W;
    if (
      rivers.some((r) => r.path.some(([x, y]) => Math.abs(x - sx) + Math.abs(y - sy) < dials.apart))
    )
      continue;
    const path: [number, number][] = [[sx, sy]];
    let [x, y] = [sx, sy];
    for (let k = 0; k < 200; k += 1) {
      // The lowest free neighbour, nudged towards the nearer edge; never back beside its own course.
      const options = SIDES.map(([dx, dy]) => [x + dx, y + dy] as const).filter(
        ([nx, ny]) =>
          nx >= 0 &&
          ny >= 0 &&
          nx < W &&
          ny < H &&
          path.slice(0, -2).every(([px, py]) => Math.abs(px - nx) + Math.abs(py - ny) > 1) &&
          !path.some(([px, py]) => px === nx && py === ny),
      );
      if (!options.length) break;
      const score = ([nx, ny]: readonly [number, number]): number =>
        cells[ny * W + nx]!.e + 0.004 * edge(nx, ny);
      [x, y] = options.reduce((m, o) => (score(o) < score(m) ? o : m));
      path.push([x, y]);
      const c = cells[y * W + x]!;
      if (c.biome === 'lake' || onRiver.has(y * W + x) || edge(x, y) === 0) break;
    }
    const [ex, ey] = path.at(-1)!;
    const straight = Math.abs(ex - sx) + Math.abs(ey - sy);
    if (path.length > dials.minLength && path.length < dials.twist * straight + 4) {
      for (const [px, py] of path) onRiver.add(py * W + px);
      rivers.push({ name: geoName(rng, content.names, 'river'), path });
    }
  }
  return rivers;
}

/** Joined mountain cells of at least `ranges.min`, each named. */
export function nameRanges(
  rng: RngStream,
  content: EngineContent,
  cells: RegionCell[],
  W: number,
  H: number,
) {
  const { mountain } = content.region;
  const seen = new Uint8Array(cells.length);
  const ranges: RegionRange[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (seen[i] || cells[i]!.e <= mountain) continue;
    const group = [i];
    seen[i] = 1;
    for (let k = 0; k < group.length; k += 1) {
      const x = group[k]! % W;
      const y = (group[k]! - x) / W;
      for (const [dx, dy] of SIDES) {
        const nx = x + dx;
        const ny = y + dy;
        const j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[j] || cells[j]!.e <= mountain) continue;
        seen[j] = 1;
        group.push(j);
      }
    }
    if (group.length < content.region.ranges.min) continue;
    const top = group.reduce((m, j) => (cells[j]!.e > cells[m]!.e ? j : m));
    ranges.push({
      name: geoName(rng, content.names, 'range'),
      x: top % W,
      y: Math.floor(top / W),
      size: group.length,
    });
  }
  return ranges;
}

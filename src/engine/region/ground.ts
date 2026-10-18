// The region's ground from the Story Generator's world (P1.6): which window of that world the region
// shows, and its height, warmth, rain and biome at any point of the region grid. Biome edges are
// warped by noise so the world's coarse cells don't show as squares. Only + - * / and floor (V-006).
import type { EngineContent, RngStream } from '../core/index.ts';
import { clamp, noise } from './land.ts';
import type { RegionCell } from './region.ts';
import type { Site, WorldState } from './story.ts';

/** The part of the world the region shows, in world cells, and the live sites inside it. */
export interface Window {
  x0: number;
  y0: number;
  width: number;
  height: number;
  sites: Site[];
}

/** A point of the region grid as a world cell coordinate (fractional), and back. */
export const toWorld = (grid: number, g: number, span: number, at: number): number =>
  at + ((g + 0.5) * span) / grid - 0.5;
export const toGrid = (grid: number, c: number, span: number, at: number): number =>
  ((c - at + 0.5) * grid) / span - 0.5;

/** A site's main people: the culture of its biggest band. */
export const cultureOf = (s: Site): string =>
  s.pop.reduce((m, p) => (p.count > m.count ? p : m)).cultureId;
const live = (s: Site): boolean => s.ruinedYear === undefined && s.pop.some((p) => p.count > 0);

/**
 * The best windows, best first: six to eight live sites inside the region's site inset, at least two
 * peoples, mostly land, then as many peoples (up to three) and realms (up to four) as it can: border
 * country, where peoples meet, rather than one realm's heartland. Ties go to more land, then to the
 * first found scanning from the north-west. Windows within `apart` cells of a better one are
 * skipped, so the list offers different ground. A window holding more than the most sites keeps
 * the nearest its middle; the rest lie beyond the region's edge as far as the map is concerned.
 */
export function windows(world: WorldState, content: EngineContent): Window[] {
  const cells = world.cells!;
  const { frame: span, land: minLand, tries, apart } = content.region.world;
  const [width, height] = span as [number, number];
  const { grid, sites: S } = content.region;
  const [lo, hi] = S.count as [number, number];
  const W = cells.width;
  // Land cells in each rectangle by a summed table.
  const sum = new Int32Array((W + 1) * (cells.height + 1));
  for (let y = 0; y < cells.height; y += 1)
    for (let x = 0; x < W; x += 1)
      sum[(y + 1) * (W + 1) + x + 1] =
        (cells.water[y * W + x]! < 2 ? 1 : 0) +
        sum[y * (W + 1) + x + 1]! +
        sum[(y + 1) * (W + 1) + x]! -
        sum[y * (W + 1) + x]!;
  const landIn = (x0: number, y0: number): number =>
    sum[(y0 + height) * (W + 1) + x0 + width]! -
    sum[y0 * (W + 1) + x0 + width]! -
    sum[(y0 + height) * (W + 1) + x0]! +
    sum[y0 * (W + 1) + x0]!;
  const alive = [...world.sites.values()].filter(live).sort((a, b) => a.id - b.id);
  const scored: { win: Window; score: number }[] = [];
  for (let y0 = 0; y0 + height <= cells.height; y0 += 2)
    for (let x0 = 0; x0 + width <= W; x0 += 2) {
      const land = landIn(x0, y0) / (width * height);
      const win: Window = { x0, y0, width, height, sites: [] };
      win.sites = alive.filter((s) => {
        const gx = toGrid(grid.width, s.cell % W, width, x0);
        const gy = toGrid(grid.height, Math.floor(s.cell / W), height, y0);
        return (
          gx >= S.inset && gy >= S.inset && gx < grid.width - S.inset && gy < grid.height - S.inset
        );
      });
      // Over the most sites, the farthest from the middle are left off the map.
      const cx = x0 + width / 2;
      const cy = y0 + height / 2;
      const off = (s: Site): number =>
        Math.abs((s.cell % W) - cx) + Math.abs(Math.floor(s.cell / W) - cy);
      win.sites = win.sites.sort((a, b) => off(a) - off(b) || a.id - b.id).slice(0, hi);
      const miss = Math.max(0, lo - win.sites.length);
      const realms = new Set(win.sites.map((s) => s.civId)).size;
      const peoples = new Set(win.sites.map(cultureOf)).size;
      const score =
        -1000 * miss -
        (peoples < 2 ? 800 : 0) -
        (land < minLand ? 500 : 0) +
        20 * Math.min(peoples, 3) +
        10 * Math.min(realms, 4) +
        land;
      scored.push({ win, score });
    }
  // A stable sort keeps the scan order among equal scores.
  scored.sort((a, b) => b.score - a.score);
  const picked: Window[] = [];
  for (const { win } of scored) {
    if (picked.length === tries) break;
    if (picked.some((p) => Math.abs(p.x0 - win.x0) < apart && Math.abs(p.y0 - win.y0) < apart))
      continue;
    picked.push(win);
  }
  return picked;
}

/** The region's fields at any grid point: bilinear height, warmth and rain from the world cells
 * around it, and the biome of the world cell under a noise-warped point (sea and lakes are lake,
 * with no height); and `shift`, the warp seen from the grid, which bends the rivers to match. */
export function ground(
  world: WorldState,
  win: Window,
  content: EngineContent,
  rng: RngStream,
): {
  field: (x: number, y: number) => RegionCell & { index: number };
  shift: (x: number, y: number) => readonly [number, number];
} {
  const cells = world.cells!;
  const W = cells.width;
  const { grid } = content.region;
  const { metres, warp } = content.region.world;
  const biomes = content.biomes.biomes;
  const lake = biomes.findIndex((b) => b.id === 'lake');
  const wx = noise(rng, grid.width, grid.height, 4);
  const wy = noise(rng, grid.width, grid.height, 4);
  const at = (x: number, y: number): number =>
    clamp(Math.floor(y), 0, cells.height - 1) * W + clamp(Math.floor(x), 0, W - 1);
  const lerp = (field: ArrayLike<number>, x: number, y: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const v = (i: number, j: number): number => field[at(x0 + i, y0 + j)]!;
    const top = v(0, 0) + (v(1, 0) - v(0, 0)) * fx;
    const bottom = v(0, 1) + (v(1, 1) - v(0, 1)) * fx;
    return top + (bottom - top) * fy;
  };
  const warmth = Int16Array.from(cells.tempSummer, (s, i) => s + cells.tempWinter[i]!);
  // The warp at a grid point, in world cells: where the region looks in the world for its biome.
  const bend = (gx: number, gy: number): readonly [number, number] => [
    warp * 2 * (wx(gx, gy) - 0.5),
    warp * 2 * (wy(gx, gy) - 0.5),
  ];
  const field = (gx: number, gy: number) => {
    const x = toWorld(grid.width, gx, win.width, win.x0);
    const y = toWorld(grid.height, gy, win.height, win.y0);
    const [dx, dy] = bend(gx, gy);
    const cell = at(x + 0.5 + dx, y + 0.5 + dy);
    const wet = cells.water[cell]! >= 2;
    const index = wet ? lake : cells.biome[cell]!;
    const e = wet ? 0 : clamp(lerp(cells.elevation, x, y) / metres, 0.01, 1);
    return {
      e,
      t: lerp(warmth, x, y) / 2,
      r: lerp(cells.rainfall, x, y),
      biome: biomes[index]?.id ?? 'lake',
      index,
    };
  };
  // The same warp in grid cells, the other way: where a world feature (a river) shows on the grid.
  const shift = (gx: number, gy: number): readonly [number, number] => {
    const [dx, dy] = bend(gx, gy);
    return [(-dx * grid.width) / win.width, (-dy * grid.height) / win.height];
  };
  return { field, shift };
}

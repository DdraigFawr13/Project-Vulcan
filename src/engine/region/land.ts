// The region's small helpers: value noise (the biome-edge warp), clamping and the eight rays a
// valley's walls are looked for along. Only + - * / and floor (V-006).
import type { RngStream } from '../core/index.ts';

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

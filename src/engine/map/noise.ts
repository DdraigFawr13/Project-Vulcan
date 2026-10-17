// Smooth value noise for the map generator, from lattice values drawn off the caller's RNG stream.
// Only + - * / and floor, so every browser gives the same map (V-006).
import type { RngStream } from '../core/index.ts';

/** A field of values in [0, 1] over a width by height map. */
export type Field = (x: number, y: number) => number;

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** One octave: random values on a grid of `cell` tiles, blended smoothly between grid points. */
function octave(rng: RngStream, width: number, height: number, cell: number): Field {
  const across = Math.floor(width / cell) + 2;
  const down = Math.floor(height / cell) + 2;
  const lattice = new Array<number>(across * down);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rng.int(65_536) / 65_535;
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
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

/** Octaves at half the cell size and half the weight each, scaled back to [0, 1]. */
export function fractalNoise(
  rng: RngStream,
  width: number,
  height: number,
  cell: number,
  octaves: number,
): Field {
  const layers: { field: Field; weight: number }[] = [];
  let size = cell;
  let weight = 1;
  let total = 0;
  for (let i = 0; i < octaves && size >= 1; i += 1) {
    layers.push({ field: octave(rng, width, height, size), weight });
    total += weight;
    size /= 2;
    weight /= 2;
  }
  return (x, y) => {
    let sum = 0;
    for (const layer of layers) sum += layer.field(x, y) * layer.weight;
    return sum / total;
  };
}

/** Bakes a field into one value per tile, row by row. */
export function bake(field: Field, width: number, height: number): number[] {
  const out = new Array<number>(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) out[y * width + x] = field(x, y);
  return out;
}

/** The value below which `share` of `values` fall (0 to 1). */
export function quantile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.max(0, Math.floor(share * sorted.length)));
  return sorted[at]!;
}

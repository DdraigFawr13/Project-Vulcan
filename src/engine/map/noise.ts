// Smooth value noise for the map generator, from lattice values drawn off the caller's RNG stream.
// Only + - * / and floor, so every browser gives the same map (V-006).
import type { RngStream } from '../core/index.ts';
import { smooth } from '../core/index.ts';

/** A field of values in [0, 1] over a width by height map. */
export type Field = (x: number, y: number) => number;

// cos and sin of k * 22.5 degrees, k = 0 to 15.
const C1 = 0.9238795325;
const C2 = 0.7071067812;
const C3 = 0.3826834324;
export const AXES: readonly (readonly [number, number])[] = [
  [1, 0],
  [C1, C3],
  [C2, C2],
  [C3, C1],
  [0, 1],
  [-C3, C1],
  [-C2, C2],
  [-C1, C3],
  [-1, 0],
  [-C1, -C3],
  [-C2, -C2],
  [-C3, -C1],
  [0, -1],
  [C3, -C1],
  [C2, -C2],
  [C1, -C3],
];

/** One octave: random values on a grid of `cell` tiles, blended smoothly between grid points. */
function octave(rng: RngStream, width: number, height: number, cell: number): Field {
  const across = Math.floor(width / cell) + 2;
  const down = Math.floor(height / cell) + 2;
  const lattice = new Float64Array(across * down);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rng.int(65_536) / 65_535;
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smooth(gx - x0);
    const fy = smooth(gy - y0);
    const k = y0 * across + x0;
    const a = lattice[k]!;
    const b = lattice[k + 1]!;
    const c = lattice[k + across]!;
    const d = lattice[k + across + 1]!;
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
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

/** The value below which `share` of `values` fall (0 to 1): the k-th smallest, found by
 * selection in a typed copy (no full sort; the 250-tile map calls it a dozen times, V-202). */
export function quantile(values: ArrayLike<number>, share: number): number {
  const a = Float64Array.from(values);
  const k = Math.min(a.length - 1, Math.max(0, Math.floor(share * a.length)));
  let [lo, hi] = [0, a.length - 1];
  while (lo < hi) {
    const pivot = a[(lo + hi) >> 1]!;
    let [i, j] = [lo, hi];
    while (i <= j) {
      while (a[i]! < pivot) i += 1;
      while (a[j]! > pivot) j -= 1;
      if (i <= j) {
        [a[i], a[j]] = [a[j]!, a[i]!];
        i += 1;
        j -= 1;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return a[k]!;
}

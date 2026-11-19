// Small sums every system shares: integer-safe and free of transcendental Math (V-006).
import type { RngStream } from './rng.ts';

/** `v` held between `lo` and `hi`. */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The smoothstep ease from 0 to 1. */
export const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Steps between two tiles when a diagonal counts as one (Chebyshev distance). */
export const cheb = <T extends { x: number; y: number }>(a: T, b: T): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Distance in whole tiles, near enough to round: the long side plus half the short (no roots). */
export const roughDistance = (dx: number, dy: number): number => {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  return a > b ? a + (b >> 1) : b + (a >> 1);
};

/** `n` six-sided dice, centred on 0 (their mean taken off). */
export const dice = (rng: RngStream, n: number): number => {
  let sum = 0;
  for (let k = 0; k < n; k += 1) sum += rng.between(1, 6);
  return sum - Math.floor((7 * n) / 2);
};

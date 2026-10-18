// Valley names and bearings for the region: a valley named in its neighbours' tongue, and compass
// words and walking distances with no roots or trigonometry.
import type { CultureDef, RngStream } from '../core/index.ts';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** A valley name in its nearest neighbours' tongue ("Cwm Teglfawr", "Glen Torrnach"). */
export function valeName(rng: RngStream, culture: CultureDef, patterns: readonly string[]): string {
  for (let tries = 0; ; tries += 1) {
    const n = cap(rng.pick(culture.names.placeStarts) + rng.pick(culture.names.placeEnds));
    if (n.length <= 9 || tries > 20) return rng.pick(patterns).replace('{n}', n);
  }
}

/** Grid cells as a walker counts them: the long side plus half the short (no square roots). */
export const dayDistance = (dx: number, dy: number): number => {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  return Math.max(a, b) + Math.min(a, b) / 2;
};

/** The compass word for a step of (dx, dy), y growing southward: eight sectors split at about
 * 22.5 degrees, where one side is under 2/5 of the other. */
export function compass(dx: number, dy: number): string {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  const ns = dy < 0 ? 'north' : 'south';
  const ew = dx < 0 ? 'west' : 'east';
  if (b * 5 <= a * 2) return ew;
  if (a * 5 <= b * 2) return ns;
  return `${ns}-${ew}`;
}

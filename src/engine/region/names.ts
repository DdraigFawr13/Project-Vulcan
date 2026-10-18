// Names and bearings for the region: places from a culture's syllables, ranges and rivers from the
// forked names patterns, and compass words and walking distances with no roots or trigonometry.
import type { CultureDef, NamesDef, RngStream } from '../core/index.ts';

/** Longer names are drawn again, so labels stay short enough for a phone map. */
const MAX = 11;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** A settlement name from its culture: start, sometimes a middle after a short start, end. */
export function placeName(rng: RngStream, culture: CultureDef): string {
  const n = culture.names;
  for (let tries = 0; ; tries += 1) {
    let name = rng.pick(n.placeStarts);
    if (name.length < 5 && rng.chance(0.35)) name += rng.pick(n.placeMiddles);
    name = cap(name + rng.pick(n.placeEnds));
    if (name.length <= MAX || tries > 20) return name;
  }
}

/** A range or river name from the names.json patterns of that kind ("the {a}teeth", "River {n}"). */
export function geoName(rng: RngStream, names: NamesDef, kind: string): string {
  const pattern = rng.pick(names.patterns[kind] ?? ['{n}']);
  let n = '';
  for (let tries = 0; n === '' || (n.length > MAX - 1 && tries < 20); tries += 1) {
    const middle = rng.chance(0.4) ? rng.pick(names.middles) : '';
    n = cap(rng.pick(names.starts) + middle + rng.pick(names.ends));
  }
  return pattern.replace('{n}', n).replace('{a}', rng.pick(names.adjectives));
}

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

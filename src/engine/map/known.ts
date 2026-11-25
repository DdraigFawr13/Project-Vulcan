// Known land (6W Slice 4, V-205): the colony works only ground it has seen. A colonist on the
// surface sees `sight` tiles round them (`high` from a height), and what they see stays known; a
// scout's sightings are held (2) until they come home and tell of them. Work looks in its reach
// round the store and round each find (`workAreas`), at known tiles only (`isKnown`).
import type { EngineContent, MapState } from '../core/index.ts';
import { atLookout, foundAreas } from './places.ts';

/** A square of ground work looks in: its middle and how far it reaches either way. */
export type Area = readonly [x: number, y: number, r: number];

/** Whether surface tile `i` is known: seen, or told of by a scout who came home. */
export const isKnown = (map: MapState, i: number): boolean => map.known[i] === 1;

/** Whether surface tile `i` is known ground with nothing growing or lying on it. */
export const bareKnown = (map: MapState, i: number): boolean =>
  !map.features[i] && map.known[i] === 1;

/** Squares already marked known, per known array: known ground never becomes unknown (a lost
 * scout forgets only what was held, 2), so marking one again changes nothing and is skipped. */
const marked = new WeakMap<Uint8Array, Set<number>>();

/** Marks the square of `r` round (x, y): known, or (`away`) held for a scout where unseen. */
function mark(map: MapState, x: number, y: number, r: number, away: boolean): void {
  const w = map.width;
  if (!away) {
    let done = marked.get(map.known);
    if (!done) marked.set(map.known, (done = new Set()));
    const key = (r * map.height + y) * w + x;
    if (done.has(key)) return;
    done.add(key);
  }
  for (let yy = Math.max(0, y - r); yy <= Math.min(map.height - 1, y + r); yy += 1)
    for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx += 1) {
      const i = yy * w + xx;
      if (map.known[i] === 1) continue;
      if (!away) map.known[i] = 1;
      else if (!map.known[i]) map.known[i] = 2;
    }
}

/** The ground the band saw round the green while choosing it: `arrive` tiles. */
export function knownOnArrival(content: EngineContent, map: MapState): Uint8Array {
  map.known = new Uint8Array(map.width * map.height);
  mark(map, map.startX, map.startY, content.terrain.generator.known.arrive, false);
  return map.known;
}

/** What someone on the surface at (x, y) sees: `sight` tiles, or `high` when they stand `height`
 * metres above the green; a scout's (`away`) counts when they are home. */
export function see(
  content: EngineContent,
  map: MapState,
  x: number,
  y: number,
  away: boolean,
): void {
  const d = content.terrain.generator.known;
  const w = map.width;
  const up = map.elevation[y * w + x]! - map.elevation[map.startY * w + map.startX]!;
  const r = up >= d.height ? d.high : d.sight;
  // A found lookout (V-206): whoever stands there sees twice as far.
  mark(map, x, y, up >= d.height && atLookout(content, map, x, y) ? 2 * r : r, away);
}

/** A scout is home: what they saw becomes known. Returns the tiles told of. */
export function tellSeen(map: MapState): number {
  let n = 0;
  for (let i = 0; i < map.known.length; i += 1)
    if (map.known[i] === 2) {
      map.known[i] = 1;
      n += 1;
    }
  return n;
}

/** A scout lost: what they saw is lost with them. */
export function forgetSeen(map: MapState): void {
  for (let i = 0; i < map.known.length; i += 1) if (map.known[i] === 2) map.known[i] = 0;
}

/** Where work looks: `reach` round (ox, oy), then `place` round each find (a trip whose news
 * counted at least `least` sources, V-205), in the order they were found, then each found old
 * wood (V-206). */
export function workAreas(
  content: EngineContent,
  map: MapState,
  ox: number,
  oy: number,
  reach: number,
): Area[] {
  const { place, least } = content.terrain.generator.known;
  const areas: Area[] = [[ox, oy, reach]];
  for (const f of map.finds) if (f.count >= least) areas.push([f.x, f.y, place]);
  // Found old woods are worked however far off, as a scout's find is (V-206).
  return areas.concat(foundAreas(content, map, 'work', place));
}

/** Whether (x, y) lies in one of `areas` (only the first `upTo` of them, when set). */
export function inAreas(
  areas: readonly Area[],
  x: number,
  y: number,
  upTo = areas.length,
): boolean {
  for (let k = 0; k < upTo; k += 1) {
    const [cx, cy, r] = areas[k]!;
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= r) return true;
  }
  return false;
}

/** Visits each known tile of `areas` once, area by area, row by row. */
export function eachKnown(
  map: MapState,
  areas: readonly Area[],
  visit: (i: number, x: number, y: number) => void,
): void {
  const w = map.width;
  areas.forEach(([cx, cy, r], k) => {
    for (let y = Math.max(0, cy - r); y <= Math.min(map.height - 1, cy + r); y += 1)
      for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x += 1) {
        const i = y * w + x;
        if (map.known[i] === 1 && !inAreas(areas, x, y, k)) visit(i, x, y);
      }
  });
}

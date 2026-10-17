// The water done-whens (docs/phases/PHASE_1.md P1.2), read off a finished map by the tests and
// `npm run map:stats`.
import type { EngineContent, MapState } from '../core/index.ts';
import { LAKE } from './water.ts';

/** Drinkable tiles in the square of `radius` tiles around the start. */
export function waterNearStart(content: EngineContent, map: MapState, radius: number): number {
  let count = 0;
  for (
    let y = Math.max(0, map.startY - radius);
    y <= Math.min(map.height - 1, map.startY + radius);
    y += 1
  )
    for (
      let x = Math.max(0, map.startX - radius);
      x <= Math.min(map.width - 1, map.startX + radius);
      x += 1
    )
      if (content.terrain.kinds[map.tiles[y * map.width + x]!]!.drinkable) count += 1;
  return count;
}

/**
 * Water tiles of a river, stream or spring that no edge-to-edge path through water joins to the
 * map's edge or a lake: a course that ends inland. Should be 0.
 */
export function strandedWater(map: MapState): number {
  const { width, height, water } = map;
  const reached = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width;
    const y = (i - x) / width;
    const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (water[i] === LAKE || (water[i] && edge)) {
      reached[i] = 1;
      queue.push(i);
    }
  }
  for (let q = 0; q < queue.length; q += 1) {
    const i = queue[q]!;
    const x = i % width;
    for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width])
      if (j >= 0 && j < width * height && water[j] && !reached[j]) {
        reached[j] = 1;
        queue.push(j);
      }
  }
  let stranded = 0;
  for (let i = 0; i < width * height; i += 1) if (water[i] && !reached[i]) stranded += 1;
  return stranded;
}

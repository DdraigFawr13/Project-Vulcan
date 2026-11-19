// Grids the field and pasture searches read: tiles beside a house or store, how far each tile is
// from water (P5.4b), and running counts of set cells in any rectangle.
import type { EngineContent, WorldState } from '../core/index.ts';
import { depotsOf } from '../goods/index.ts';
import { housesOf, rectOf } from './site.ts';

/** Tiles on or beside a house (or its plan) not sent back, or on or beside a store: left alone. */
export function besideBuilt(world: WorldState): Set<number> {
  const { width } = world.map;
  const near = new Set<number>();
  const rects = [
    ...housesOf(world)
      .filter((r) => r['state'] !== 'sent')
      .map(rectOf),
    ...depotsOf(world).map((d) => ({
      x: d['x'] as number,
      y: d['y'] as number,
      w: d['w'] as number,
      h: d['h'] as number,
    })),
  ];
  for (const r of rects)
    for (let y = r.y - 1; y <= r.y + r.h; y += 1)
      for (let x = r.x - 1; x <= r.x + r.w; x += 1) near.add(y * width + x);
  return near;
}

/** Chebyshev distance to the nearest water tile, up to `limit` (limit + 1 beyond), for every
 * tile of the map; a breadth-first sweep from the water tiles. */
export function waterReach(world: WorldState, content: EngineContent, limit: number): Uint8Array {
  const map = world.map;
  const dist = new Uint8Array(map.width * map.height).fill(limit + 1);
  let edge: number[] = [];
  for (let i = 0; i < dist.length; i += 1)
    if (content.terrain.kinds[map.tiles[i]!]!.water) {
      dist[i] = 0;
      edge.push(i);
    }
  for (let d = 1; d <= limit; d += 1) {
    const next: number[] = [];
    for (const i of edge)
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const [x, y] = [(i % map.width) + dx, Math.floor(i / map.width) + dy];
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          const j = y * map.width + x;
          if (dist[j]! <= d) continue;
          dist[j] = d;
          next.push(j);
        }
    edge = next;
  }
  return dist;
}

/** Counts the set cells of a grid in any rectangle at once (a running sum); a rectangle off the
 * map counts as full. */
export function counter(cells: Uint8Array, width: number, height: number) {
  const sum = new Int32Array((width + 1) * (height + 1));
  const at = (x: number, y: number) => y * (width + 1) + x;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      sum[at(x + 1, y + 1)] =
        cells[y * width + x]! + sum[at(x + 1, y)]! + sum[at(x, y + 1)]! - sum[at(x, y)]!;
  return (x: number, y: number, w: number, h: number): number =>
    x < 0 || y < 0 || x + w > width || y + h > height
      ? w * h
      : sum[at(x + w, y + h)]! - sum[at(x + w, y)]! - sum[at(x, y + h)]! + sum[at(x, y)]!;
}

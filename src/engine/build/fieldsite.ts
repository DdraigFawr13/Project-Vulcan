// Siting a field (P4.7, V-049, V-051, V-053): colonists choose where a field goes and how big it
// is; the player only says the colony needs fields. A field is one compact block, a rectangle as
// near square as fits, every tile good soil outside the town ring and within `field.reach` of the
// green. Blocks are scored by how close they lie to the ring's edge (weighed strongly), then
// average fertility and distance to water; ties go in tile order, so the same seed gives the
// same fields. Nothing is drawn from a stream.
import type { EngineContent, WorldState } from '../core/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import { groundOf, housesOf, rectOf, type Ground } from './site.ts';
import { granaryOf } from '../goods/index.ts';
import { ringOf } from './ring.ts';

export interface FieldSite {
  tiles: number[];
  /** Tiles with a tree or log to fell first. */
  trees: number[];
  /** The block's average fertility, its nearest tile's distance from the green and from water
   * (more than `field.water` when none is near). */
  fert: number;
  far: number;
  wet: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Tiles within `limit` of water (Chebyshev), with their distance, over the box. */
function waterDistance(
  world: WorldState,
  content: EngineContent,
  box: Box,
  limit: number,
): Map<number, number> {
  const map = world.map;
  const dist = new Map<number, number>();
  let edge: number[] = [];
  for (let y = box.y0; y <= box.y1; y += 1)
    for (let x = box.x0; x <= box.x1; x += 1) {
      const i = y * map.width + x;
      if (!content.terrain.kinds[map.tiles[i]!]!.water) continue;
      dist.set(i, 0);
      edge.push(i);
    }
  for (let d = 1; d <= limit; d += 1) {
    const next: number[] = [];
    for (const i of edge)
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const [x, y] = [(i % map.width) + dx, Math.floor(i / map.width) + dy];
          if (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) continue;
          const j = y * map.width + x;
          if (dist.has(j)) continue;
          dist.set(j, d);
          next.push(j);
        }
    edge = next;
  }
  return dist;
}

/** Rectangle shapes (width, height) holding at least `least` and at most `n` tiles, as near
 * square as fits, biggest first: a field of 30 tiles is 6 by 5, one of 29 tiles 6 by 4. */
function shapes(n: number, least: number): [number, number][] {
  const out: [number, number][] = [];
  for (let size = n; size >= least; size -= 1) {
    let w = 1;
    while (w * w < size) w += 1;
    const h = Math.ceil(size / w);
    // Keep to at most `n` tiles: trim the longer side if the rounding went over.
    const shape: [number, number] = w * h <= n ? [w, h] : [w, h - 1];
    if (shape[0] * shape[1] >= least && !out.some((o) => o[0] === shape[0] && o[1] === shape[1]))
      out.push(shape);
  }
  return out;
}

/** The nearest block of good soil outside the ring that holds at least `field.least` and, if the
 * soil allows, `want` tiles, or undefined. `avoid` are tiles never chosen (fields sent back). */
export function chooseField(
  world: WorldState,
  content: EngineContent,
  green: Spot,
  want: number,
  avoid: ReadonlySet<number>,
): FieldSite | undefined {
  const map = world.map;
  const def = content.buildings.field;
  const ring = ringOf(world, content);
  const ground: Ground = groundOf(world);
  // Tiles on or beside a house (or its plan) are left alone; so is a granary.
  const houses = new Set<number>();
  for (const h of housesOf(world).filter((r) => r['state'] !== 'sent')) {
    const r = rectOf(h);
    for (let y = r.y - 1; y <= r.y + r.h; y += 1)
      for (let x = r.x - 1; x <= r.x + r.w; x += 1) houses.add(y * map.width + x);
  }
  for (const g of granaryOf(world)) houses.add((g['y'] as number) * map.width + (g['x'] as number));
  const far = (i: number) =>
    Math.max(Math.abs((i % map.width) - green.x), Math.abs(Math.floor(i / map.width) - green.y));
  /** `no`, a tree to fell first, or open good soil, for a tile that may be field. */
  const fit = (i: number): 'no' | 'tree' | 'ok' => {
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return 'no';
    const d = far(i);
    if (d <= ring || d > def.reach || avoid.has(i) || houses.has(i)) return 'no';
    if (map.fertility[i]! < def.good) return 'no';
    const kind = content.terrain.kinds[map.tiles[i]!]!;
    if (!kind.buildable || kind.water || kind.solid || map.built[i]) return 'no';
    if (ground.items.has(i) || ground.taken.has(i)) return 'no';
    const f = map.features[i]! ? content.features[map.features[i]! - 1]!.kind : '';
    if (f === 'tree' || f === 'log') return 'tree';
    return f ? 'no' : 'ok';
  };
  const pad = def.reach + def.water;
  const box = {
    x0: Math.max(0, green.x - pad),
    y0: Math.max(0, green.y - pad),
    x1: Math.min(map.width - 1, green.x + pad),
    y1: Math.min(map.height - 1, green.y + pad),
  };
  const wet = waterDistance(world, content, box, def.water);
  // What each tile of the search area is, once.
  const lo = { x: Math.max(1, green.x - def.reach), y: Math.max(1, green.y - def.reach) };
  const hi = { x: green.x + def.reach, y: green.y + def.reach };
  const kinds = new Map<number, 'tree' | 'ok'>();
  for (let y = lo.y; y <= hi.y; y += 1)
    for (let x = lo.x; x <= hi.x; x += 1) {
      const i = y * map.width + x;
      const k = fit(i);
      if (k !== 'no') kinds.set(i, k);
    }
  const w = def.weigh;
  const target = Math.max(want, def.least);
  for (const [bw, bh] of shapes(target, def.least)) {
    // Every origin whose block is all good soil, scored; best first, ties in tile order.
    const blocks: { i: number; score: number; tiles: number[] }[] = [];
    for (let y = lo.y; y + bh - 1 <= hi.y; y += 1)
      for (let x = lo.x; x + bw - 1 <= hi.x; x += 1) {
        const tiles: number[] = [];
        for (let dy = 0; dy < bh && tiles.length === dy * bw; dy += 1)
          for (let dx = 0; dx < bw; dx += 1) {
            const i = (y + dy) * map.width + x + dx;
            if (!kinds.has(i)) break;
            tiles.push(i);
          }
        if (tiles.length < bw * bh) continue;
        const gap = Math.min(...tiles.map(far)) - ring - 1;
        const fert = Math.round(tiles.reduce((n, i) => n + map.fertility[i]!, 0) / tiles.length);
        const water = Math.min(...tiles.map((i) => wet.get(i) ?? def.water + 1));
        const trees = tiles.filter((i) => kinds.get(i) === 'tree').length;
        blocks.push({
          i: y * map.width + x,
          score: fert * w.fertility - water * w.water - gap * w.near - trees,
          tiles,
        });
      }
    blocks.sort((a, b) => b.score - a.score || a.i - b.i);
    for (const b of blocks.slice(0, w.tries)) {
      const at = { x: b.tiles[0]! % map.width, y: Math.floor(b.tiles[0]! / map.width), z: 0 };
      if (!canReach(content, map, green, at)) continue;
      const water = Math.min(...b.tiles.map((i) => wet.get(i) ?? def.water + 1));
      return {
        tiles: b.tiles,
        trees: b.tiles.filter((i) => kinds.get(i) === 'tree'),
        fert: Math.round(b.tiles.reduce((n, i) => n + map.fertility[i]!, 0) / b.tiles.length),
        far: Math.min(...b.tiles.map(far)),
        wet: water,
      };
    }
  }
  return undefined;
}

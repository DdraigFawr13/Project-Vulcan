// Siting a field (P4.7, V-049, V-051, V-053): colonists choose where a field goes and how big it
// is; the player only says the colony needs fields. Open surface tiles outside the town ring and
// within `field.reach` of the green are scored by fertility and distance to water; the best seed
// tile is grown into a connected region over good soil, best first. Nothing is drawn from a
// stream: ties go in tile order, so the same seed gives the same fields.
import type { EngineContent, WorldState } from '../core/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import { groundOf, housesOf, rectOf, type Ground } from './site.ts';
import { ringOf } from './ring.ts';

export interface FieldSite {
  tiles: number[];
  /** Tiles with a tree or log to fell first. */
  trees: number[];
  /** The seed tile's fertility, tiles from the green and tiles from water. */
  fert: number;
  far: number;
  wet: number;
}

/** Seed tiles tried, best first, before giving up. */
const NEIGHBOURS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;

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

/** The best field of at least `field.least` and, if the soil allows, `want` tiles, or undefined.
 * `avoid` are tiles never chosen (fields sent back). */
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
  // Tiles on or beside a house (or its plan) are left alone.
  const houses = new Set<number>();
  for (const h of housesOf(world).filter((r) => r['state'] !== 'sent')) {
    const r = rectOf(h);
    for (let y = r.y - 1; y <= r.y + r.h; y += 1)
      for (let x = r.x - 1; x <= r.x + r.w; x += 1) houses.add(y * map.width + x);
  }
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
  // Seed tiles: open good soil with water near; best score first, then nearer the green, then
  // tile order.
  const seeds: { i: number; score: number; d: number }[] = [];
  for (let y = Math.max(1, green.y - def.reach); y <= green.y + def.reach; y += 1)
    for (let x = Math.max(1, green.x - def.reach); x <= green.x + def.reach; x += 1) {
      const i = y * map.width + x;
      const w = wet.get(i);
      if (w === undefined || fit(i) !== 'ok') continue;
      seeds.push({
        i,
        score: map.fertility[i]! * def.weigh.fertility - w * def.weigh.water - far(i),
        d: far(i),
      });
    }
  seeds.sort((a, b) => b.score - a.score || a.d - b.d || a.i - b.i);
  const target = Math.max(want, def.least);
  let best: FieldSite | undefined;
  for (const seed of seeds.slice(0, def.weigh.tries)) {
    const at = { x: seed.i % map.width, y: Math.floor(seed.i / map.width), z: 0 };
    if (!canReach(content, map, green, at)) continue;
    const tiles = [seed.i];
    const taken = new Set(tiles);
    const edge: number[] = [];
    const reach = (i: number) => {
      for (const [dx, dy] of NEIGHBOURS) {
        const j = i + dy * map.width + dx;
        if (!taken.has(j) && !edge.includes(j) && fit(j) !== 'no') edge.push(j);
      }
    };
    reach(seed.i);
    while (tiles.length < target && edge.length) {
      // Open ground before a tree to fell, then best fertility first, ties in tile order.
      const rank = (i: number) => (fit(i) === 'ok' ? 1000 : 0) + map.fertility[i]!;
      let pick = 0;
      for (let k = 1; k < edge.length; k += 1) {
        const [a, b] = [edge[k]!, edge[pick]!];
        if (rank(a) > rank(b) || (rank(a) === rank(b) && a < b)) pick = k;
      }
      const [i] = edge.splice(pick, 1);
      tiles.push(i!);
      taken.add(i!);
      reach(i!);
    }
    if (tiles.length < def.least) continue;
    if (!best || tiles.length > best.tiles.length)
      best = {
        tiles,
        trees: tiles.filter((i) => fit(i) === 'tree'),
        fert: map.fertility[seed.i]!,
        far: far(seed.i),
        wet: wet.get(seed.i)!,
      };
    if (tiles.length >= target) break;
  }
  return best;
}

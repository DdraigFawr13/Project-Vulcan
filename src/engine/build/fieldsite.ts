// Siting a field (P4.7, V-049, V-051, V-053): colonists choose where a field goes and how big it
// is; the player only says the colony needs fields. A field is one compact block, a rectangle as
// near square as fits, every tile good soil outside the town ring and within `field.reach` of the
// green. Blocks are scored by how close they lie to the ring's edge (weighed strongly), then
// average fertility and distance to water; ties go in tile order, so the same seed gives the
// same fields. Nothing is drawn from a stream.
import type { EngineContent, WorldState } from '../core/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import { groundOf, type Ground } from './site.ts';
import { besideBuilt } from './sitegrid.ts';
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

/** What every block is weighed against: the green, the ring and each tile's fitness and water. */
interface FieldSurvey {
  world: WorldState;
  content: EngineContent;
  green: Spot;
  def: EngineContent['buildings']['field'];
  ring: number;
  lo: { x: number; y: number };
  hi: { x: number; y: number };
  kinds: Map<number, 'tree' | 'ok'>;
  wet: Map<number, number>;
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
  const s = surveyField(world, content, green, avoid);
  const target = Math.max(want, s.def.least);
  for (const [bw, bh] of shapes(target, s.def.least)) {
    const blocks = blocksOf(s, bw, bh);
    blocks.sort((a, b) => b.score - a.score || a.i - b.i);
    const site = blocks.slice(0, s.def.weigh.tries).find((b) => reachable(s, b.tiles));
    if (site) return fieldFrom(s, site.tiles);
  }
  return undefined;
}

/** Chebyshev distance from the green. */
const farOf = (s: FieldSurvey, i: number): number => {
  const width = s.world.map.width;
  return Math.max(Math.abs((i % width) - s.green.x), Math.abs(Math.floor(i / width) - s.green.y));
};

/** What each tile of the search area is, once, and how far the water is. */
function surveyField(
  world: WorldState,
  content: EngineContent,
  green: Spot,
  avoid: ReadonlySet<number>,
): FieldSurvey {
  const map = world.map;
  const def = content.buildings.field;
  const ring = ringOf(world, content);
  const pad = def.reach + def.water;
  const box = {
    x0: Math.max(0, green.x - pad),
    y0: Math.max(0, green.y - pad),
    x1: Math.min(map.width - 1, green.x + pad),
    y1: Math.min(map.height - 1, green.y + pad),
  };
  const wet = waterDistance(world, content, box, def.water);
  const lo = { x: Math.max(1, green.x - def.reach), y: Math.max(1, green.y - def.reach) };
  const hi = { x: green.x + def.reach, y: green.y + def.reach };
  const s: FieldSurvey = { world, content, green, def, ring, lo, hi, kinds: new Map(), wet };
  const fit = fitTest(s, avoid);
  for (let y = lo.y; y <= hi.y; y += 1)
    for (let x = lo.x; x <= hi.x; x += 1) {
      const i = y * map.width + x;
      const k = fit(i);
      if (k !== 'no') s.kinds.set(i, k);
    }
  return s;
}

/** `no`, a tree to fell first, or open good soil, for a tile that may be field. */
function fitTest(s: FieldSurvey, avoid: ReadonlySet<number>) {
  const map = s.world.map;
  const ground: Ground = groundOf(s.world);
  // Tiles on or beside a house (or its plan) are left alone; so are those on or beside a store.
  const houses = besideBuilt(s.world);
  return (i: number): 'no' | 'tree' | 'ok' => {
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return 'no';
    const d = farOf(s, i);
    if (d <= s.ring || d > s.def.reach || avoid.has(i) || houses.has(i)) return 'no';
    if (ground.items.has(i) || ground.taken.has(i)) return 'no';
    return soilAt(s, i);
  };
}

/** Good, open, buildable soil (`ok`), a tree or log on it (`tree`), or `no`. */
function soilAt(s: FieldSurvey, i: number): 'no' | 'tree' | 'ok' {
  const { map } = s.world;
  if (map.fertility[i]! < s.def.good) return 'no';
  const kind = s.content.terrain.kinds[map.tiles[i]!]!;
  if (!kind.buildable || kind.water || kind.solid || map.built[i]) return 'no';
  const f = map.features[i]! ? s.content.features[map.features[i]! - 1]!.kind : '';
  if (f === 'tree' || f === 'log') return 'tree';
  return f ? 'no' : 'ok';
}

/** Every origin whose `bw` by `bh` block is all good soil, scored. */
function blocksOf(s: FieldSurvey, bw: number, bh: number) {
  const width = s.world.map.width;
  const blocks: { i: number; score: number; tiles: number[] }[] = [];
  for (let y = s.lo.y; y + bh - 1 <= s.hi.y; y += 1)
    for (let x = s.lo.x; x + bw - 1 <= s.hi.x; x += 1) {
      const tiles = blockTiles(s, x, y, bw, bh);
      if (tiles.length < bw * bh) continue;
      blocks.push({ i: y * width + x, score: scoreOf(s, tiles), tiles });
    }
  return blocks;
}

/** The block's tiles in row order, stopping at the first that is not soil. */
function blockTiles(s: FieldSurvey, x: number, y: number, bw: number, bh: number): number[] {
  const width = s.world.map.width;
  const tiles: number[] = [];
  for (let dy = 0; dy < bh && tiles.length === dy * bw; dy += 1)
    for (let dx = 0; dx < bw; dx += 1) {
      const i = (y + dy) * width + x + dx;
      if (!s.kinds.has(i)) break;
      tiles.push(i);
    }
  return tiles;
}

const fertOf = (s: FieldSurvey, tiles: readonly number[]): number =>
  Math.round(tiles.reduce((n, i) => n + s.world.map.fertility[i]!, 0) / tiles.length);
const waterOf = (s: FieldSurvey, tiles: readonly number[]): number =>
  Math.min(...tiles.map((i) => s.wet.get(i) ?? s.def.water + 1));
const treesIn = (s: FieldSurvey, tiles: readonly number[]): number[] =>
  tiles.filter((i) => s.kinds.get(i) === 'tree');

function scoreOf(s: FieldSurvey, tiles: readonly number[]): number {
  const w = s.def.weigh;
  const gap = Math.min(...tiles.map((i) => farOf(s, i))) - s.ring - 1;
  return (
    fertOf(s, tiles) * w.fertility -
    waterOf(s, tiles) * w.water -
    gap * w.near -
    treesIn(s, tiles).length
  );
}

function reachable(s: FieldSurvey, tiles: readonly number[]): boolean {
  const width = s.world.map.width;
  const at = { x: tiles[0]! % width, y: Math.floor(tiles[0]! / width), z: 0 };
  return canReach(s.content, s.world.map, s.green, at);
}

function fieldFrom(s: FieldSurvey, tiles: number[]): FieldSite {
  return {
    tiles,
    trees: treesIn(s, tiles),
    fert: fertOf(s, tiles),
    far: Math.min(...tiles.map((i) => farOf(s, i))),
    wet: waterOf(s, tiles),
  };
}

// Siting a pasture (P5.4b, V-041, V-049): the colony chooses where it goes; the player only says
// how much it wants one. A rectangle (flock.pasture w by h, hurdles included), a hay meadow
// beside it and the rick's tile, all open surface ground outside the town ring, the rectangle's
// centre within `reach` of the green and water within `water` tiles of it. Every origin is
// scored, never drawn from a stream, lowest first: `near` x its gap from the ring, `water` x its
// distance to water, `herd` x its centre's distance to the nearest wild tame-species herd; ties
// go in tile order, so the same seed gives the same pasture. The geometry (fold corner, gates,
// meadow and rick) is worked out here and stored in the pasture row (pasturerows.ts).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { depotsOf } from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import { burialsOf } from './burial.ts';
import { foldRect, foldWall, onPastureGround, pastureTiles, pasturesOf } from './pasturerows.ts';
import { ringOf } from './ring.ts';
import { groundOf, housesOf, rectOf } from './site.ts';
import { smithiesOf } from './smithy.ts';
import { isTreeAt } from './way.ts';

/** What `choosePasture` returns: the row's geometry, and the reason. */
export interface PastureSite {
  x: number;
  y: number;
  w: number;
  h: number;
  corner: string;
  gate: number;
  foldGate: number;
  mx: number;
  my: number;
  mw: number;
  mh: number;
  rick: number;
  /** Tiles with a tree or log to fell first. */
  trees: number[];
  far: number;
  wet: number;
  herd: EntityRow;
}

/** The wild herds of the tame species with an animal left (the kept herds are not wild). */
export function wildHerds(world: WorldState, content: EngineContent): EntityRow[] {
  const alive = new Set((world.entities['animal'] ?? []).map((a) => a['herd'] as number));
  return (world.entities['herd'] ?? []).filter(
    (h) =>
      !h['kept'] && alive.has(h.id) && content.flock.tame.species.includes(h['species'] as string),
  );
}

const cheb = (a: Spot, x: number, y: number): number =>
  Math.max(Math.abs(a.x - x), Math.abs(a.y - y));

/** The side of the rectangle that faces the green: the axis the green lies furthest along. */
function facing(r: { x: number; y: number; w: number; h: number }, green: Spot): string {
  const dx = 2 * green.x - (2 * r.x + r.w - 1);
  const dy = 2 * green.y - (2 * r.y + r.h - 1);
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'w' : 'e') : dy < 0 ? 'n' : 's';
}

/** The tiles of one rectangle side in order along it, ends excluded (the corners). */
function sideTiles(r: { x: number; y: number; w: number; h: number }, side: string): number[][] {
  const out: number[][] = [];
  if (side === 'n' || side === 's')
    for (let x = r.x + 1; x < r.x + r.w - 1; x += 1)
      out.push([x, side === 'n' ? r.y : r.y + r.h - 1]);
  else
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 1)
      out.push([side === 'w' ? r.x : r.x + r.w - 1, y]);
  return out;
}

/** The outer gate's tile: the middle of the green-facing side, moved along it to the nearest tile
 * that opens onto grazing ground (not onto the fold or the end of a fold wall). */
function outerGate(row: EntityRow, green: Spot, width: number): number {
  const r = {
    x: row['x'] as number,
    y: row['y'] as number,
    w: row['w'] as number,
    h: row['h'] as number,
  };
  const side = facing(r, green);
  const tiles = sideTiles(r, side);
  const mid = Math.floor(tiles.length / 2);
  const [ix, iy] = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[side]!;
  const f = foldRect(row);
  const grazing = (x: number, y: number): boolean =>
    !foldWall(row, x, y) && !(x >= f.x && y >= f.y && x < f.x + f.w && y < f.y + f.h);
  // The middle tile, else the next along the side whose inner neighbour is grazing ground.
  const at = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5].map((o) => tiles[mid + o]);
  const [x, y] = at.find((t) => t && grazing(t[0]! + ix!, t[1]! + iy!)) ?? tiles[mid]!;
  return y! * width + x!;
}

/** The fold gate's tile: the middle of the tiles strictly between the corner tile and the outer
 * edge on the fold's inner vertical wall. */
function innerGate(row: EntityRow, width: number): number {
  const f = foldRect(row);
  const corner = row['corner'] as string;
  const wx = corner.endsWith('w') ? f.x + f.w : f.x - 1;
  const ys: number[] = [];
  for (let k = 0; k < f.h; k += 1) ys.push(f.y + k);
  return ys[Math.floor((ys.length - 1) / 2)]! * width + wx;
}

interface Meadow {
  mx: number;
  my: number;
  mw: number;
  mh: number;
  rick: number;
}

/** The meadow and rick for the rectangle: on a side the fold touches, the side facing away from
 * the green first. The meadow starts where the fold's tiles end along the side, so the rick's
 * tile (outside the hurdles beside the fold) lies between pasture and meadow. */
function meadows(content: EngineContent, row: EntityRow, green: Spot, width: number): Meadow[] {
  const { fold, meadow } = content.flock.pasture;
  const [x, y, w, h] = [
    row['x'] as number,
    row['y'] as number,
    row['w'] as number,
    row['h'] as number,
  ];
  const corner = row['corner'] as string;
  const low = { x: corner.endsWith('w'), y: corner.startsWith('n') };
  const out: (Meadow & { d: number })[] = [];
  // North or south side (along x): the meadow is `meadow.w` wide, `meadow.h` deep.
  {
    const my = low.y ? y - meadow.h : y + h;
    const ry = low.y ? y - 1 : y + h;
    const rx = low.x ? x + fold : x + w - 1 - fold;
    const mx = low.x ? rx + 1 : rx - meadow.w;
    out.push({ mx, my, mw: meadow.w, mh: meadow.h, rick: ry * width + rx, d: 0 });
  }
  // West or east side (along y): `meadow.h` wide, `meadow.w` deep.
  {
    const mx = low.x ? x - meadow.h : x + w;
    const rx = low.x ? x - 1 : x + w;
    const ry = low.y ? y + fold : y + h - 1 - fold;
    const my = low.y ? ry + 1 : ry - meadow.w;
    out.push({ mx, my, mw: meadow.h, mh: meadow.w, rick: ry * width + rx, d: 0 });
  }
  for (const m of out) {
    const [dx, dy] = [2 * m.mx + m.mw - 1 - 2 * green.x, 2 * m.my + m.mh - 1 - 2 * green.y];
    m.d = dx * dx + dy * dy;
  }
  return out.sort((a, b) => b.d - a.d);
}

/** Chebyshev distance to the nearest water tile, up to `limit` (limit + 1 beyond), for every
 * tile of the map; a breadth-first sweep from the water tiles. */
function waterReach(world: WorldState, content: EngineContent, limit: number): Uint8Array {
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
function counter(cells: Uint8Array, width: number, height: number) {
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

/** The best site for a pasture, or undefined when none fits. */
export function choosePasture(
  world: WorldState,
  content: EngineContent,
  green: Spot,
): PastureSite | undefined {
  const map = world.map;
  const { width, height } = map;
  const def = content.flock.pasture;
  const herds = wildHerds(world, content);
  if (!herds.length) return undefined;
  const ring = ringOf(world, content);
  const ground = groundOf(world);
  const shut = new Set<number>();
  for (const h of housesOf(world).filter((r) => r['state'] !== 'sent')) {
    const r = rectOf(h);
    for (let y = r.y - 1; y <= r.y + r.h; y += 1)
      for (let x = r.x - 1; x <= r.x + r.w; x += 1) shut.add(y * width + x);
  }
  for (const d of depotsOf(world))
    for (let y = (d['y'] as number) - 1; y <= (d['y'] as number) + (d['h'] as number); y += 1)
      for (let x = (d['x'] as number) - 1; x <= (d['x'] as number) + (d['w'] as number); x += 1)
        shut.add(y * width + x);
  const smithies = smithiesOf(world).map(rectOf);
  const burials = burialsOf(world).map(rectOf);
  const sent = pasturesOf(world).filter((p) => p['state'] === 'sent');
  const inside = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
    x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  const open = (i: number): boolean => {
    const [x, y] = [i % width, Math.floor(i / width)];
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
    if (cheb(green, x, y) <= ring || shut.has(i) || map.built[i]) return false;
    // A bush or herbs are cleared as a hurdle goes up, a tree or log is felled first (a mark);
    // any other feature (a boulder) is in the way.
    const feat = map.features[i]! ? content.features[map.features[i]! - 1]!.kind : '';
    if (feat && feat !== 'bush' && feat !== 'herb' && feat !== 'tree' && feat !== 'log')
      return false;
    const kind = content.terrain.kinds[map.tiles[i]!]!;
    if (!kind.buildable || kind.water || kind.solid) return false;
    if (ground.items.has(i) || ground.taken.has(i)) return false;
    return ![...smithies, ...burials].some((r) => inside(r, x, y));
  };
  const lo = { x: Math.max(1, green.x - def.reach - 12), y: Math.max(1, green.y - def.reach - 12) };
  const hi = {
    x: Math.min(width - 2, green.x + def.reach + 12),
    y: Math.min(height - 2, green.y + def.reach + 12),
  };
  const bad = new Uint8Array(width * height).fill(1);
  const tree = new Uint8Array(width * height);
  for (let y = lo.y; y <= hi.y; y += 1)
    for (let x = lo.x; x <= hi.x; x += 1) {
      const i = y * width + x;
      if (!open(i) || sent.some((p) => onPastureGround(p, width, x, y))) continue;
      bad[i] = 0;
      tree[i] = isTreeAt(world, content, i) ? 1 : 0;
    }
  const clear = counter(bad, width, height);
  const trees = counter(tree, width, height);
  const wet = waterReach(world, content, def.water);
  const wz = def.weigh;
  const found: {
    x: number;
    y: number;
    score: number;
    far: number;
    water: number;
    herd: EntityRow;
  }[] = [];
  for (let y = lo.y; y + def.h - 1 <= hi.y; y += 1)
    for (let x = lo.x; x + def.w - 1 <= hi.x; x += 1) {
      const [cx, cy] = [x + Math.floor(def.w / 2), y + Math.floor(def.h / 2)];
      if (cheb(green, cx, cy) > def.reach) continue;
      if (clear(x, y, def.w, def.h)) continue;
      let water = def.water + 1;
      for (let ty = y; ty < y + def.h && water > 0; ty += 1)
        for (let tx = x; tx < x + def.w; tx += 1) water = Math.min(water, wet[ty * width + tx]!);
      if (water > def.water) continue;
      let far = Infinity;
      for (let ty = y; ty < y + def.h; ty += 1)
        for (let tx = x; tx < x + def.w; tx += 1) far = Math.min(far, cheb(green, tx, ty));
      let herd = herds[0]!;
      let near = Infinity;
      for (const hd of herds) {
        const d = Math.max(Math.abs((hd['x'] as number) - cx), Math.abs((hd['y'] as number) - cy));
        if (d < near) [herd, near] = [hd, d];
      }
      found.push({
        ...{ x, y, far, water, herd },
        score:
          wz.near * (far - ring - 1) +
          wz.water * water +
          wz.herd * near +
          wz.trees * trees(x, y, def.w, def.h),
      });
    }
  found.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
  for (const f of found.slice(0, wz.tries)) {
    const centre = { x: f.x + Math.floor(def.w / 2), y: f.y + Math.floor(def.h / 2) };
    const corner = (green.y < centre.y ? 'n' : 's') + (green.x < centre.x ? 'w' : 'e');
    const row = {
      id: 0,
      ...{ x: f.x, y: f.y, w: def.w, h: def.h, corner, fold: def.fold },
      ...{ gate: 0, foldGate: 0 },
    } as EntityRow;
    const m = meadows(content, row, green, width).find(
      (c) =>
        !clear(c.mx, c.my, c.mw, c.mh) && !clear(c.rick % width, Math.floor(c.rick / width), 1, 1),
    );
    if (!m) continue;
    row['gate'] = outerGate(row, green, width);
    row['foldGate'] = innerGate(row, width);
    const at = { x: row['gate'] % width, y: Math.floor(row['gate'] / width), z: 0 };
    if (!canReach(content, map, green, at)) continue;
    const fell: number[] = [];
    const all = [...pastureTiles({ ...row, ...m } as EntityRow, width)];
    for (const i of all) if (isTreeAt(world, content, i)) fell.push(i);
    return {
      ...{ x: f.x, y: f.y, w: def.w, h: def.h, corner, trees: fell },
      ...{ gate: row['gate'], foldGate: row['foldGate'] },
      ...{ mx: m.mx, my: m.my, mw: m.mw, mh: m.mh, rick: m.rick },
      far: f.far - ring - 1,
      wet: f.water,
      herd: f.herd,
    };
  }
  return undefined;
}

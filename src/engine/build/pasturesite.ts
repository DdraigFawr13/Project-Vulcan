// Siting a pasture (P5.4b, V-041, V-049): the colony chooses where it goes; the player only says
// how much it wants one. A rectangle (flock.pasture w by h, hurdles included), a hay meadow
// beside it and the rick's tile, all open surface ground outside the town ring, the rectangle's
// centre within `reach` of the green and water within `water` tiles of it. Every origin is
// scored, never drawn from a stream, lowest first: `near` x its gap from the ring, `water` x its
// distance to water, `herd` x its centre's distance to the nearest wild tame-species herd; ties
// go in tile order, so the same seed gives the same pasture. The geometry (fold corner, gates,
// meadow and rick) is worked out here and stored in the pasture row (pasturerows.ts).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import { burialsOf } from './burial.ts';
import { foldRect, foldWall, onPastureGround, pastureTiles, pasturesOf } from './pasturerows.ts';
import { ringOf } from './ring.ts';
import { groundOf, rectOf } from './site.ts';
import { smithiesOf } from './smithy.ts';
import { besideBuilt, counter, waterReach } from './sitegrid.ts';
import { inRect, isTreeAt } from './way.ts';

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

type PastureDef = EngineContent['flock']['pasture'];

/** One scored origin for the pasture's rectangle. */
interface Candidate {
  x: number;
  y: number;
  score: number;
  far: number;
  water: number;
  herd: EntityRow;
}

/** What every candidate is weighed against: the green, the ring, the herds and the ground. */
interface Survey {
  world: WorldState;
  content: EngineContent;
  green: Spot;
  def: PastureDef;
  ring: number;
  herds: EntityRow[];
  lo: { x: number; y: number };
  hi: { x: number; y: number };
  clear: (x: number, y: number, w: number, h: number) => number;
  trees: (x: number, y: number, w: number, h: number) => number;
  wet: Uint8Array;
}

/** The best site for a pasture, or undefined when none fits. */
export function choosePasture(
  world: WorldState,
  content: EngineContent,
  green: Spot,
): PastureSite | undefined {
  const herds = wildHerds(world, content);
  if (!herds.length) return undefined;
  const survey = surveyFor(world, content, green, herds);
  const found = candidates(survey);
  found.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
  for (const f of found.slice(0, survey.def.weigh.tries)) {
    const site = siteFrom(survey, f);
    if (site) return site;
  }
  return undefined;
}

/** The search box round the green and the running counts of blocked and wooded tiles in it. */
function surveyFor(
  world: WorldState,
  content: EngineContent,
  green: Spot,
  herds: EntityRow[],
): Survey {
  const { width, height } = world.map;
  const def = content.flock.pasture;
  const ring = ringOf(world, content);
  const lo = { x: Math.max(1, green.x - def.reach - 12), y: Math.max(1, green.y - def.reach - 12) };
  const hi = {
    x: Math.min(width - 2, green.x + def.reach + 12),
    y: Math.min(height - 2, green.y + def.reach + 12),
  };
  const open = openTest(world, content, green, ring);
  const sent = pasturesOf(world).filter((p) => p['state'] === 'sent');
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
  return { world, content, green, def, ring, herds, lo, hi, clear, trees, wet };
}

/** Whether a tile is ground a pasture may cover. */
function openTest(world: WorldState, content: EngineContent, green: Spot, ring: number) {
  const map = world.map;
  const { width, height } = map;
  const ground = groundOf(world);
  const shut = besideBuilt(world);
  const taken = [...smithiesOf(world).map(rectOf), ...burialsOf(world).map(rectOf)];
  return (i: number): boolean => {
    const [x, y] = [i % width, Math.floor(i / width)];
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
    if (cheb(green, x, y) <= ring || shut.has(i) || map.built[i]) return false;
    if (!openGround(world, content, i)) return false;
    if (ground.items.has(i) || ground.taken.has(i)) return false;
    return !taken.some((r) => inRect(r, x, y));
  };
}

/** A bush or herbs are cleared as a hurdle goes up, a tree or log is felled first (a mark); any
 * other feature (a boulder) is in the way, as is ground that is not buildable, water or solid. */
function openGround(world: WorldState, content: EngineContent, i: number): boolean {
  const map = world.map;
  const feat = map.features[i]! ? content.features[map.features[i]! - 1]!.kind : '';
  if (feat && !CLEARED.has(feat)) return false;
  const kind = content.terrain.kinds[map.tiles[i]!]!;
  return !(!kind.buildable || kind.water || kind.solid);
}

const CLEARED = new Set(['bush', 'herb', 'tree', 'log']);

/** Every origin in the box whose rectangle is clear, near enough the green and near water. */
function candidates(s: Survey): Candidate[] {
  const { def } = s;
  const found: Candidate[] = [];
  for (let y = s.lo.y; y + def.h - 1 <= s.hi.y; y += 1)
    for (let x = s.lo.x; x + def.w - 1 <= s.hi.x; x += 1) {
      const c = candidateAt(s, x, y);
      if (c) found.push(c);
    }
  return found;
}

function candidateAt(s: Survey, x: number, y: number): Candidate | undefined {
  const { def, green } = s;
  const [cx, cy] = [x + Math.floor(def.w / 2), y + Math.floor(def.h / 2)];
  if (cheb(green, cx, cy) > def.reach) return undefined;
  if (s.clear(x, y, def.w, def.h)) return undefined;
  const water = nearestWater(s, x, y);
  if (water > def.water) return undefined;
  let far = Infinity;
  for (let ty = y; ty < y + def.h; ty += 1)
    for (let tx = x; tx < x + def.w; tx += 1) far = Math.min(far, cheb(green, tx, ty));
  let herd = s.herds[0]!;
  let near = Infinity;
  for (const hd of s.herds) {
    const d = Math.max(Math.abs((hd['x'] as number) - cx), Math.abs((hd['y'] as number) - cy));
    if (d < near) [herd, near] = [hd, d];
  }
  const wz = def.weigh;
  const score =
    wz.near * (far - s.ring - 1) +
    wz.water * water +
    wz.herd * near +
    wz.trees * s.trees(x, y, def.w, def.h);
  return { x, y, far, water, herd, score };
}

/** The rectangle's closest tile to water, stopping early at 0. */
function nearestWater(s: Survey, x: number, y: number): number {
  const { def } = s;
  const width = s.world.map.width;
  let water = def.water + 1;
  for (let ty = y; ty < y + def.h && water > 0; ty += 1)
    for (let tx = x; tx < x + def.w; tx += 1) water = Math.min(water, s.wet[ty * width + tx]!);
  return water;
}

/** The candidate made whole: a clear meadow and rick, a gate the green can reach; or undefined. */
function siteFrom(s: Survey, f: Candidate): PastureSite | undefined {
  const { world, content, def, green, clear } = s;
  const width = world.map.width;
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
  if (!m) return undefined;
  row['gate'] = outerGate(row, green, width);
  row['foldGate'] = innerGate(row, width);
  const at = { x: row['gate'] % width, y: Math.floor(row['gate'] / width), z: 0 };
  if (!canReach(content, world.map, green, at)) return undefined;
  const all = [...pastureTiles({ ...row, ...m } as EntityRow, width)];
  const fell = all.filter((i) => isTreeAt(world, content, i));
  return {
    ...{ x: f.x, y: f.y, w: def.w, h: def.h, corner, trees: fell },
    ...{ gate: row['gate'], foldGate: row['foldGate'] },
    ...{ mx: m.mx, my: m.my, mw: m.mw, mh: m.mh, rick: m.rick },
    far: f.far - s.ring - 1,
    wet: f.water,
    herd: f.herd,
  };
}

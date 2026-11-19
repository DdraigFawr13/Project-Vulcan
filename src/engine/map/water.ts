// The valley's water: rivers, streams, lakes and springs carved from the ground's height, and the
// shores beside them, from the `worldgen` stream and terrain.json `generator.water`.
import type { EngineContent, RngStream } from '../core/index.ts';
import { drains, flood, N8 } from './flood.ts';
import { bake, fractalNoise } from './noise.ts';
import type { Ground } from './terrain.ts';

/** Codes in `Water.body` and `MapState.water` (core `WATER` names them). */
export const STREAM = 1;
export const RIVER = 2;
export const LAKE = 3;
export const SPRING = 4;

/** Codes in `Water.shore`. */
export const BEACH = 1;
export const SCREE = 2;
export const MARSH = 3;

type Dials = EngineContent['terrain']['generator']['water'];

export interface Water {
  /** 0 dry, else STREAM, RIVER, LAKE or SPRING, at `y * width + x`. */
  body: number[];
  /** True where the water is too deep to wade. */
  deep: boolean[];
  /** 0, or the shore a dry tile beside a river or lake becomes: BEACH, SCREE or MARSH. */
  shore: number[];
  /** The map edge the main river leaves by. */
  exit: 'north' | 'south' | 'east' | 'west';
  lakes: number;
  springs: number;
}

/**
 * Water runs over the ground tilted `tilt` metres down the valley's axis (which end is drawn), so
 * the floor drains one way, roughened by `meander` and `jitter` metres of noise so courses bend.
 * Hollows are flooded to their brim; each tile drains to a lower neighbour drawn by the drop, so
 * courses wind instead of running in 45-degree lines. Rain falls `mountainRain` times as heavily
 * within `mountainFoot` metres of the rock line as the floor's `floorRain`. Where the gathered rain
 * passes `streamFlow` below the rock line a stream runs; past `riverFlow` a river, two tiles wide,
 * three past `widenFlow` times that and five past `wideFlow` (a disc of `wideReach` squared tiles). A course runs on to the map's edge or a lake,
 * cutting through floor crags if it must. Hollows deeper than `lakeDepth` and at least `lakeArea`
 * tiles become lakes, deep past `deepDepth`, spreading onto shores within `lakeGrow` metres of the
 * brim. Each stream's head is a spring. Rivers stay shallow (Morgan, 2026-10-17).
 */
export function carveWater(
  rng: RngStream,
  content: EngineContent,
  ground: Ground,
  width: number,
  height: number,
): Water {
  const dials = content.terrain.generator.water;
  const g: Grid = { width, height };
  const isRock = ground.tiles.map((t) => content.terrain.kinds[t]!.stone === true);
  const noise = drawNoise(rng, dials, width, height);
  const surface = surfaceOf(ground, dials, noise, g);
  const { level, order } = flood(surface, width, height);
  const to = drains(level, width, height, noise.salt);
  const flow = gatherFlow(content, ground, order, to);
  const scale = ground.rainfall / dials.flowRain;

  const body = new Array<number>(width * height).fill(0);
  const deep = new Array<boolean>(width * height).fill(false);
  const lakes = fillLakes(surface, level, isRock, body, deep, width, height, dials);
  const course = runCourses({ body, flow, scale, order, to }, ground, dials);
  joinDiagonals(body, course, to, surface, g);
  const wide = widenRivers(
    { body, flow, scale, order, to },
    course,
    noise.swell,
    surface,
    dials,
    g,
  );
  const springs = markSprings(body, wide, course, to);
  const shore = shoresOf(body, isRock, ground, noise.banks, dials, g);
  return { body, deep, shore, exit: exitOf(flow, body, width, height), lakes, springs };
}

interface Grid {
  width: number;
  height: number;
}

/** The tile at `x, y`, or -1 off the map. */
function cell(g: Grid, x: number, y: number): number {
  return x < 0 || y < 0 || x >= g.width || y >= g.height ? -1 : y * g.width + x;
}

interface Noise {
  downstream: number;
  salt: number;
  jitter: number[];
  wander: number[];
  swell: number[];
  banks: number[];
}

/** Every draw the water takes from the stream, in the order it always has. */
function drawNoise(rng: RngStream, dials: Dials, width: number, height: number): Noise {
  const downstream = rng.pick([1, -1]);
  const salt = rng.int(1 << 30);
  const jitter = bake(fractalNoise(rng, width, height, 3, 2), width, height);
  const wander = bake(fractalNoise(rng, width, height, dials.meanderCell, 3), width, height);
  const swell = bake(fractalNoise(rng, width, height, dials.widthCell, 2), width, height);
  const banks = bake(fractalNoise(rng, width, height, dials.bankCell, 2), width, height);
  return { downstream, salt, jitter, wander, swell, banks };
}

/** The ground the water runs over: tilted down the axis and roughened so courses bend. */
function surfaceOf(ground: Ground, dials: Dials, noise: Noise, g: Grid): number[] {
  const { width, height } = g;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const half = Math.min(width, height) / 2;
  const [ax, ay] = ground.axis;
  const surface = new Array<number>(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const along = ((x - cx) * ax + (y - cy) * ay) / half;
      surface[i] =
        ground.elevation[i]! -
        noise.downstream * dials.tilt * along +
        (noise.jitter[i]! - 0.5) * 2 * dials.jitter +
        (noise.wander[i]! - 0.5) * 2 * dials.meander;
    }
  return surface;
}

/** Rain gathered downhill, highest tiles first. */
function gatherFlow(
  content: EngineContent,
  ground: Ground,
  order: readonly number[],
  to: readonly number[],
): number[] {
  const dials = content.terrain.generator.water;
  const { moisture } = content.terrain.generator;
  const foot = ground.wallFrom - dials.mountainFoot;
  const flow = ground.wet.map(
    (wet, i) =>
      (moisture.low + moisture.span * wet) *
      (ground.elevation[i]! >= foot ? dials.mountainRain : dials.floorRain),
  );
  for (let k = order.length - 1; k >= 0; k -= 1) {
    const i = order[k]!;
    if (to[i]! >= 0) flow[to[i]!]! += flow[i]!;
  }
  return flow;
}

interface Drainage {
  body: number[];
  flow: readonly number[];
  scale: number;
  order: readonly number[];
  to: readonly number[];
}

/** Courses: enough rain, below the mountain walls; then carried on down to the edge or a lake. */
function runCourses(d: Drainage, ground: Ground, dials: Dials): boolean[] {
  const { body, flow, scale, order, to } = d;
  for (let i = 0; i < body.length; i += 1) {
    const f = flow[i]! * scale;
    if (body[i] || f < dials.streamFlow || ground.elevation[i]! >= ground.wallFrom) continue;
    body[i] = f >= dials.riverFlow ? RIVER : STREAM;
  }
  for (let k = order.length - 1; k >= 0; k -= 1) {
    const i = order[k]!;
    const t = to[i]!;
    if ((body[i] === STREAM || body[i] === RIVER) && t >= 0 && !body[t]) body[t] = body[i]!;
  }
  return body.map((b) => b === STREAM || b === RIVER);
}

/** A diagonal step gets a corner tile, so every channel is joined edge to edge. */
function joinDiagonals(
  body: number[],
  course: readonly boolean[],
  to: readonly number[],
  surface: readonly number[],
  g: Grid,
): void {
  for (let i = 0; i < body.length; i += 1) {
    const t = to[i]!;
    if (!course[i] || t < 0) continue;
    const x = i % g.width;
    const y = (i - x) / g.width;
    const tx = t % g.width;
    const ty = (t - tx) / g.width;
    if (tx === x || ty === y) continue;
    const a = cell(g, tx, y);
    const b = cell(g, x, ty);
    const corner = surface[a]! <= surface[b]! ? a : b;
    if (!body[corner]) body[corner] = body[i]!;
  }
}

/** Rivers widen with their flow, swelling and narrowing along the way. */
function widenRivers(
  d: Drainage,
  course: readonly boolean[],
  swell: readonly number[],
  surface: readonly number[],
  dials: Dials,
  g: Grid,
): number[] {
  const { body, flow, scale } = d;
  const wide = body.slice();
  for (let i = 0; i < body.length; i += 1) {
    if (!course[i]) continue;
    const f = flow[i]! * scale * (dials.swellMin + dials.swellSpan * swell[i]!);
    if (f < dials.riverFlow) continue;
    if (f < dials.riverFlow * dials.widenFlow) widenBySide(body, wide, surface, i, g);
    else widenByDisc(wide, i, f >= dials.wideFlow ? dials.wideReach : 1, g);
  }
  return wide;
}

/** Two wide: the lower of the dry side neighbours joins. */
function widenBySide(
  body: readonly number[],
  wide: number[],
  surface: readonly number[],
  i: number,
  g: Grid,
): void {
  const x = i % g.width;
  const y = (i - x) / g.width;
  let side = -1;
  for (const j of [cell(g, x + 1, y), cell(g, x - 1, y), cell(g, x, y + 1), cell(g, x, y - 1)])
    if (j >= 0 && !body[j] && (side < 0 || surface[j]! < surface[side]!)) side = j;
  if (side >= 0) wide[side] = RIVER;
}

/** Three or five wide: a disc of `reach` squared tiles round the course. */
function widenByDisc(wide: number[], i: number, reach: number, g: Grid): void {
  const x = i % g.width;
  const y = (i - x) / g.width;
  for (let dy = -2; dy <= 2; dy += 1)
    for (let dx = -2; dx <= 2; dx += 1) {
      const j = cell(g, x + dx, y + dy);
      if (j >= 0 && dx * dx + dy * dy <= reach && (!wide[j] || wide[j] === STREAM)) wide[j] = RIVER;
    }
}

/** Copies the widened water into `body`, then turns stream heads no course drains into springs. */
function markSprings(
  body: number[],
  wide: readonly number[],
  course: readonly boolean[],
  to: readonly number[],
): number {
  const fed = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i += 1) if (course[i] && to[i]! >= 0) fed[to[i]!] = 1;
  let springs = 0;
  for (let i = 0; i < body.length; i += 1) {
    body[i] = wide[i]!;
    if (course[i] && body[i] === STREAM && !fed[i]) {
      body[i] = SPRING;
      springs += 1;
    }
  }
  return springs;
}

/** Shores: beside rivers and lakes, sand or scree in patches, marsh in damp ground. */
function shoresOf(
  body: readonly number[],
  isRock: readonly boolean[],
  ground: Ground,
  banks: readonly number[],
  dials: Dials,
  g: Grid,
): number[] {
  const shore = new Array<number>(body.length).fill(0);
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] || isRock[i] || !besideOpenWater(body, i, g)) continue;
    if (ground.wet[i]! > dials.marshWet && banks[i]! < dials.marshBank) shore[i] = MARSH;
    else if (banks[i]! > dials.beachBank)
      shore[i] = ground.elevation[i]! >= ground.wallFrom - dials.hills ? SCREE : BEACH;
  }
  return shore;
}

/** True when any of a tile's 8 neighbours is river or lake. */
function besideOpenWater(body: readonly number[], i: number, g: Grid): boolean {
  const x = i % g.width;
  const y = (i - x) / g.width;
  for (const [dx, dy] of N8) {
    const j = cell(g, x + dx, y + dy);
    if (j >= 0 && (body[j] === RIVER || body[j] === LAKE)) return true;
  }
  return false;
}

/** Marks lakes in `body` and their deep water; returns how many there are. */
function fillLakes(
  surface: readonly number[],
  level: readonly number[],
  isRock: readonly boolean[],
  body: number[],
  deep: boolean[],
  width: number,
  height: number,
  dials: Dials,
): number {
  const n = width * height;
  const depth = level.map((l, i) => l - surface[i]!);
  const near = (i: number): number[] => {
    const x = i % width;
    const y = (i - x) / width;
    const out: number[] = [];
    for (const [dx, dy] of N8)
      if (x + dx >= 0 && y + dy >= 0 && x + dx < width && y + dy < height)
        out.push((y + dy) * width + x + dx);
    return out;
  };
  const seen = new Uint8Array(n);
  let lakes = 0;
  for (let s = 0; s < n; s += 1) {
    if (seen[s] || isRock[s] || depth[s]! < dials.lakeDepth) continue;
    const basin = [s];
    seen[s] = 1;
    for (let q = 0; q < basin.length; q += 1)
      for (const j of near(basin[q]!)) {
        if (seen[j] || isRock[j] || depth[j]! < dials.basinDepth) continue;
        seen[j] = 1;
        basin.push(j);
      }
    if (basin.length < dials.lakeArea) continue;
    lakes += 1;
    for (const i of basin) {
      body[i] = LAKE;
      deep[i] = depth[i]! >= dials.deepDepth;
    }
  }
  // Each lake spreads a little past its brim onto low, gentle shores.
  const spread: number[] = [];
  for (let i = 0; i < n; i += 1)
    if (body[i] === LAKE)
      for (const j of near(i))
        if (!body[j] && !isRock[j] && surface[j]! <= level[i]! + dials.lakeGrow) spread.push(j);
  for (const j of spread) body[j] = LAKE;
  return lakes;
}

/** The side of the map where the most water leaves by a river or stream (any edge if none does). */
function exitOf(
  flow: readonly number[],
  body: readonly number[],
  width: number,
  height: number,
): Water['exit'] {
  let best = -1;
  let exit = 0;
  for (let pass = 0; pass < 2 && best < 0; pass += 1)
    for (let i = 0; i < width * height; i += 1) {
      const x = i % width;
      const y = (i - x) / width;
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const runs = body[i] === RIVER || body[i] === STREAM || pass === 1;
      if (edge && runs && flow[i]! > best) {
        best = flow[i]!;
        exit = i;
      }
    }
  const x = exit % width;
  const y = (exit - x) / width;
  return y === 0 ? 'north' : y === height - 1 ? 'south' : x === 0 ? 'west' : 'east';
}

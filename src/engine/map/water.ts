// The valley's water: rivers, streams, lakes and springs carved from the ground's height, and the
// shores beside them, from the `worldgen` stream and terrain.json `generator.water`.
import type { EngineContent, RngStream } from '../core/index.ts';
import { flood, N8 } from './flood.ts';
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
 * three past 1.5 times that and five past `wideFlow`. A course runs on to the map's edge or a lake,
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
  const { moisture } = content.terrain.generator;
  const n = width * height;
  const isRock = ground.tiles.map((t) => content.terrain.kinds[t]!.stone === true);
  const downstream = rng.pick([1, -1]);
  const salt = rng.int(1 << 30);
  const jitter = bake(fractalNoise(rng, width, height, 3, 2), width, height);
  const wander = bake(fractalNoise(rng, width, height, dials.meanderCell, 3), width, height);
  const swell = bake(fractalNoise(rng, width, height, dials.widthCell, 2), width, height);
  const banks = bake(fractalNoise(rng, width, height, dials.bankCell, 2), width, height);
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? -1 : y * width + x;

  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const half = Math.min(width, height) / 2;
  const [ax, ay] = ground.axis;
  const surface = new Array<number>(n);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const along = ((x - cx) * ax + (y - cy) * ay) / half;
      surface[i] =
        ground.elevation[i]! -
        downstream * dials.tilt * along +
        (jitter[i]! - 0.5) * 2 * dials.jitter +
        (wander[i]! - 0.5) * 2 * dials.meander;
    }
  const { level, order } = flood(surface, width, height);
  const to = drains(level, width, height, salt);

  // Rain gathered downhill, highest tiles first.
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
  const scale = ground.rainfall / dials.flowRain;

  const body = new Array<number>(n).fill(0);
  const deep = new Array<boolean>(n).fill(false);
  const lakes = fillLakes(surface, level, isRock, body, deep, width, height, dials);

  // Courses: enough rain, below the mountain walls; then carried on down to the edge or a lake.
  for (let i = 0; i < n; i += 1) {
    const f = flow[i]! * scale;
    if (body[i] || f < dials.streamFlow || ground.elevation[i]! >= ground.wallFrom) continue;
    body[i] = f >= dials.riverFlow ? RIVER : STREAM;
  }
  for (let k = order.length - 1; k >= 0; k -= 1) {
    const i = order[k]!;
    const t = to[i]!;
    if ((body[i] === STREAM || body[i] === RIVER) && t >= 0 && !body[t]) body[t] = body[i]!;
  }
  const course = body.map((b) => b === STREAM || b === RIVER);

  // A diagonal step gets a corner tile, so every channel is joined edge to edge.
  for (let i = 0; i < n; i += 1) {
    const t = to[i]!;
    if (!course[i] || t < 0) continue;
    const x = i % width;
    const y = (i - x) / width;
    const tx = t % width;
    const ty = (t - tx) / width;
    if (tx === x || ty === y) continue;
    const a = at(tx, y);
    const b = at(x, ty);
    const corner = surface[a]! <= surface[b]! ? a : b;
    if (!body[corner]) body[corner] = body[i]!;
  }

  // Rivers widen with their flow, swelling and narrowing along the way.
  const wide = body.slice();
  for (let i = 0; i < n; i += 1) {
    if (!course[i]) continue;
    const f = flow[i]! * scale * (0.7 + 0.6 * swell[i]!);
    if (f < dials.riverFlow) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (f < dials.riverFlow * 1.5) {
      // Two wide: the lower of the dry side neighbours joins.
      let side = -1;
      for (const j of [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)])
        if (j >= 0 && !body[j] && (side < 0 || surface[j]! < surface[side]!)) side = j;
      if (side >= 0) wide[side] = RIVER;
      continue;
    }
    const reach = f >= dials.wideFlow ? 4.5 : 1;
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = -2; dx <= 2; dx += 1) {
        const j = at(x + dx, y + dy);
        if (j >= 0 && dx * dx + dy * dy <= reach && (!wide[j] || wide[j] === STREAM))
          wide[j] = RIVER;
      }
  }

  // Springs: stream heads that no course drains into.
  const fed = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) if (course[i] && to[i]! >= 0) fed[to[i]!] = 1;
  let springs = 0;
  for (let i = 0; i < n; i += 1) {
    body[i] = wide[i]!;
    if (course[i] && body[i] === STREAM && !fed[i]) {
      body[i] = SPRING;
      springs += 1;
    }
  }

  // Shores: beside rivers and lakes, sand or scree in patches, marsh in damp ground.
  const shore = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    if (body[i] || isRock[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    let beside = false;
    for (const [dx, dy] of N8) {
      const j = at(x + dx, y + dy);
      if (j >= 0 && (body[j] === RIVER || body[j] === LAKE)) beside = true;
    }
    if (!beside) continue;
    if (ground.wet[i]! > dials.marshWet && banks[i]! < dials.marshBank) shore[i] = MARSH;
    else if (banks[i]! > dials.beachBank)
      shore[i] = ground.elevation[i]! >= ground.wallFrom - dials.hills ? SCREE : BEACH;
  }

  return { body, deep, shore, exit: exitOf(flow, width, height), lakes, springs };
}

/**
 * Where each tile drains: a lower neighbour drawn with odds by its drop (diagonals by the drop
 * over their longer step). The draw is a hash of the tile and the world's `salt`, so the stream
 * is read the same number of times whatever the ground. Edge tiles drain off the map (-1).
 */
function drains(level: readonly number[], width: number, height: number, salt: number): number[] {
  const to = new Array<number>(width * height).fill(-1);
  const weights = new Array<number>(8);
  for (let y = 1; y < height - 1; y += 1)
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      let total = 0;
      for (let k = 0; k < 8; k += 1) {
        const [dx, dy] = N8[k]!;
        const drop = level[i]! - level[(y + dy) * width + x + dx]!;
        weights[k] = drop > 0 ? (dx && dy ? drop * 0.7071 : drop) : 0;
        total += weights[k]!;
      }
      let roll = hash(i, salt) * total;
      for (let k = 0; k < 8; k += 1) {
        if (weights[k]! <= 0) continue;
        to[i] = (y + N8[k]![1]) * width + x + N8[k]![0];
        roll -= weights[k]!;
        if (roll <= 0) break;
      }
    }
  return to;
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
        if (seen[j] || isRock[j] || depth[j]! < 0.5) continue;
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

/** The side of the map where the most water leaves. */
function exitOf(flow: readonly number[], width: number, height: number): Water['exit'] {
  let best = -1;
  let exit = 0;
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width;
    const y = (i - x) / width;
    if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && flow[i]! > best) {
      best = flow[i]!;
      exit = i;
    }
  }
  const x = exit % width;
  const y = (exit - x) / width;
  return y === 0 ? 'north' : y === height - 1 ? 'south' : x === 0 ? 'west' : 'east';
}

/** A tile's draw in [0, 1) from its index and the world's salt. */
function hash(i: number, salt: number): number {
  let h = Math.imul(i ^ salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

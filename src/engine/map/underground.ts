// The levels below the surface (DECISIONS V-014): each made from the seed and its depth alone
// when stairs or a shaft first reach it, so the order levels are reached in cannot change them.
// What is above shows what is below: each range's rock runs down beneath it, the rest is bedrock
// bodies drawn once per seed; level 1 is earth under the valley floor; tunnels and caverns open
// deeper down; veins of ore lie in the rock by level (features.json `vein`).
import {
  streamFor,
  WATER,
  type AuraSpot,
  type EngineContent,
  type MapState,
  type RngStream,
} from '../core/index.ts';
import { deepSpot } from './aura.ts';
import { bake, fractalNoise, quantile } from './noise.ts';

/** A state of the `veins` stream for one part of the underground, derived afresh from the seed
 * each time: `2` for level 2's own draws, `bedrock` and `warp` for the bodies all levels share. */
const veinsFor = (seed: string, part: string | number): RngStream =>
  streamFor({ seed, rng: {} }, `veins:${part}`);

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
// Diagonal steps cost 3 against 2 straight, so rock spreads in rough circles, not diamonds.
const AROUND = [...SIDES, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
// A tunnel's heading: 16 directions written out (no trigonometry, V-006), in 1/100 tiles a step.
const HEADINGS = [
  [100, 0],
  [92, 38],
  [71, 71],
  [38, 92],
  [0, 100],
  [-38, 92],
  [-71, 71],
  [-92, 38],
  [-100, 0],
  [-92, -38],
  [-71, -71],
  [-38, -92],
  [0, -100],
  [38, -92],
  [71, -71],
  [92, -38],
] as const;

/** Lays out level `depth` (1 to `underground.depth`) under `map`: one terrain index and one
 * feature (0, or 1 + a vein's index in `content.features`) per tile. */
export function makeLevel(
  seed: string,
  content: EngineContent,
  map: MapState,
  depth: number,
): { tiles: Uint8Array; features: Uint8Array; spot: AuraSpot | undefined } {
  const dials = content.terrain.generator.underground;
  const { kinds } = content.terrain;
  const kind = (id: string): number => kinds.findIndex((k) => k.id === id);
  const W = map.width;
  const H = map.height;
  const N = W * H;
  const rng = veinsFor(seed, depth);
  const tiles = new Uint8Array(N);
  const features = new Uint8Array(N);

  // Each range's rock spreads out under the valley from the surface rock, along a cost warped by
  // this level's noise, so borders shift a little from level to level.
  const warp = bake(fractalNoise(rng, W, H, dials.warpCell, 2), W, H);
  const bendX = bake(fractalNoise(veinsFor(seed, 'warp'), W, H, dials.bodies.bendCell, 2), W, H);
  const bendY = bake(fractalNoise(rng, W, H, dials.bodies.bendCell, 2), W, H);
  const fine = bake(fractalNoise(rng, W, H, dials.bodies.fineCell, 2), W, H);
  const dist = new Int32Array(N).fill(-1);
  const rootRock = new Int16Array(N).fill(-1);
  const buckets: number[][] = [[]];
  for (let i = 0; i < N; i += 1)
    if (map.rock[i]) {
      dist[i] = 0;
      rootRock[i] = map.rock[i]! - 1;
      buckets[0]!.push(i);
    }
  for (let d = 0; d < buckets.length; d += 1)
    for (const i of buckets[d] ?? []) {
      if (d > dist[i]!) continue;
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of AROUND) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        const nd = d + (dx && dy ? 3 : 2) + Math.floor(warp[j]! * 3);
        if (dist[j]! >= 0 && nd >= dist[j]!) continue;
        dist[j] = nd;
        rootRock[j] = rootRock[i]!;
        (buckets[nd] ??= []).push(j);
      }
    }

  // Bedrock bodies under the valley, drawn once per seed and shared by every level.
  const shared = veinsFor(seed, 'bedrock');
  const weights = content.terrain.generator.rocks.map((r) => [kind(r.kind), r.weight] as const);
  const [least, most] = dials.bodies.count as [number, number];
  const bodies = Array.from({ length: least + shared.int(most - least + 1) }, () => ({
    x: shared.int(W),
    y: shared.int(H),
    rock: shared.weighted(weights),
  }));
  const { roots, bodies: shape } = dials;
  const reach = roots.reach + roots.perLevel * depth;
  for (let i = 0; i < N; i += 1) {
    const x = i % W;
    const y = (i - x) / W;
    const f = fine[i]! - 0.5;
    if (rootRock[i]! >= 0 && dist[i]! <= 2 * (reach + warp[i]! * roots.warp + f * roots.fine)) {
      tiles[i] = rootRock[i]!;
      continue;
    }
    const qx = x + (bendX[i]! - 0.5) * shape.bend + f * shape.fine;
    const qy = y + (bendY[i]! - 0.5) * shape.bend - f * shape.fine;
    let best = Infinity;
    for (const body of bodies) {
      const d = (body.x - qx) * (body.x - qx) + (body.y - qy) * (body.y - qy);
      if (d < best) {
        best = d;
        tiles[i] = body.rock;
      }
    }
  }

  if (depth === 1) layEarth(rng, content, map, tiles, dist);
  digCaves(rng, content, W, H, depth, tiles);
  placeVeins(rng, content, map, depth, tiles, features);
  // The deepest level's aura spot comes last, from the same stream, after its veins.
  return { tiles, features, spot: deepSpot(rng, content, W, H, depth, tiles, features) };
}

/** Level 1: soil under the valley floor away from the mountain foot, clay by the water,
 * groundwater under lakes and the river. */
function layEarth(
  rng: RngStream,
  content: EngineContent,
  map: MapState,
  tiles: Uint8Array,
  dist: Int32Array,
): void {
  const dials = content.terrain.generator.underground.earth;
  const kind = (id: string): number => content.terrain.kinds.findIndex((k) => k.id === id);
  const W = map.width;
  const H = map.height;
  const soil = bake(fractalNoise(rng, W, H, dials.soilCell, 2), W, H);
  const nearWater = new Int16Array(W * H).fill(99);
  for (let i = 0; i < W * H; i += 1) if (map.water[i]) nearWater[i] = 0;
  for (let pass = 0; pass <= dials.clayReach; pass += 1)
    for (let i = 0; i < W * H; i += 1) {
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of SIDES) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        nearWater[i] = Math.min(nearWater[i]!, nearWater[ny * W + nx]! + 1);
      }
    }
  const lake = WATER.indexOf('lake');
  for (let i = 0; i < W * H; i += 1) {
    if (dist[i]! <= 2 * (dials.foot + Math.floor(soil[i]! * dials.footNoise))) continue;
    if (map.water[i] && (map.water[i] === lake || soil[i]! > dials.wetShare))
      tiles[i] = kind(dials.groundwater);
    else if (nearWater[i]! <= dials.clayReach && soil[i]! > dials.clayShare)
      tiles[i] = kind(dials.clay);
    else tiles[i] = kind(dials.soil);
  }
}

/** Tunnels dug by wandering worms that start and stop in the rock, then caverns where a noise
 * field peaks; groundwater is left as it is. */
function digCaves(
  rng: RngStream,
  content: EngineContent,
  W: number,
  H: number,
  depth: number,
  tiles: Uint8Array,
): void {
  const dials = content.terrain.generator.underground.caves;
  const cave = content.terrain.kinds.findIndex((k) => k.id === dials.kind);
  const wet = content.terrain.kinds.findIndex(
    (k) => k.id === content.terrain.generator.underground.earth.groundwater,
  );
  const want = Math.round((dials.tunnels[depth - 1] ?? 0) * W * H);
  const [shortest, longest] = dials.length as [number, number];
  let dug = 0;
  for (let worm = 0; dug < want && worm < 400; worm += 1) {
    let fx = rng.int(W) * 100;
    let fy = rng.int(H) * 100;
    let heading = rng.int(16);
    let lastTurn = 0;
    const steps = shortest + rng.int(longest - shortest + 1);
    for (let s = 0; s < steps; s += 1) {
      const x = Math.floor(fx / 100);
      const y = Math.floor(fy / 100);
      const wide = rng.chance(dials.wide) ? 1 : 0;
      for (let oy = 0; oy <= wide; oy += 1)
        for (let ox = 0; ox <= wide; ox += 1) {
          const i = (y + oy) * W + x + ox;
          if (x + ox >= W || y + oy >= H || tiles[i] === wet || tiles[i] === cave) continue;
          tiles[i] = cave;
          dug += 1;
        }
      // Bends lean one way, then swing back, so a tunnel snakes but never loops on itself.
      if (rng.chance(dials.turn)) {
        const turn = lastTurn && rng.chance(dials.swing) ? -lastTurn : rng.chance(0.5) ? 1 : -1;
        heading = (heading + turn + 16) % 16;
        lastTurn = turn;
      }
      const [dx, dy] = HEADINGS[heading]!;
      fx += dx;
      fy += dy;
      if (fx < 0 || fy < 0 || fx >= (W - 1) * 100 || fy >= (H - 1) * 100) break;
    }
  }
  const share = dials.caverns[depth - 1] ?? 0;
  if (share <= 0) return;
  const field = bake(fractalNoise(rng, W, H, dials.cavernCell, 3), W, H);
  const line = quantile(field, 1 - share);
  for (let i = 0; i < W * H; i += 1) if (field[i]! > line && tiles[i] !== wet) tiles[i] = cave;
}

/** Each vein of this level: `near` clusters within the start radius, the rest anywhere, each
 * grown by a wandering walk through solid rock from a seed tile its rock preference accepts. */
function placeVeins(
  rng: RngStream,
  content: EngineContent,
  map: MapState,
  depth: number,
  tiles: Uint8Array,
  features: Uint8Array,
): void {
  const { kinds } = content.terrain;
  const W = map.width;
  const H = map.height;
  const radius = content.terrain.generator.start.radius;
  const solid = (i: number): boolean => kinds[tiles[i]!]!.stone === true && features[i] === 0;
  content.features.forEach((def, index) => {
    if (!def.vein || def.vein.level !== depth) return;
    const vein = def.vein;
    const count = Math.max(1, Math.round((vein.per10k * W * H) / 10000));
    const grow = (near: boolean): void => {
      for (let tries = 0; tries < 200; tries += 1) {
        const x = near ? map.startX - radius + rng.int(2 * radius + 1) : rng.int(W);
        const y = near ? map.startY - radius + rng.int(2 * radius + 1) : rng.int(H);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const start = y * W + x;
        if (!solid(start)) continue;
        // Rock preferences are weights out of 3 (features.json `vein.rocks`); any other rock is 1.
        if (!rng.chance((vein.rocks[kinds[tiles[start]!]!.id] ?? 1) / 3)) continue;
        const [least, most] = vein.size as [number, number];
        const size = least + rng.int(most - least + 1);
        let at = start;
        let placed = 0;
        // A seam wanders: it keeps its way half the time and otherwise turns to any of the eight
        // neighbours, diagonals included, so it bends and thickens instead of lying in a line.
        let way = rng.int(AROUND.length);
        for (let s = 0; s < size * 4 && placed < size; s += 1) {
          if (solid(at)) {
            features[at] = index + 1;
            placed += 1;
          }
          const ax = at % W;
          const ay = (at - ax) / W;
          if (!rng.chance(0.5)) way = rng.int(AROUND.length);
          const [dx, dy] = AROUND[way]!;
          const nx = ax + dx;
          const ny = ay + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && kinds[tiles[ny * W + nx]!]!.stone)
            at = ny * W + nx;
        }
        return;
      }
    };
    for (let k = 0; k < count; k += 1) grow(k < vein.near);
  });
}

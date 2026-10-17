// What grows or lies on the ground: trees in groves, bushes, herbs and boulders, by biome from
// content (features.json); then the start tile, the nearest to the middle with enough around it.
import type { EngineContent, RngStream } from '../core/index.ts';
import { bake, fractalNoise, quantile } from './noise.ts';
import type { Ground } from './terrain.ts';

/**
 * One feature roll per tile, row by row: a `clumps` feature's chance is its biome density scaled by a grove
 * field (`groves.low` to `groves.high`), times `oldGrowth.factor` in the old-growth share of the
 * map, so woods come in clumps, clearings and dense old stands; `glades` features are
 * `glades.factor` times likelier in the clearings' heart; boulders gain
 * `nearRock.density` within `nearRock.reach` tiles of rock. Rock tiles stay bare. Returns
 * 0 for a bare tile, else 1 + the feature's index.
 */
export function placeFeatures(
  rng: RngStream,
  content: EngineContent,
  ground: Ground,
  width: number,
  height: number,
): number[] {
  const { features } = content;
  const { biomes } = content.biomes;
  const { groves } = content.terrain.generator;
  const grove = bake(fractalNoise(rng, width, height, groves.cell, 2), width, height);
  const old = bake(fractalNoise(rng, width, height, groves.oldGrowth.cell, 2), width, height);
  const oldFrom = quantile(old, 1 - groves.oldGrowth.share);
  const gladeBelow = quantile(grove, groves.glades.share);
  const isRock = ground.tiles.map((t) => content.terrain.kinds[t]!.stone === true);
  const reach = Math.max(0, ...features.map((f) => f.nearRock?.reach ?? 0));
  const rockDistance = distanceTo(isRock, width, height, reach);
  const out = new Array<number>(width * height).fill(0);
  for (let i = 0; i < width * height; i += 1) {
    const roll = rng.int(1_000_000) / 1_000_000;
    if (isRock[i]) continue;
    const biome = biomes[ground.biomes[i]!]!.id;
    // Old growth: dense woods where its field peaks. Glades: the grove field's lowest ground.
    const clump =
      (groves.low + (groves.high - groves.low) * grove[i]!) *
      (old[i]! >= oldFrom ? groves.oldGrowth.factor : 1);
    const glade = grove[i]! <= gladeBelow;
    let sum = 0;
    for (let f = 0; f < features.length; f += 1) {
      const def = features[f]!;
      let chance = def.density[biome] ?? 0;
      if (def.clumps) chance *= clump;
      if (def.glades && glade) chance *= groves.glades.factor;
      if (def.nearRock && rockDistance[i]! <= def.nearRock.reach) chance += def.nearRock.density;
      sum += chance;
      if (roll < sum) {
        out[i] = f + 1;
        break;
      }
    }
  }
  return out;
}

/** Chebyshev distance from each tile to the nearest true tile, capped at `cap + 1`. */
function distanceTo(mask: readonly boolean[], width: number, height: number, cap: number) {
  const out = new Array<number>(width * height).fill(cap + 1);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let dy = -cap; dy <= cap; dy += 1)
        for (let dx = -cap; dx <= cap; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          if (d < out[ny * width + nx]!) out[ny * width + nx] = d;
        }
    }
  return out;
}

/** What the done-when counts per tile: buildable land, wood (a feature yielding `start.woodItem`)
 * and stone (rock ground, or a feature yielding `start.stoneItem`). */
export function tileUses(
  content: EngineContent,
  tiles: readonly number[],
  features: ArrayLike<number>,
): { buildable: boolean[]; wood: boolean[]; stone: boolean[] } {
  const n = tiles.length;
  const { start } = content.terrain.generator;
  const buildable = new Array<boolean>(n);
  const wood = new Array<boolean>(n);
  const stone = new Array<boolean>(n);
  for (let i = 0; i < n; i += 1) {
    const kind = content.terrain.kinds[tiles[i]!]!;
    const feature = features[i]! > 0 ? content.features[features[i]! - 1] : undefined;
    buildable[i] = kind.buildable === true && !feature?.blocks;
    wood[i] = feature?.yields === start.woodItem;
    stone[i] = kind.stone === true || feature?.yields === start.stoneItem;
  }
  return { buildable, wood, stone };
}

/** Summed-area table, so any square's count is four look-ups. */
function sums(mask: readonly boolean[], width: number, height: number): number[] {
  const s = new Array<number>((width + 1) * (height + 1)).fill(0);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      s[(y + 1) * (width + 1) + x + 1] =
        (mask[y * width + x] ? 1 : 0) +
        s[y * (width + 1) + x + 1]! +
        s[(y + 1) * (width + 1) + x]! -
        s[y * (width + 1) + x]!;
  return s;
}

export interface StartCounts {
  buildable: number;
  wood: number;
  stone: number;
}

/** Counts within `radius` tiles (a square, Chebyshev distance) of every tile. */
export function countsAround(
  content: EngineContent,
  tiles: readonly number[],
  features: ArrayLike<number>,
  width: number,
  height: number,
  radius: number,
): (x: number, y: number) => StartCounts {
  const uses = tileUses(content, tiles, features);
  const tables = [uses.buildable, uses.wood, uses.stone].map((m) => sums(m, width, height));
  const count = (s: number[], x: number, y: number): number => {
    const x0 = Math.max(0, x - radius);
    const y0 = Math.max(0, y - radius);
    const x1 = Math.min(width, x + radius + 1);
    const y1 = Math.min(height, y + radius + 1);
    const w = width + 1;
    return s[y1 * w + x1]! - s[y0 * w + x1]! - s[y1 * w + x0]! + s[y0 * w + x0]!;
  };
  return (x, y) => ({
    buildable: count(tables[0]!, x, y),
    wood: count(tables[1]!, x, y),
    stone: count(tables[2]!, x, y),
  });
}

/**
 * Counts within `radius` of (x, y), as `countsAround` does, but only what the settlers can reach:
 * open ground joined to (x, y) by steps along rows and columns that never cross rock, plus the rock
 * faces that ground touches. So a range across the square cannot hide land behind it.
 */
export function reachableAround(
  content: EngineContent,
  tiles: readonly number[],
  features: ArrayLike<number>,
  width: number,
  height: number,
  radius: number,
): (x: number, y: number) => StartCounts {
  const uses = tileUses(content, tiles, features);
  const rock = tiles.map((t) => content.terrain.kinds[t]!.stone === true);
  return (x, y) => {
    const seen = new Set<number>();
    const faces = new Set<number>();
    const out = { buildable: 0, wood: 0, stone: 0 };
    const queue = [y * width + x];
    seen.add(queue[0]!);
    for (let k = 0; k < queue.length; k += 1) {
      const i = queue[k]!;
      if (uses.buildable[i]) out.buildable += 1;
      if (uses.wood[i]) out.wood += 1;
      if (uses.stone[i]) out.stone += 1;
      const tx = i % width;
      const ty = Math.floor(i / width);
      for (const [dx, dy] of STEPS) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (Math.abs(nx - x) > radius || Math.abs(ny - y) > radius) continue;
        const n = ny * width + nx;
        if (rock[n]) faces.add(n);
        else if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    out.stone += faces.size;
    return out;
  };
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * The start tile: the buildable tile nearest the middle (ties by row, then column) with at least
 * `start.buildable` buildable tiles, `start.wood` trees and `start.stone` stone within
 * `start.radius` that it can reach (`reachableAround`). If no tile has all three, the one with the best worst share of them, with `met`
 * false (the `map.formed` line records it).
 */
export function findStart(
  content: EngineContent,
  tiles: readonly number[],
  features: ArrayLike<number>,
  width: number,
  height: number,
): { x: number; y: number; met: boolean } {
  const need = content.terrain.generator.start;
  const around = countsAround(content, tiles, features, width, height, need.radius);
  const reach = reachableAround(content, tiles, features, width, height, need.radius);
  const { buildable } = tileUses(content, tiles, features);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const order: number[] = [];
  for (let i = 0; i < width * height; i += 1) if (buildable[i]) order.push(i);
  const far = (i: number): number => {
    const dx = (i % width) - cx;
    const dy = Math.floor(i / width) - cy;
    return dx * dx + dy * dy;
  };
  order.sort((a, b) => far(a) - far(b) || a - b);
  let best = order[0] ?? 0;
  let bestScore = -1;
  for (const i of order) {
    const c = around(i % width, Math.floor(i / width));
    const score = Math.min(
      c.buildable / need.buildable,
      c.wood / need.wood,
      c.stone / need.stone,
      1,
    );
    if (score >= 1) {
      // The square has enough; check the settlers can reach it (a flood fill, so only here).
      const r = reach(i % width, Math.floor(i / width));
      if (r.buildable >= need.buildable && r.wood >= need.wood && r.stone >= need.stone)
        return { x: i % width, y: Math.floor(i / width), met: true };
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return { x: best % width, y: Math.floor(best / width), met: false };
}

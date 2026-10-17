// Map generation: two value-noise fields (height, moisture) on a coarse lattice, smoothed with
// a cubic fade that uses only + - * /, then terrain and features by threshold.

import { streamFor, type RngStream } from '../core/rng.ts';
import {
  Feature,
  Terrain,
  type MapGenDef,
  type Point,
  type TileMap,
  type WorldState,
} from '../core/types.ts';

/** A noise field in 0..1000 over a width × height grid. Two octaves: cell and cell / 2. */
function valueNoise(rng: RngStream, width: number, height: number, cell: number): Int32Array {
  const out = new Int32Array(width * height);
  const octaves: [number, number][] = [
    [cell, 2],
    [Math.max(2, cell / 2), 1],
  ];
  const totalWeight = octaves.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [size, weight] of octaves) {
    const cols = Math.ceil(width / size) + 2;
    const rows = Math.ceil(height / size) + 2;
    const lattice: number[] = [];
    for (let i = 0; i < cols * rows; i += 1) lattice.push(rng.int(1001));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const gx = Math.floor(x / size);
        const gy = Math.floor(y / size);
        const fx = fade((x - gx * size) / size);
        const fy = fade((y - gy * size) / size);
        const at = (cx: number, cy: number) => lattice[cy * cols + cx]!;
        const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * fx;
        const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * fx;
        out[y * width + x]! += Math.round((top + (bottom - top) * fy) * weight);
      }
    }
  }
  for (let i = 0; i < out.length; i += 1) out[i] = Math.round(out[i]! / totalWeight);
  return out;
}

/** Cubic smoothstep, 3t² − 2t³. */
function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Stretches a field so its lowest value is 0 and its highest 1000, keeping thresholds meaningful. */
function normalise(field: Int32Array): void {
  let min = Infinity;
  let max = -Infinity;
  for (const value of field) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < field.length; i += 1)
    field[i] = Math.round(((field[i]! - min) * 1000) / span);
}

export function generateMap(
  world: Pick<WorldState, 'seed' | 'rng'>,
  def: MapGenDef,
  treeWood: number,
  bushMax: number,
): {
  map: TileMap;
  hearth: Point;
  store: Point;
} {
  const { width, height } = def;
  const size = width * height;
  const heightField = valueNoise(streamFor(world, 'map.height'), width, height, def.noiseCell);
  const moisture = valueNoise(streamFor(world, 'map.moisture'), width, height, def.noiseCell);
  normalise(heightField);
  normalise(moisture);
  const scatter = streamFor(world, 'map.features');
  const map: TileMap = {
    width,
    height,
    terrain: new Uint8Array(size),
    feature: new Uint8Array(size),
    amount: new Uint8Array(size),
    regrowAt: new Uint32Array(size),
    reservedBy: new Uint16Array(size),
  };
  const hearth = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const store = { x: hearth.x + 2, y: hearth.y };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const dx = x - hearth.x;
      const dy = y - hearth.y;
      const inClearing = dx * dx + dy * dy <= def.clearRadius * def.clearRadius;
      const h = heightField[i]!;
      if (inClearing) map.terrain[i] = Terrain.Grass;
      else if (h < def.waterBelow) map.terrain[i] = Terrain.Water;
      else if (h > def.rockAbove) map.terrain[i] = Terrain.Rock;
      else map.terrain[i] = Terrain.Grass;
      // Draw both rolls on every tile so a threshold change never shifts later tiles' draws.
      const treeRoll = scatter.chance(def.treeChance);
      const bushRoll = scatter.chance(def.bushChance);
      if (inClearing || map.terrain[i] !== Terrain.Grass) continue;
      if (moisture[i]! > def.forestAbove && treeRoll) {
        map.feature[i] = Feature.Tree;
        map.amount[i] = treeWood;
      } else if (bushRoll) {
        map.feature[i] = Feature.Bush;
        map.amount[i] = bushMax;
      }
    }
  }
  map.feature[hearth.y * width + hearth.x] = Feature.Hearth;
  map.feature[store.y * width + store.x] = Feature.Store;
  return { map, hearth, store };
}

// Tiles on any level: the chunks the worker sends and `setTile`, the only writer of a tile after
// its level is made. Level `z` is 0 for the surface and 1 to `underground.depth` below it.
import type { LevelState, MapState } from '../core/index.ts';
import { findEvent } from '../log/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Tiles per chunk side. The worker sends the map to the screen a chunk at a time. */
export const CHUNK = 16;

export const chunksAcross = (map: MapState): number => Math.ceil(map.width / CHUNK);
export const chunksDown = (map: MapState): number => Math.ceil(map.height / CHUNK);

/** One level's tiles, features, causes and chunk versions; undefined below an unreached level. */
export function layerOf(map: MapState, z: number): MapState | LevelState | undefined {
  if (z === 0) return map;
  return map.levels[z - 1] ?? undefined;
}

/** The ground, features, snow and ice of chunk (cx, cy) on level `z`, row by row; edge chunks
 * are narrower or shorter. Below the surface there is no snow or ice. */
export function chunkTiles(
  map: MapState,
  cx: number,
  cy: number,
  z = 0,
): {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  features: Uint8Array;
  snow: Uint8Array;
  ice: Uint8Array;
} {
  const layer = layerOf(map, z);
  if (!layer) throw new Error(`Level ${z} has not been reached.`);
  const x = cx * CHUNK;
  const y = cy * CHUNK;
  const w = Math.min(CHUNK, map.width - x);
  const h = Math.min(CHUNK, map.height - y);
  const tiles = new Uint8Array(w * h);
  const features = new Uint8Array(w * h);
  const snow = new Uint8Array(w * h);
  const ice = new Uint8Array(w * h);
  for (let row = 0; row < h; row += 1)
    for (let col = 0; col < w; col += 1) {
      const from = (y + row) * map.width + x + col;
      tiles[row * w + col] = layer.tiles[from]!;
      features[row * w + col] = layer.features[from]!;
      if (z === 0) snow[row * w + col] = map.snow[from]!;
      if (z === 0) ice[row * w + col] = map.ice[from]! >> 7;
    }
  return { x, y, z, w, h, tiles, features, snow, ice };
}

/**
 * The only writer of a tile after its level is made: sets the kind, records `cause` (the event
 * that explains the change, which the caller emits first) for the inspector, and raises the
 * chunk's version so the worker resends it. Below the surface, a tile that stops being rock
 * loses its vein: the ore is dug through.
 */
export function setTile(
  ctx: SystemContext,
  x: number,
  y: number,
  kind: number,
  cause: number,
  z = 0,
): void {
  const map = ctx.world.map;
  const def = ctx.content.terrain.kinds[kind];
  if (!def) throw new Error(`Terrain ${kind} is not a terrain kind.`);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height)
    throw new Error(`Tile ${x}, ${y} is off the map.`);
  const layer = layerOf(map, z);
  if (!layer) throw new Error(`Tile ${x}, ${y} is on level ${z}, which has not been reached.`);
  if (!findEvent(ctx.world.log, cause))
    throw new Error(`Tile ${x}, ${y} was changed without a ledger line (cause ${cause}).`);
  const i = y * map.width + x;
  if (layer.tiles[i] === kind) return;
  layer.tiles[i] = kind;
  layer.tileCauses[i] = cause;
  if (z > 0 && !def.stone) layer.features[i] = 0;
  layer.chunkVersions[Math.floor(y / CHUNK) * chunksAcross(map) + Math.floor(x / CHUNK)]! += 1;
}

/** Raises the version of the chunk holding (x, y) on level `z`, so the worker resends it: for
 * changes that are not a new kind, such as a lake tile freezing. */
export function raiseChunk(map: MapState, x: number, y: number, z = 0): void {
  const layer = layerOf(map, z);
  if (layer)
    layer.chunkVersions[Math.floor(y / CHUNK) * chunksAcross(map) + Math.floor(x / CHUNK)]! += 1;
}

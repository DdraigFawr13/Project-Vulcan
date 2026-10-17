// The surface map: laid out once when a world begins by the terrain generator, from the reserved
// `worldgen` stream; afterwards only `setTile` changes a tile.
import type { MapState } from '../core/index.ts';
import { findEvent } from '../log/index.ts';
import type { System, SystemContext } from '../sim/index.ts';
import { findStart, placeFeatures } from './features.ts';
import { layGround } from './terrain.ts';

/** Tiles per chunk side. The worker sends the map to the screen a chunk at a time. */
export const CHUNK = 16;

export const chunksAcross = (map: MapState): number => Math.ceil(map.width / CHUNK);
export const chunksDown = (map: MapState): number => Math.ceil(map.height / CHUNK);

/** The ground and features of chunk (cx, cy), row by row; edge chunks are narrower or shorter. */
export function chunkTiles(
  map: MapState,
  cx: number,
  cy: number,
): { x: number; y: number; w: number; h: number; tiles: Uint8Array; features: Uint8Array } {
  const x = cx * CHUNK;
  const y = cy * CHUNK;
  const w = Math.min(CHUNK, map.width - x);
  const h = Math.min(CHUNK, map.height - y);
  const tiles = new Uint8Array(w * h);
  const features = new Uint8Array(w * h);
  for (let row = 0; row < h; row += 1)
    for (let col = 0; col < w; col += 1) {
      const from = (y + row) * map.width + x + col;
      tiles[row * w + col] = map.tiles[from]!;
      features[row * w + col] = map.features[from]!;
    }
  return { x, y, w, h, tiles, features };
}

/**
 * The only writer of a tile after the map is formed: sets the kind, records `cause` (the event
 * that explains the change, which the caller emits first) for the inspector, and raises the
 * chunk's version so the worker resends it.
 */
export function setTile(
  ctx: SystemContext,
  x: number,
  y: number,
  kind: number,
  cause: number,
): void {
  const map = ctx.world.map;
  if (!ctx.content.terrain.kinds[kind]) throw new Error(`Terrain ${kind} is not a terrain kind.`);
  if (x < 0 || y < 0 || x >= map.width || y >= map.height)
    throw new Error(`Tile ${x}, ${y} is off the map.`);
  if (!findEvent(ctx.world.log, cause))
    throw new Error(`Tile ${x}, ${y} was changed without a ledger line (cause ${cause}).`);
  if (map.tiles[y * map.width + x] === kind) return;
  map.tiles[y * map.width + x] = kind;
  map.tileCauses[y * map.width + x] = cause;
  map.chunkVersions[Math.floor(y / CHUNK) * chunksAcross(map) + Math.floor(x / CHUNK)]! += 1;
}

/** Lays out the map in `init` (generation belongs there, not in a cadence); it never runs on load. */
export const mapSystem: System = {
  id: 'map',
  every: 'day', // a cadence is required; the surface has no daily work yet
  stream: 'worldgen',
  emits: ['map.formed'],
  init(ctx) {
    const { width, height } = ctx.content.terrain.surface;
    const rng = ctx.rng();
    const ground = layGround(rng, ctx.content, width, height);
    const features = placeFeatures(rng, ctx.content, ground, width, height);
    const start = findStart(ctx.content, ground.tiles, features, width, height);
    const map = ctx.world.map;
    map.width = width;
    map.height = height;
    map.tiles = ground.tiles;
    map.elevation = Int16Array.from(ground.elevation);
    map.biomes = Uint8Array.from(ground.biomes);
    map.fertility = Uint8Array.from(ground.fertility);
    map.features = Uint8Array.from(features);
    map.startX = start.x;
    map.startY = start.y;
    map.climate = ground.climate;
    map.temperature = ground.temperature;
    map.rainfall = ground.rainfall;
    map.chunkVersions = new Array<number>(chunksAcross(map) * chunksDown(map)).fill(1);
    const formed = ctx.emit('map.formed', {
      causes: [ctx.world.begunEvent],
      data: {
        width,
        height,
        climate: ctx.content.terrain.generator.climates.find((c) => c.id === ground.climate)!.name,
        biome: mainBiome(ctx, ground.biomes),
        temperature: ground.temperature,
        rainfall: ground.rainfall,
        startX: start.x,
        startY: start.y,
        startMet: start.met ? 1 : 0,
      },
    });
    map.tileCauses = new Array<number>(width * height).fill(formed);
  },
};

/** The name of the biome covering the most tiles (ties to the earlier biome). */
function mainBiome(ctx: SystemContext, biomes: readonly number[]): string {
  const counts = new Array<number>(ctx.content.biomes.biomes.length).fill(0);
  for (const b of biomes) counts[b]! += 1;
  let best = 0;
  for (let b = 1; b < counts.length; b += 1) if (counts[b]! > counts[best]!) best = b;
  return ctx.content.biomes.biomes[best]!.name.toLowerCase();
}

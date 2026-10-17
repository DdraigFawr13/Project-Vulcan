// The surface map: laid out once when a world begins, flat ground of the content's starting kind
// until Phase 1's terrain generator (which will draw from the reserved `worldgen` stream).
import type { MapState } from '../core/index.ts';
import { findEvent } from '../log/index.ts';
import type { System, SystemContext } from '../sim/index.ts';

/** Tiles per chunk side. The worker sends the map to the screen a chunk at a time. */
export const CHUNK = 16;

export const chunksAcross = (map: MapState): number => Math.ceil(map.width / CHUNK);
export const chunksDown = (map: MapState): number => Math.ceil(map.height / CHUNK);

/** The tiles of chunk (cx, cy), row by row; edge chunks are narrower or shorter. */
export function chunkTiles(
  map: MapState,
  cx: number,
  cy: number,
): { x: number; y: number; w: number; h: number; tiles: Uint8Array } {
  const x = cx * CHUNK;
  const y = cy * CHUNK;
  const w = Math.min(CHUNK, map.width - x);
  const h = Math.min(CHUNK, map.height - y);
  const tiles = new Uint8Array(w * h);
  for (let row = 0; row < h; row += 1)
    for (let col = 0; col < w; col += 1)
      tiles[row * w + col] = map.tiles[(y + row) * map.width + x + col]!;
  return { x, y, w, h, tiles };
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
  every: 'day', // a cadence is required; the map has no daily work until Phase 1
  emits: ['map.formed'],
  init(ctx) {
    const { surface, kinds } = ctx.content.terrain;
    const ground = kinds.findIndex((k) => k.id === surface.ground);
    if (ground < 0) throw new Error(`Terrain "${surface.ground}" is not a terrain kind.`);
    const map = ctx.world.map;
    map.width = surface.width;
    map.height = surface.height;
    map.tiles = new Array<number>(surface.width * surface.height).fill(ground);
    map.chunkVersions = new Array<number>(chunksAcross(map) * chunksDown(map)).fill(1);
    const formed = ctx.emit('map.formed', {
      causes: [ctx.world.begunEvent],
      data: { width: map.width, height: map.height, ground: kinds[ground]!.name },
    });
    map.tileCauses = new Array<number>(surface.width * surface.height).fill(formed);
  },
};

// Tiles on any level: the chunks the worker sends and `setTile`, the only writer of a tile after
// its level is made. Level `z` is 0 for the surface and 1 to `underground.depth` below it.
import type { LevelState, MapState } from '../core/index.ts';
import { recordOf } from '../log/index.ts';
import type { SystemContext } from '../sim/index.ts';

/** Tiles per chunk side. The worker sends the map to the screen a chunk at a time. */
export const CHUNK = 16;

export const chunksAcross = (map: MapState): number => Math.ceil(map.width / CHUNK);
export const chunksDown = (map: MapState): number => Math.ceil(map.height / CHUNK);

/** Whether a terrain kind has to be dug out to be passed: rock (`stone`) or packed earth
 * (`solid`). Open ground, floors and water are not. */
export const diggable = (kind: { stone?: boolean; solid?: boolean }): boolean =>
  !!(kind.stone || kind.solid);

/** One level's tiles, features, causes and chunk versions; undefined below an unreached level. */
export function layerOf(map: MapState, z: number): MapState | LevelState | undefined {
  if (z === 0) return map;
  return map.levels[z - 1] ?? undefined;
}

/** The ground, features, snow and ice of chunk (cx, cy) on level `z`, row by row; edge chunks
 * are narrower or shorter. Below the surface there is no snow or ice. `snowLie` is the weather's
 * lying snow; `printKind` (0, or 1 + a `wild.prints` index), `printAge` (hours since, up to 255 at
 * `tick`) and `printDir` (0 to 7) the animals' prints that `printHours` has not yet taken; `worn`
 * the stage the ground's wear has reached (P5.10). */
export function chunkTiles(
  map: MapState,
  cx: number,
  cy: number,
  z = 0,
  tick = 0,
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
  snowLie: Uint8Array;
  printKind: Uint8Array;
  printAge: Uint8Array;
  printDir: Uint8Array;
  worn: Uint8Array;
  built: Uint8Array;
  known: Uint8Array;
  stains: Uint8Array;
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
  const snowLie = new Uint8Array(w * h);
  const printKind = new Uint8Array(w * h);
  const printAge = new Uint8Array(w * h);
  const printDir = new Uint8Array(w * h);
  const worn = new Uint8Array(w * h);
  const built = new Uint8Array(w * h);
  const known = new Uint8Array(w * h);
  const stains = new Uint8Array(w * h);
  for (let row = 0; row < h; row += 1)
    for (let col = 0; col < w; col += 1) {
      const from = (y + row) * map.width + x + col;
      tiles[row * w + col] = layer.tiles[from]!;
      features[row * w + col] = layer.features[from]!;
      if (z === 0) snow[row * w + col] = map.snow[from]!;
      if (z === 0) ice[row * w + col] = map.ice[from]! >> 7;
      if (z === 0) snowLie[row * w + col] = map.snowLie[from]!;
      if (z === 0 && map.printKind[from]) {
        printKind[row * w + col] = map.printKind[from]!;
        printAge[row * w + col] = Math.max(
          0,
          Math.min(255, Math.floor((tick - map.printAt[from]!) / 60)),
        );
        printDir[row * w + col] = map.printDir[from]!;
      }
      if (z === 0) worn[row * w + col] = map.worn[from]!;
      if (z === 0) built[row * w + col] = map.built[from]!;
      if (z === 0) stains[row * w + col] = map.stains[from]!;
      known[row * w + col] = z === 0 ? 1 : (layer as LevelState).known[from]!;
    }
  return {
    ...{ x, y, z, w, h, tiles, features, snow, ice, snowLie },
    ...{ printKind, printAge, printDir, worn, built, known, stains },
  };
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
  if (!recordOf(ctx.world, cause))
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

/** The only writer of what is built on a surface tile (P3.1): 0 for nothing, else 1 + a part
 * index. Records `cause` for the inspector and raises the chunk's version, so ways are found
 * again round a new wall. */
export function setBuilt(
  ctx: SystemContext,
  x: number,
  y: number,
  part: number,
  cause: number,
): void {
  const map = ctx.world.map;
  const i = y * map.width + x;
  map.built[i] = part;
  map.tileCauses[i] = cause;
  raiseChunk(map, x, y);
}

/** What `check` says with `part` built on surface tile (x, y) for its length only; the tile is
 * then as it was. For asking whether a part would cut a way, never for building it. */
export function withBuilt<T>(map: MapState, x: number, y: number, part: number, check: () => T): T {
  return withBuiltAll(map, [y * map.width + x], part, check);
}

/** `withBuilt` for many surface tiles (indices) at once: a whole edge before it is planned. */
export function withBuiltAll<T>(
  map: MapState,
  tiles: readonly number[],
  part: number,
  check: () => T,
): T {
  const was = tiles.map((i) => map.built[i]!);
  const raise = () =>
    tiles.forEach((i) => raiseChunk(map, i % map.width, Math.floor(i / map.width)));
  for (const i of tiles) map.built[i] = part;
  raise();
  try {
    return check();
  } finally {
    tiles.forEach((i, k) => (map.built[i] = was[k]!));
    raise();
  }
}

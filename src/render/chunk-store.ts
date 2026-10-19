// The whole-map arrays of one level, filled chunk by chunk as the worker sends them. The scene
// reads them to pick pictures; water pictures need a tile's neighbours, so the map is kept whole.
import type { ChunkView } from '../worker/index.ts';

export interface LevelArrays {
  ground: Uint8Array;
  snow: Uint8Array;
  ice: Uint8Array;
  /** 0 for a bare tile, else 1 + a features index. */
  things: Uint8Array;
  /** 1 where the tile is known (V-030). */
  known: Uint8Array;
  /** Surface only: 0, or 1 + the features index of the vein stained below. */
  stains: Uint8Array;
}

/** Copies `chunk` into its level's arrays (made on first use) in a map `width` by `height`. */
export function storeChunk(
  levels: LevelArrays[],
  chunk: ChunkView,
  width: number,
  height: number,
): void {
  const { x, y, z, w, h } = chunk;
  const n = width * height;
  const level = (levels[z] ??= {
    ground: new Uint8Array(n),
    snow: new Uint8Array(n),
    ice: new Uint8Array(n),
    things: new Uint8Array(n),
    known: new Uint8Array(n),
    stains: new Uint8Array(n),
  });
  for (let row = 0; row < h; row += 1)
    for (let col = 0; col < w; col += 1) {
      const i = (y + row) * width + x + col;
      const from = row * w + col;
      level.ground[i] = chunk.tiles[from]!;
      level.snow[i] = chunk.snow[from]!;
      level.ice[i] = chunk.ice[from]!;
      level.things[i] = chunk.features[from]!;
      level.known[i] = chunk.known[from]!;
      level.stains[i] = chunk.stains[from]!;
    }
}

// Which shore or deep-water picture a water tile shows, from its neighbours' kinds: the 47-frame
// blob set `water.shore.<mask>` and the 16-frame `water.deep.<mask>` set drawn by
// tools/draw-water.mjs. Picture choice only; it reads kinds and never state.

// Neighbour bits, clockwise from north; tools/draw-water.mjs uses the same.
const N = 1;
const NE = 2;
const E = 4;
const SE = 8;
const S = 16;
const SW = 32;
const W = 64;
const NW = 128;
const AROUND: readonly (readonly [number, number, number])[] = [
  [0, -1, N],
  [1, -1, NE],
  [1, 0, E],
  [1, 1, SE],
  [0, 1, S],
  [-1, 1, SW],
  [-1, 0, W],
  [-1, -1, NW],
];

/** A blob mask with corners kept only when both their sides are set: one of 47 values. */
export function blobMask(m: number): number {
  let out = m & (N | E | S | W);
  if (m & NE && m & N && m & E) out |= NE;
  if (m & SE && m & S && m & E) out |= SE;
  if (m & SW && m & S && m & W) out |= SW;
  if (m & NW && m & N && m & W) out |= NW;
  return out;
}

export type WaterPicture =
  /** Not water: draw the tile's own picture. */
  | { kind: 'dry' }
  /** Water with land beside it: the land picture of `under` (a tile index) below a shore frame. */
  | { kind: 'shore'; under: number; frame: string }
  /** Open water: shallow below, and over deep water the deep frame for its deep sides. */
  | { kind: 'open'; deep: string | undefined };

/**
 * The picture for tile (x, y). `water(i)` is 0 for dry land, 1 shallow, 2 deep; tiles off the map
 * count as the tile's own water, so rivers run off the edge cleanly.
 */
export function waterPicture(
  x: number,
  y: number,
  width: number,
  height: number,
  water: (i: number) => number,
): WaterPicture {
  const self = water(y * width + x);
  if (!self) return { kind: 'dry' };
  let mask = 0;
  let deepSides = 0;
  let side = -1;
  let corner = -1;
  for (const [dx, dy, bit] of AROUND) {
    const nx = x + dx;
    const ny = y + dy;
    const off = nx < 0 || ny < 0 || nx >= width || ny >= height;
    const there = off ? self : water(ny * width + nx);
    if (there) mask |= bit;
    else if (bit & (N | E | S | W)) side = side < 0 ? ny * width + nx : side;
    else corner = corner < 0 ? ny * width + nx : corner;
    if (there === 2 && bit & (N | E | S | W)) deepSides |= bit;
  }
  if (mask !== 255)
    return {
      kind: 'shore',
      under: side >= 0 ? side : corner,
      frame: `water.shore.${blobMask(mask)}`,
    };
  if (self !== 2) return { kind: 'open', deep: undefined };
  const sides =
    (deepSides & N ? 1 : 0) |
    (deepSides & E ? 2 : 0) |
    (deepSides & S ? 4 : 0) |
    (deepSides & W ? 8 : 0);
  return { kind: 'open', deep: `water.deep.${sides}` };
}

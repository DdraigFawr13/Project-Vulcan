// Rock faces and the seams in them (6W Slice 7, V-215): a face is a surface stone tile beside
// open ground; it shows a seam when a vein with a `seam` colour lies within one tile of it below,
// on the vein's level (the shallowest wins). Nothing on the ground marks it: the layer is the
// world's truth, read only by whoever stands beside the face (land `seams.ts`). The levels are
// laid out here only to read their veins (their own `veins` sub-streams, so `worldgen` is
// untouched). Bit 128 marks a face a prospector has walked, so the next trip goes farther; land
// `prospect.ts` keeps when and by what skill, and the face is fresh again after a year (V-224).
import type { EngineContent, MapState } from '../core/index.ts';
import { makeLevel } from './underground.ts';

const WALKED = 128;
const SIDES = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;

/** The faces layer: 0 not a face, 1 a face, 1 + f a face over the seam of features index f - 1. */
export function facesOf(seed: string, content: EngineContent, map: MapState): Uint8Array {
  const [W, H] = [map.width, map.height];
  const faces = new Uint8Array(W * H);
  const kinds = content.terrain.kinds;
  const open = (i: number): boolean => {
    const k = kinds[map.tiles[i]!]!;
    return !k.stone && !k.solid && k.water !== 'deep';
  };
  for (let y = 1; y < H - 1; y += 1)
    for (let x = 1; x < W - 1; x += 1) {
      const i = y * W + x;
      if (!kinds[map.tiles[i]!]!.stone) continue;
      if (SIDES.some(([dx, dy]) => open((y + dy) * W + x + dx))) faces[i] = 1;
    }
  const levels = [
    ...new Set(content.features.flatMap((f) => (f.vein?.seam ? [f.vein.level] : []))),
  ].sort((a, b) => a - b);
  for (const level of levels) {
    const { features } = makeLevel(seed, content, map, level);
    for (let i = 0; i < faces.length; i += 1) {
      if (faces[i] !== 1) continue;
      const [x, y] = [i % W, Math.floor(i / W)];
      for (let dy = -1; dy <= 1 && faces[i] === 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          const f = features[(y + dy) * W + x + dx]!;
          if (f && content.features[f - 1]!.vein?.seam) {
            faces[i] = 1 + f;
            break;
          }
        }
    }
  }
  return faces;
}

/** Whether tile `i` is a rock face. */
export const isFace = (map: MapState, i: number): boolean => (map.faces[i]! & ~WALKED) > 0;

/** The seam in face `i`: 1 + a features index, or 0 for none. */
export const seamAt = (map: MapState, i: number): number => {
  const v = map.faces[i]! & ~WALKED;
  return v > 1 ? v - 1 : 0;
};

/** Whether a prospector has walked face `i`. */
export const faceWalked = (map: MapState, i: number): boolean => (map.faces[i]! & WALKED) > 0;

/** Marks the faces within a tile of (x, y) that `fresh` passes walked; returns their tiles. */
export function walkFaces(
  map: MapState,
  x: number,
  y: number,
  fresh: (i: number) => boolean = (i) => !faceWalked(map, i),
): number[] {
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1)
    for (let dx = -1; dx <= 1; dx += 1) {
      const [fx, fy] = [x + dx, y + dy];
      if (fx < 0 || fy < 0 || fx >= map.width || fy >= map.height) continue;
      const i = fy * map.width + fx;
      if (!isFace(map, i) || !fresh(i)) continue;
      map.faces[i] = map.faces[i]! | WALKED;
      out.push(i);
    }
  return out;
}

/** Every face's tile index, in tile order: the faces never change, so they are listed once. */
const LISTS = new WeakMap<Uint8Array, number[]>();
export function faceList(map: MapState): readonly number[] {
  let list = LISTS.get(map.faces);
  if (!list) {
    list = [];
    for (let i = 0; i < map.faces.length; i += 1) if (map.faces[i]) list.push(i);
    LISTS.set(map.faces, list);
  }
  return list;
}

/** How a face's rock counts for spotting `vein`'s seam (V-215): `odds[0]` in the rock the ore
 * likes best (its highest `vein.rocks` weight), `odds[1]` in the next, `odds[2]` in any other. */
export function rockOdds(
  vein: { rocks: Readonly<Record<string, number>> },
  rock: string,
  odds: readonly number[],
): number {
  const ranks = [...new Set(Object.values(vein.rocks))].sort((a, b) => b - a);
  const w = vein.rocks[rock];
  const k = w === undefined ? 2 : Math.min(2, ranks.indexOf(w));
  return odds[k] ?? 0;
}

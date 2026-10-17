// Draws the P1.2 water art (docs/ART.md row P1.1 to P1.3) from the palette: the 47-frame shore
// set `water.shore.<mask>` (shallow water meeting land, transparent where the land shows through)
// and the 16-frame `water.deep.<mask>` set (deep water inside shallow) into art/src/tiles-world,
// and the `spring.1` marker into art/src/sprites-nature. Masks are in src/render/water-art.ts.
// Seeded and position-free, so a re-run gives identical files. Usage: node tools/draw-water.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readPalette } from './draw-tiles-base.mjs';
import { isMain, root } from './lib.mjs';
import { createImage, decodePng, encodePng } from './png.mjs';
import { readFileSync } from 'node:fs';

const S = 32;
// Neighbour bits, clockwise from north (src/render/water-art.ts uses the same).
const N = 1;
const NE = 2;
const E = 4;
const SE = 8;
const SO = 16;
const SW = 32;
const W = 64;
const NW = 128;

/** The 47 blob masks: a corner counts only when both its sides are water too. */
export function blobMasks() {
  const out = new Set();
  for (let m = 0; m < 256; m++) out.add(normalise(m));
  return [...out].sort((a, b) => a - b);
}

export function normalise(m) {
  let out = m & (N | E | SO | W);
  if (m & NE && m & N && m & E) out |= NE;
  if (m & SE && m & SO && m & E) out |= SE;
  if (m & SW && m & SO && m & W) out |= SW;
  if (m & NW && m & N && m & W) out |= NW;
  return out;
}

// The bank's depth into the tile at position t (0 to 32) along an edge: a gentle wobble with a
// period of the tile, so neighbouring tiles meet. Plain Math is fine here: tools are not the engine.
const bank = (t, base, seed) =>
  base +
  1.4 * Math.sin((2 * Math.PI * t) / S + seed) +
  0.8 * Math.sin((4 * Math.PI * t) / S + 2 * seed);

/** Whether pixel centre (x, y) is land in a frame whose water neighbours are `m`. */
function landAt(x, y, m, base, round) {
  const edges = [
    [N, y, x, 0.3],
    [SO, S - y, x, 1.1],
    [W, x, y, 1.9],
    [E, S - x, y, 2.7],
  ];
  for (const [bit, depth, along, seed] of edges)
    if (!(m & bit) && depth < bank(along, base, seed)) return true;
  // Rounded water corners where two land sides meet; land notches where only a corner is land.
  const corners = [
    [N, W, NW, 0, 0],
    [N, E, NE, S, 0],
    [SO, W, SW, 0, S],
    [SO, E, SE, S, S],
  ];
  for (const [a, b, c, cx, cy] of corners) {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    if (!(m & a) && !(m & b)) {
      const k = base + round;
      if (dx < k && dy < k && Math.hypot(k - dx, k - dy) > round) return true;
    } else if (m & a && m & b && !(m & c) && Math.hypot(dx, dy) < base + 0.5) return true;
  }
  return false;
}

/** One overlay frame: `fill` pixels where water is, a light rim along the bank, clear land. */
function frame(m, fill, rim, base, round) {
  const image = createImage(S, S);
  const water = (x, y) =>
    x < 0 || y < 0 || x >= S || y >= S ? true : !landAt(x + 0.5, y + 0.5, m, base, round);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!water(x, y)) continue;
      const edge = !water(x - 1, y) || !water(x + 1, y) || !water(x, y - 1) || !water(x, y + 1);
      const colour = edge && rim ? rim : fill(x, y);
      image.data.set([...colour, 255], (y * S + x) * 4);
    }
  return image;
}

/** The four-sided masks of the deep set: bits N, E, S, W of deep neighbours. */
const toBlob = (m4) => (m4 & 1 ? N : 0) | (m4 & 2 ? E : 0) | (m4 & 4 ? SO : 0) | (m4 & 8 ? W : 0);

function spring(p) {
  const image = createImage(S, S);
  const set = (x, y, c) => image.data.set([...p[c], 255], (y * S + x) * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const r = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
      if (r >= 6 && r < 7.2) set(x, y, 'shallow water light');
      else if (r >= 3 && r < 4) set(x, y, 'shallow water light');
      else if (r < 1.5) set(x, y, 'bone');
    }
  return image;
}

export function drawWater(p = readPalette()) {
  const tile = (name) =>
    decodePng(readFileSync(path.join(root, 'art/src/tiles-base', `${name}.png`)));
  const shallow = tile('tile.water-shallow.1');
  const deep = tile('tile.water-deep.1');
  const pick = (image) => (x, y) => [...image.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 3)];
  const world = {};
  for (const m of blobMasks())
    world[`water.shore.${m}`] = frame(m, pick(shallow), p['shallow water light'], 7, 6);
  for (let m4 = 0; m4 < 16; m4++)
    world[`water.deep.${m4}`] = frame(toBlob(m4) | NE | SE | SW | NW, pick(deep), undefined, 5, 4);
  return { 'tiles-world': world, 'sprites-nature': { 'spring.1': spring(p) } };
}

if (isMain(import.meta.url)) {
  for (const [sheet, frames] of Object.entries(drawWater())) {
    const out = path.join(root, 'art/src', sheet);
    mkdirSync(out, { recursive: true });
    for (const [name, image] of Object.entries(frames))
      writeFileSync(path.join(out, `${name}.png`), encodePng(image));
    console.log(`${sheet}: drew ${Object.keys(frames).length} water frames into ${out}`);
  }
}

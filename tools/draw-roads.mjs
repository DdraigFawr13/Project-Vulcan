// Draws the P5.10 art (docs/ART.md row P5.10, taste board pick A and grey stone roads): into
// art/src/tiles-world the worn-ground overlays `wear.<1-3>.<1|2>`, earth showing through grass in
// clumps of dirt pixels on transparent, denser at each stage (two variants a stage, picked by the
// page from a position hash); into art/src/buildings the road `build.road-stone`, opaque grey
// flags of uneven size laid in dirt joints. Colours only from art/palette.gpl, no randomness: the
// same output every run. Usage: node tools/draw-roads.mjs, then
// node tools/pack-sheet.mjs tiles-world buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';

const S = 32;
// The share of the tile showing earth at each stage: thin, worn, a bare track.
const SHARE = [0.25, 0.5, 0.82];

function put(image, x, y, colour, alpha = 255) {
  image.data.set([...colour, alpha], (y * S + x) * 4);
}

// Earth through grass: clumps of 2 by 2 pixels by a smooth-ish hash, so it reads as trodden
// patches rather than noise; the darker earth where it is barest.
function wear(p, stage, variant) {
  const image = createImage(S, S);
  const share = SHARE[stage - 1];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = noise(70 + variant, x >> 1, y >> 1) * 0.7 + noise(80 + variant, x, y) * 0.3;
      if (v >= share) continue;
      const colour =
        v < share * 0.3 ? p['dirt dark'] : v < share * 0.75 ? p['dirt'] : p['dirt light'];
      put(image, x, y, colour);
    }
  return image;
}

// Flags: a 3 by 3 grid of stones with uneven joints, each stone shaded from its top-left edge.
function road(p) {
  const image = createImage(S, S);
  const cuts = [0, 11, 21, 32];
  const shift = [0, 4, 2];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const row = cuts.findIndex((c, k) => y >= c && y < cuts[k + 1]);
      const xs = (x + shift[row]) % S;
      const col = cuts.findIndex((c, k) => xs >= c && xs < cuts[k + 1]);
      const top = y === cuts[row];
      const left = xs === cuts[col];
      if (top || left) {
        put(image, x, y, noise(90, x, y) < 0.5 ? p['dirt dark'] : p['dirt']);
        continue;
      }
      const edge = y === cuts[row] + 1 || xs === cuts[col] + 1;
      const v = noise(91 + row * 3 + col, x >> 1, y >> 1);
      const colour = edge
        ? p['gravel light']
        : v < 0.2
          ? p['gravel dark']
          : v > 0.85
            ? p['gravel light']
            : p['gravel'];
      put(image, x, y, colour);
    }
  return image;
}

export function drawRoads(p = readPalette()) {
  const world = {};
  for (const stage of [1, 2, 3])
    for (const variant of [1, 2]) world[`wear.${stage}.${variant}`] = wear(p, stage, variant);
  return { 'tiles-world': world, buildings: { 'build.road-stone': road(p) } };
}

if (isMain(import.meta.url)) {
  for (const [sheet, frames] of Object.entries(drawRoads())) {
    const out = path.join(root, 'art/src', sheet);
    mkdirSync(out, { recursive: true });
    for (const [name, image] of Object.entries(frames))
      writeFileSync(path.join(out, `${name}.png`), encodePng(image));
    console.log(
      `${sheet}: drew ${Object.keys(frames).length} worn-ground and road frames into ${out}`,
    );
  }
}

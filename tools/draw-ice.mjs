// Draws the P1.4 art (docs/ART.md row P1.4) from the palette into art/src/tiles-world: lake ice as
// the water set's shapes in ice colours (`ice.shore.<mask>`, 47 frames, and `ice.deep.<mask>`, 16,
// masks as in src/render/water-art.ts), open ice `tile.ice.1`, and the aura glows, one wash and one
// core per school (`aura.<school>.1`, `aura.<school>.core`), drawn translucent so the ground shows.
// Seeded and position-free, so a re-run gives identical files. Usage: node tools/draw-ice.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';
import { blobMasks, frame, toBlob } from './draw-water.mjs';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';

const S = 32;
const SCHOOLS = ['air', 'water', 'life', 'mind', 'earth', 'fire'];

// Ice: pale, mottled, with a few long hairline cracks; darker over deep water.
const iceFill = (p, deep) => (x, y) => {
  const crack = (x + 2 * y) % 23 === 0 || (3 * x - y + 64) % 29 === 0;
  if (crack && noise(41, x >> 2, y >> 2) < 0.55) return p['ice shade'];
  const v = noise(deep ? 43 : 42, x >> 1, y >> 1);
  if (deep) return v < 0.7 ? p['ice shade'] : p['ice'];
  return v < 0.18 ? p['ice light'] : v > 0.88 ? p['ice shade'] : p['ice'];
};

function openIce(p) {
  const image = createImage(S, S);
  const fill = iceFill(p, false);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) image.data.set([...fill(x, y), 255], (y * S + x) * 4);
  return image;
}

// A wash of the school's colour with a few motes, or the spot's bright core.
function glow(colour, core, seed) {
  const image = createImage(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
      let alpha = core ? Math.max(70, Math.round(230 - 9 * d)) : 70;
      if (noise(seed, x, y) > 0.985) alpha = 230;
      image.data.set([...colour, alpha], (y * S + x) * 4);
    }
  return image;
}

export function drawIce(p = readPalette()) {
  const world = { 'tile.ice.1': openIce(p) };
  for (const m of blobMasks())
    world[`ice.shore.${m}`] = frame(m, iceFill(p, false), p['ice light'], 7, 6);
  for (let m4 = 0; m4 < 16; m4++)
    world[`ice.deep.${m4}`] = frame(
      toBlob(m4) | 2 | 8 | 32 | 128,
      iceFill(p, true),
      undefined,
      5,
      4,
    );
  SCHOOLS.forEach((school, k) => {
    world[`aura.${school}.1`] = glow(p[`aura ${school}`], false, 50 + k);
    world[`aura.${school}.core`] = glow(p[`aura ${school}`], true, 60 + k);
  });
  return { 'tiles-world': world };
}

if (isMain(import.meta.url)) {
  for (const [sheet, frames] of Object.entries(drawIce())) {
    const out = path.join(root, 'art/src', sheet);
    mkdirSync(out, { recursive: true });
    for (const [name, image] of Object.entries(frames))
      writeFileSync(path.join(out, `${name}.png`), encodePng(image));
    console.log(`${sheet}: drew ${Object.keys(frames).length} ice and aura frames into ${out}`);
  }
}

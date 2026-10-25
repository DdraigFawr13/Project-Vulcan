// Draws the P5.2 well (docs/ART.md) into art/src/buildings/: `furn.well`, one tile: a round stone
// ring round dark water, two posts, a crossbar with a rope and a small thatched roof. Colours only
// from art/palette.gpl, a 1 px ink outline, top-down at the walls' three-quarter angle.
// Usage: node tools/draw-well.mjs, then node tools/pack-sheet.mjs buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { canvas, outline } from './draw-furniture.mjs';

export function wellBuildings(p = readPalette()) {
  const c = canvas();
  // The ring: stone courses round dark water.
  c.disc(16, 20, 11, p['rock dark']);
  c.disc(16, 19, 11, p.rock);
  c.disc(16, 19, 7.5, p['rock dark']);
  c.disc(16, 19, 6.5, p['deep water']);
  c.disc(15, 18, 4, p['shallow water']);
  c.rect(13, 16, 3, 1, p['shallow water light']);
  for (const [x, y] of [
    [7, 15],
    [10, 10],
    [22, 10],
    [25, 15],
    [6, 22],
    [26, 22],
    [12, 28],
    [20, 28],
  ])
    c.rect(x, y, 2, 1, p['rock light']);
  // Two posts, a crossbar with a rope, and a small thatched roof over them.
  c.rect(7, 8, 2, 14, p['ui oak']);
  c.rect(23, 8, 2, 14, p['ui oak']);
  c.rect(7, 8, 1, 14, p['ui oak light']);
  c.rect(23, 8, 1, 14, p['ui oak light']);
  c.rect(8, 11, 16, 2, p['ui oak light']);
  c.rect(15, 13, 1, 5, p['straw dark']);
  c.rect(14, 18, 3, 1, p['ui oak dark']);
  c.rect(4, 3, 24, 4, p.straw);
  c.rect(6, 1, 20, 3, p['straw light']);
  c.rect(8, 0, 16, 1, p['straw blade']);
  c.rect(4, 6, 24, 1, p['straw dark']);
  for (let x = 5; x < 28; x += 3) c.rect(x, 4, 1, 2, p['straw dark']);
  return { 'furn.well': outline(c.img, p.ink) };
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  for (const [name, img] of Object.entries(wellBuildings()))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log('well: drew furn.well');
}

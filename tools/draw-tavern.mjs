// Draws the 6B tavern pieces (docs/ART.md) into art/src/buildings/: `furn.ale-cask` (a barrel on a
// cradle), `furn.brew-tub` (a hooped tub of wort), `furn.counter` (a plank counter with a tankard)
// and `furn.sign` (a board on an iron bracket, hung by the tavern's door). One tile each, colours
// only from art/palette.gpl, a 1 px ink outline. Stand-ins under the PixelLab frames in art/final.
// Usage: node tools/draw-tavern.mjs, then node tools/pack-sheet.mjs buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { canvas, outline } from './draw-furniture.mjs';

export function tavernBuildings(p = readPalette()) {
  const cask = canvas();
  cask.rect(6, 24, 20, 4, p['ui oak grain']);
  cask.disc(16, 16, 10, p['ui oak grain']);
  cask.disc(15, 15, 8.5, p['ui oak']);
  for (const x of [9, 22]) cask.rect(x, 7, 2, 18, p['ui iron']);
  cask.rect(15, 14, 2, 3, p.amber);
  const tub = canvas();
  tub.disc(16, 17, 12, p['ui oak grain']);
  tub.disc(16, 16, 10, p['straw dark']);
  tub.disc(15, 15, 7, p.straw);
  tub.rect(20, 3, 2, 12, p['ui oak light']);
  const counter = canvas();
  counter.rect(2, 10, 28, 12, p['ui oak grain']);
  counter.rect(2, 10, 28, 3, p['ui oak light']);
  counter.rect(3, 13, 26, 8, p['ui oak']);
  counter.rect(8, 5, 4, 6, p['ui iron light']);
  counter.rect(20, 6, 4, 5, p['ui iron light']);
  const sign = canvas();
  sign.rect(6, 3, 22, 2, p['ui iron dark']);
  sign.rect(8, 5, 1, 4, p['ui iron']);
  sign.rect(24, 5, 1, 4, p['ui iron']);
  sign.rect(6, 9, 21, 18, p['ui oak grain']);
  sign.rect(7, 10, 19, 16, p['ui oak']);
  sign.rect(12, 14, 9, 8, p.amber);
  return {
    'furn.ale-cask': outline(cask.img, p.ink),
    'furn.brew-tub': outline(tub.img, p.ink),
    'furn.counter': outline(counter.img, p.ink),
    'furn.sign': outline(sign.img, p.ink),
  };
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  for (const [name, img] of Object.entries(tavernBuildings()))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log('tavern: drew furn.ale-cask, furn.brew-tub, furn.counter, furn.sign');
}

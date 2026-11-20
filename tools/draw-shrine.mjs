// Draws the 6B shrines (docs/ART.md) into art/src/buildings/: `furn.shrine-stone`, the Wells'
// spring-stone (a grey standing stone over a small round pool), and `furn.shrine`, the wayside
// shrine of every other faith (an oak post with a little roof on a stone footing). One tile each,
// colours only from art/palette.gpl, a 1 px ink outline, top-down at the walls' angle. Stand-ins
// until PixelLab draws them (art/final wins over art/src when packing).
// Usage: node tools/draw-shrine.mjs, then node tools/pack-sheet.mjs buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { canvas, outline } from './draw-furniture.mjs';

export function shrineBuildings(p = readPalette()) {
  const stone = canvas();
  // The pool at its foot.
  stone.disc(16, 25, 8, p['rock dark']);
  stone.disc(16, 25, 6.5, p['deep water']);
  stone.disc(15, 24, 4, p['shallow water']);
  stone.rect(12, 23, 3, 1, p['shallow water light']);
  // The standing stone: tall, a little lean, a lighter face and a carved ring.
  stone.rect(12, 4, 8, 20, p['rock dark']);
  stone.rect(13, 3, 6, 20, p.rock);
  stone.rect(14, 2, 4, 1, p['rock light']);
  stone.rect(13, 4, 2, 17, p['rock light']);
  stone.disc(16, 11, 2.5, p['rock dark']);
  stone.disc(16, 11, 1.5, p.rock);
  stone.rect(18, 6, 1, 15, p['rock edge']);
  for (const [x, y] of [
    [9, 20],
    [22, 21],
    [11, 29],
    [21, 29],
  ])
    stone.rect(x, y, 2, 1, p['grass light']);
  const way = canvas();
  // The stone footing.
  way.rect(9, 22, 14, 6, p['rock dark']);
  way.rect(10, 22, 12, 5, p.rock);
  way.rect(10, 22, 12, 1, p['rock light']);
  // The post, a niche with an amber light, and the little roof.
  way.rect(14, 8, 4, 15, p['oak dark']);
  way.rect(14, 8, 2, 15, p.oak);
  way.rect(13, 11, 6, 5, p['oak dark']);
  way.rect(14, 12, 4, 3, p.amber);
  way.rect(10, 5, 12, 3, p['straw dark']);
  way.rect(11, 4, 10, 2, p.straw);
  way.rect(12, 3, 8, 1, p['straw light']);
  return {
    'furn.shrine-stone': outline(stone.img, p.ink),
    'furn.shrine': outline(way.img, p.ink),
  };
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  for (const [name, img] of Object.entries(shrineBuildings()))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log('shrine: drew furn.shrine-stone, furn.shrine');
}

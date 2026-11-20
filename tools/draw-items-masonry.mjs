// Draws the masonry material `items` icons into art/src/items/: `item.slate` (a stack of thin
// blue-grey slates), `item.limestone` (pale cream rough lumps), `item.lime` (a heap of burnt-lime
// powder) and `item.ashlar` (dressed, squared blocks). One tile each, a 1 px ink outline, colours
// only from art/palette.gpl; deterministic.
// Usage: node tools/draw-items-masonry.mjs, then node tools/pack-sheet.mjs items
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { surface } from './draw-items-surface.mjs';
import { noise } from './draw-nature.mjs';

export function masonryItems(p = readPalette()) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };

  icon('item.slate', (s) => {
    // Three thin slabs stacked and slightly shifted: a lit top, a face and a dark edge each.
    const slab = (x, y, w) => {
      s.rect(x, y, w, 3, p['slate light']);
      s.rect(x, y + 1, w, 1, p['slate light']);
      s.rect(x, y + 2, w, 1, p.slate);
      s.rect(x + w - 1, y + 1, 1, 2, p.slate);
    };
    s.rect(9, 28, 15, 1, p['slate line']);
    slab(8, 25, 16);
    slab(10, 22, 14);
    slab(8, 19, 15);
    for (const [x, y] of [
      [13, 26],
      [18, 23],
      [12, 20],
    ])
      s.put(x, y, p['slate light']);
  });

  icon('item.limestone', (s) => {
    // Rough lumps, lighter and warmer than stone; cream light, shaded sides, a few pits.
    const lump = (cx, cy, rx, ry) =>
      s.ell(cx, cy, rx, ry, p.limestone, p['limestone light'], p['limestone dark']);
    s.ell(16, 27, 7, 2.5, p['limestone joint']);
    lump(12, 25, 4, 3.5);
    lump(20, 25, 4, 3.5);
    lump(16, 21, 4.5, 3.5);
    for (let k = 0; k < 8; k++) {
      const x = 9 + Math.floor(noise(11, k, 1) * 14);
      const y = 18 + Math.floor(noise(11, k, 2) * 10);
      if (s.image.data[(y * 32 + x) * 4 + 3] > 0)
        s.put(x, y, k % 2 ? p['limestone joint'] : p['limestone dark']);
    }
  });

  icon('item.lime', (s) => {
    // A small heap of white powder with a few loose grains.
    s.ell(16, 27, 8, 2.5, p['limestone dark']);
    s.ell(16, 25, 7, 4, p.bone, p['snow light'], p['limestone light']);
    s.ell(16, 22, 4, 3.5, p['snow light'], p['snow light'], p.bone);
    for (const [x, y] of [
      [8, 29],
      [24, 29],
      [12, 29],
      [21, 29],
    ])
      s.put(x, y, p.bone);
    for (const [x, y] of [
      [14, 25],
      [19, 26],
      [17, 22],
    ])
      s.put(x, y, p['limestone light']);
  });

  icon('item.ashlar', (s) => {
    // Three dressed blocks, two below and one on top: lit top and left edge, shaded right and base.
    const block = (x, y, w, h) => {
      s.rect(x, y, w, h, p.floor);
      s.rect(x, y, w, 1, p['floor light']);
      s.rect(x, y, 1, h, p['floor light']);
      s.rect(x + w - 1, y + 1, 1, h - 1, p['floor dark']);
      s.rect(x, y + h - 1, w, 1, p['floor dark']);
    };
    block(8, 23, 8, 5);
    block(16, 23, 8, 5);
    block(12, 17, 8, 6);
  });
  return frames;
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/items');
  mkdirSync(out, { recursive: true });
  for (const [name, img] of Object.entries(masonryItems()))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log('masonry: drew 4 frames');
}

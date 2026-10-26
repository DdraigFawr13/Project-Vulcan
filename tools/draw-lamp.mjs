// Draws the P5.13 lamp frames (docs/ART.md) into art/src/items/: `item.candle` (tallow),
// `item.wax-candle`, `item.wax`, `item.honey`, `item.soap`, `item.ash` and the bee skeps
// `skep.plan` (the renderer draws it at half opacity), `skep.empty` and `skep.bees`. One tile
// each, a 1 px ink outline, colours only from art/palette.gpl; deterministic.
// Usage: node tools/draw-lamp.mjs, then node tools/pack-sheet.mjs items
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { surface } from './draw-items-surface.mjs';

export function lampItems(p = readPalette()) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };
  // A candle: body from `x`, `w` wide, standing on `base`; flame above it.
  const candle = (s, x, top, w, body, light, shade) => {
    s.rect(x, top, w, 25 - top, body);
    s.rect(x, top, 1, 25 - top, light);
    s.rect(x + w - 1, top, 1, 25 - top, shade);
    s.rect(x, top, w, 1, light);
    s.put(x + Math.floor(w / 2), top - 1, p.ink); // wick
    s.put(x + Math.floor(w / 2), top - 2, p.amber);
    s.put(x + Math.floor(w / 2), top - 3, p.gold);
    s.put(x + Math.floor(w / 2) - 1, top - 2, p['straw light']);
    s.put(x + Math.floor(w / 2) + 1, top - 2, p['straw light']);
  };
  icon('item.candle', (s) => {
    // Two short, fat tallow candles on a dish; one lit.
    s.ell(16, 26, 11, 3.5, p['rock dark'], p.rock);
    candle(s, 8, 15, 7, p['limestone light'], p.bone, p['limestone dark']);
    s.rect(19, 18, 6, 8, p['limestone light']);
    s.rect(19, 18, 1, 8, p.bone);
    s.rect(24, 18, 1, 8, p['limestone dark']);
    s.put(22, 17, p.ink);
    s.rect(8, 22, 7, 1, p['straw blade']); // a tallow drip
    s.put(10, 23, p['straw blade']);
  });
  icon('item.wax-candle', (s) => {
    // Three slim honey-coloured candles of different heights, one lit.
    s.ell(16, 27, 11, 3, p['rock dark'], p.rock);
    candle(s, 8, 9, 4, p.straw, p['straw light'], p['straw dark']);
    s.rect(14, 14, 4, 12, p.straw);
    s.rect(14, 14, 1, 12, p['straw light']);
    s.rect(17, 14, 1, 12, p['straw dark']);
    s.put(15, 13, p.ink);
    s.rect(20, 17, 4, 9, p.straw);
    s.rect(20, 17, 1, 9, p['straw light']);
    s.rect(23, 17, 1, 9, p['straw dark']);
    s.put(21, 16, p.ink);
  });
  icon('item.wax', (s) => {
    // A round cake of beeswax with the comb's hexagons pressed into it.
    s.ell(16, 20, 12, 8, p['straw dark'], p.straw, p['sandstone band']);
    s.ell(16, 17, 12, 7, p.straw, p['straw light'], p['straw dark']);
    s.ell(15, 15, 6, 3, p['straw light'], p['straw blade']);
    for (const [x, y] of [
      [11, 18],
      [15, 20],
      [19, 18],
      [23, 20],
      [13, 14],
    ]) {
      s.put(x, y, p['straw dark']);
      s.put(x + 1, y, p['straw dark']);
      s.put(x, y + 1, p['straw dark']);
    }
  });
  icon('item.honey', (s) => {
    // A clay pot of honey, a cloth tied over its neck.
    s.ell(16, 20, 10, 9, p.dirt, p['dirt light'], p['dirt dark']);
    s.ell(16, 12, 7, 3, p['dirt dark']);
    s.ell(16, 12, 5.5, 2, p.amber, p['straw light'], p.gold);
    s.put(14, 12, p['straw blade']);
    s.rect(11, 15, 11, 1, p['dirt dark']);
    s.rect(12, 21, 9, 2, p['dirt light']);
    s.rect(14, 17, 2, 3, p.amber); // a run of honey down the side
    s.put(14, 20, p.gold);
    s.rect(9, 10, 14, 2, p.bone);
    s.rect(9, 11, 14, 1, p['limestone dark']);
  });
  icon('item.soap', (s) => {
    // Two pale bars, one on the other, with a shine.
    s.rect(5, 18, 20, 8, p['limestone light']);
    s.rect(5, 18, 20, 2, p.bone);
    s.rect(5, 25, 20, 1, p['limestone dark']);
    s.rect(24, 18, 1, 8, p['limestone dark']);
    s.rect(9, 9, 18, 8, p.bone);
    s.rect(9, 9, 18, 2, p['snow light']);
    s.rect(9, 16, 18, 1, p['limestone dark']);
    s.rect(26, 9, 1, 8, p['limestone dark']);
    s.put(12, 13, p['ice light']);
    s.put(13, 13, p['ice light']);
    s.put(8, 22, p['ice light']);
  });
  icon('item.ash', (s) => {
    // A grey heap of wood ash with a few black cinders.
    s.ell(16, 23, 12, 5, p['gravel dark']);
    s.ell(16, 19, 9, 6, p.gravel, p['gravel light'], p['gravel dark']);
    s.ell(15, 15, 5, 4, p['gravel light'], p['tundra light']);
    for (const [x, y] of [
      [11, 22],
      [20, 21],
      [15, 18],
      [18, 25],
      [9, 24],
    ])
      s.put(x, y, p['rock dark']);
    s.put(13, 14, p.ink);
    s.put(21, 24, p.ink);
  });
  // A skep: a domed straw beehive, coiled in bands, on a board, with a low entrance.
  const skep = (bees) => (s) => {
    s.rect(6, 25, 20, 3, p.trunk);
    s.rect(6, 25, 20, 1, p['dirt light']);
    s.ell(16, 18, 10, 11, p.straw, p['straw light'], p['straw dark']);
    for (const [y, w] of [
      [11, 6],
      [15, 9],
      [19, 10],
      [23, 10],
    ])
      s.rect(16 - w, y, w * 2, 1, p['straw dark']);
    s.rect(14, 8, 4, 1, p['straw blade']);
    s.rect(12, 22, 8, 3, p.darkness); // the entrance
    s.rect(13, 21, 6, 1, p.darkness);
    if (bees)
      for (const [x, y, c] of [
        [10, 27, p.gold],
        [14, 22, p.gold],
        [18, 23, p.ink],
        [22, 20, p.gold],
        [25, 14, p.ink],
        [8, 13, p.gold],
      ]) {
        s.put(x, y, c);
        s.put(x + 1, y, c === p.gold ? p.ink : p.gold);
      }
  };
  icon('skep.plan', skep(false));
  icon('skep.empty', skep(false));
  icon('skep.bees', skep(true));
  return frames;
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/items');
  mkdirSync(out, { recursive: true });
  for (const [name, img] of Object.entries(lampItems()))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log('lamp: drew 9 frames');
}

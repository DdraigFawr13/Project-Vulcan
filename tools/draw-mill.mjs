// Draws the 5B Bundle 4 mill art (docs/ART.md): into art/src/buildings/ the hand quern
// (`furn.quern`), the millstones (`furn.millstones`), the bread oven (`furn.oven`) and the water
// wheel on its water tile, turning (`furn.wheel.1` to `.3`) and iced (`furn.wheel.ice`); into
// art/src/items/ a loaf (`item.bread`) and a sack of flour (`item.flour`). Colours only from
// art/palette.gpl, a 1 px ink outline, top-down at the walls' three-quarter angle.
// Usage: node tools/draw-mill.mjs, then node tools/pack-sheet.mjs buildings items
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { canvas, outline } from './draw-furniture.mjs';
import { surface } from './draw-items-surface.mjs';

/** A round stone seen from above: a dark rim, its face, a lit edge and a hole at the middle. */
function stone(c, p, cx, cy, r) {
  c.disc(cx, cy + 1, r, p['rock dark']);
  c.disc(cx, cy, r, p.rock);
  c.disc(cx - 1, cy - 1, r - 2, p['rock light']);
  c.disc(cx, cy, r - 3, p.rock);
  c.disc(cx, cy, 1.5, p.ink);
}

/** The wheel's paddles at turn `k` (0 to 2), drawn over its water tile; iced, hung with ice. */
function wheel(p, k, iced) {
  const c = canvas();
  if (!iced) for (let x = 4 + k * 2; x < 28; x += 7) c.rect(x, 27, 4, 1, p['shallow water light']);
  // The axle comes out of the mill's wall on the north side.
  c.rect(14, 0, 4, 10, p['ui oak dark']);
  c.rect(6, 8, 20, 18, p['ui oak dark']);
  c.rect(7, 9, 18, 16, p['ui oak']);
  for (let i = 0; i < 4; i += 1) {
    const y = 9 + ((i * 4 + k) % 16);
    c.rect(7, y, 18, 2, p['ui oak light']);
  }
  c.rect(15, 9, 2, 16, p['ui oak dark']);
  if (iced) {
    c.rect(6, 22, 20, 4, p['ice light']);
    for (const x of [8, 13, 19, 23]) c.rect(x, 26, 1, 3, p['ice light']);
  }
  return outline(c.img, p.ink);
}

export function millBuildings(p = readPalette()) {
  const out = {};
  // The quern: two small stones on a stone block, a peg to turn the upper one.
  let c = canvas();
  c.rect(7, 12, 18, 14, p['rock dark']);
  c.rect(7, 11, 18, 13, p.rock);
  stone(c, p, 16, 16, 7);
  c.rect(20, 10, 2, 5, p['ui oak']);
  c.rect(20, 10, 1, 5, p['ui oak light']);
  out['furn.quern'] = outline(c.img, p.ink);
  // The millstones: one big stone in a wooden casing, a hopper of grain above.
  c = canvas();
  c.rect(2, 4, 28, 26, p['ui oak dark']);
  c.rect(3, 5, 26, 24, p['ui oak']);
  stone(c, p, 16, 18, 11);
  c.rect(12, 1, 8, 7, p['ui oak light']);
  c.rect(13, 2, 6, 4, p['straw light']);
  c.rect(15, 6, 2, 4, p['straw dark']);
  out['furn.millstones'] = outline(c.img, p.ink);
  // The oven: a stone dome with a dark mouth, a chimney at the back.
  c = canvas();
  c.disc(16, 18, 13, p['rock dark']);
  c.disc(16, 17, 13, p['limestone dark']);
  c.disc(14, 15, 9, p.limestone);
  c.disc(12, 13, 4, p['limestone light']);
  c.rect(11, 22, 10, 8, p['rock dark']);
  c.rect(12, 23, 8, 7, p.darkness);
  c.rect(13, 27, 6, 2, p['ui ember dark']);
  c.rect(14, 1, 5, 6, p.rock);
  c.rect(14, 1, 2, 6, p['rock light']);
  out['furn.oven'] = outline(c.img, p.ink);
  for (let k = 0; k < 3; k += 1) out[`furn.wheel.${k + 1}`] = wheel(p, k, false);
  out['furn.wheel.ice'] = wheel(p, 0, true);
  return out;
}

export function millItems(p = readPalette()) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };
  // Two round loaves, scored across the top.
  icon('item.bread', (s) => {
    s.ell(11, 20, 7, 5, p['sandstone light'], p['sand light'], p['sandstone dark']);
    s.ell(21, 17, 7, 5, p['sandstone light'], p['sand light'], p['sandstone dark']);
    s.line(9, 19, 13, 18, p['sandstone dark']);
    s.line(19, 16, 23, 15, p['sandstone dark']);
  });
  // A sack tied at the neck, a little flour spilled at its foot.
  icon('item.flour', (s) => {
    s.ell(16, 20, 8, 8, p.bone, p['limestone light'], p['limestone dark']);
    s.rect(13, 9, 6, 4, p['limestone dark']);
    s.rect(12, 12, 8, 1, p['straw dark']);
    for (const [x, y] of [
      [7, 28],
      [9, 29],
      [24, 28],
      [22, 29],
    ])
      s.put(x, y, p.bone);
  });
  return frames;
}

if (isMain(import.meta.url)) {
  for (const [sheet, frames] of [
    ['buildings', millBuildings()],
    ['items', millItems()],
  ]) {
    const out = path.join(root, `art/src/${sheet}`);
    mkdirSync(out, { recursive: true });
    for (const [name, img] of Object.entries(frames))
      writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  }
  console.log('mill: drew the quern, millstones, oven, wheel, bread and flour');
}

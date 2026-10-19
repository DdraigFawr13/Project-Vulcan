// Draws the Bundle 3 (P4.5) placeholder frames (docs/ART.md): into art/src/buildings/ the forge
// with its bellows, anvil block, quench tub, smelter (with bellows) and the charcoal clamp (a 2 by
// 2 spot cut into four tiles `furn.clamp.<nw|ne|sw|se>`, and `furn.clamp.lit.<quarter>` with `.<1-3>`
// with smoke rising, which the page cycles); into art/src/items/ charcoal, the four ingots tinted
// by metal (`item.<copper|tin|iron|bronze>-ingot`) and the twelve tools, four shapes tinted by
// material (`item.<stone|bronze|iron>-<axe|pick|hoe|hammer>`). Colours only from art/palette.gpl,
// a 1 px ink outline, seeded and deterministic.
// Usage: node tools/draw-metal.mjs, then node tools/pack-sheet.mjs buildings items
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';
import { canvas, outline } from './draw-furniture.mjs';
import { surface } from './draw-items-surface.mjs';

/** Light, mid and dark colours of a metal or of stone. */
const ramp = (p) => ({
  copper: [p['sandstone light'], p.sandstone, p['sandstone dark']],
  tin: [p['snow shade'], p.silver, p['gravel light']],
  iron: [p['slate light'], p.slate, p['slate dark']],
  bronze: [p['straw blade'], p.straw, p['straw dark']],
  stone: [p['gravel light'], p.gravel, p['gravel dark']],
});

export function metalItems(p = readPalette()) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };
  const metals = ramp(p);
  icon('item.charcoal', (s) => {
    s.ell(16, 24, 10, 3, p['rock dark']);
    for (const [x, y, r] of [
      [10, 20, 4.5],
      [20, 20, 5],
      [15, 15, 5],
      [22, 14, 3.5],
    ])
      s.ell(x, y, r, r - 1, p['rock dark'], p.rock, p.darkness);
    for (const [x, y] of [
      [9, 18],
      [19, 17],
      [14, 12],
      [21, 12],
    ])
      s.put(x, y, p['rock edge']);
    s.put(16, 18, p['ui ember']);
    s.put(12, 22, p['ui ember dark']);
  });
  // Ingots: four bars in a pyramid, a lit top edge, a shaded foot and a glint.
  for (const metal of ['copper', 'tin', 'iron', 'bronze']) {
    const [light, mid, dark] = metals[metal];
    icon(`item.${metal}-ingot`, (s) => {
      const bar = (x, y) => {
        s.rect(x + 1, y, 11, 1, light);
        s.rect(x, y + 1, 14, 3, mid);
        s.rect(x - 1, y + 4, 16, 1, dark);
        s.rect(x + 2, y + 1, 6, 1, p.bone);
      };
      bar(3, 22);
      bar(15, 22);
      bar(9, 16);
      bar(9, 10);
    });
  }
  // Tools: a handle on the diagonal and a head in the material's colours.
  const handle = (s, x0, y0, x1, y1) => {
    s.line(x0, y0, x1, y1, p.trunk);
    s.line(x0 + 1, y0, x1 + 1, y1, p['dirt light']);
  };
  const shapes = {
    axe: (s, [l, m, d]) => {
      handle(s, 7, 27, 21, 8);
      s.ell(23, 9, 5, 4.5, m, l, d);
      s.line(27, 6, 28, 13, p.bone);
    },
    pick: (s, [l, m, d]) => {
      handle(s, 8, 28, 19, 9);
      s.line(4, 12, 27, 4, d);
      s.line(4, 11, 27, 3, m);
      s.line(7, 10, 24, 3, l);
      s.put(3, 12, l);
      s.put(28, 4, l);
    },
    hoe: (s, [l, m, d]) => {
      handle(s, 10, 28, 20, 7);
      s.rect(15, 5, 12, 4, m);
      s.rect(15, 5, 12, 1, l);
      s.rect(15, 8, 12, 1, d);
      s.rect(23, 9, 4, 4, m);
      s.rect(23, 12, 4, 1, d);
    },
    hammer: (s, [l, m, d]) => {
      handle(s, 8, 28, 21, 11);
      s.rect(16, 4, 12, 7, m);
      s.rect(16, 4, 12, 2, l);
      s.rect(16, 9, 12, 2, d);
      s.rect(18, 5, 5, 1, p.bone);
    },
  };
  for (const material of ['stone', 'bronze', 'iron'])
    for (const [kind, draw] of Object.entries(shapes))
      icon(`item.${material}-${kind}`, (s) => draw(s, metals[material]));
  return frames;
}

export function metalBuildings(p = readPalette()) {
  const frames = {};
  const piece = (name, draw) => {
    const c = canvas();
    draw(c);
    frames[name] = outline(c.img, p.ink);
  };
  // The forge: a stone hearth with a glowing mouth, a hood, and hand bellows on its right.
  piece('furn.forge', (c) => {
    c.rect(3, 9, 21, 19, p.rock);
    c.rect(3, 9, 21, 3, p['rock light']);
    c.rect(3, 25, 21, 3, p['rock dark']);
    c.rect(8, 4, 11, 6, p['rock edge']);
    c.rect(11, 5, 5, 2, p.darkness);
    c.rect(7, 15, 13, 9, p['ui oak dark']);
    c.rect(8, 16, 11, 8, p['ui ember dark']);
    c.rect(9, 18, 9, 6, p['ui ember']);
    c.rect(11, 20, 5, 4, p['aura fire']);
    c.rect(12, 21, 3, 3, p['ui ember light']);
    c.put(13, 22, p['straw light']);
    for (let i = 0; i < 6; i++) c.put(7 + i * 2, 14 - (i % 2), p['rock edge']);
    // Bellows: two boards and a leather fold, with a nozzle into the hearth.
    c.rect(24, 17, 6, 2, p['ui oak light']);
    c.rect(24, 24, 6, 2, p['ui oak']);
    c.rect(25, 19, 4, 5, p['dirt']);
    c.put(26, 20, p['dirt light']);
    c.rect(21, 20, 4, 1, p['ui iron']);
    c.put(21, 20, p['ui iron light']);
  });
  // The anvil block: iron on a squared stone block.
  piece('furn.anvil', (c) => {
    c.rect(9, 19, 14, 9, p.rock);
    c.rect(9, 19, 14, 2, p['rock light']);
    c.rect(9, 26, 14, 2, p['rock dark']);
    c.rect(13, 15, 6, 5, p['slate dark']);
    c.rect(6, 10, 20, 5, p.slate);
    c.rect(6, 10, 20, 1, p['slate light']);
    c.rect(7, 14, 18, 1, p['slate dark']);
    for (let i = 0; i < 4; i++) c.rect(3 + i, 11 + i, 1, 1, p.slate);
    c.rect(3, 10, 3, 2, p.slate);
    c.rect(22, 10, 4, 1, p.bone);
  });
  // The quench tub: an oak tub of water with iron hoops.
  piece('furn.tub', (c) => {
    c.disc(16, 17, 12, p['ui oak dark']);
    c.disc(16, 16, 11, p['ui oak']);
    c.disc(16, 16, 8.5, p['ui oak grain']);
    c.disc(16, 16, 7.5, p['deep water']);
    c.disc(15, 15, 5.5, p['shallow water']);
    c.rect(12, 13, 4, 1, p['shallow water light']);
    c.put(18, 18, p['shallow water light']);
    for (let a = 0; a < 8; a++) {
      const [x, y] = [
        16 + Math.round(Math.cos(a * 0.785) * 10),
        16 + Math.round(Math.sin(a * 0.785) * 10),
      ];
      c.put(x, y, p['ui oak light']);
    }
    c.rect(9, 26, 14, 1, p['ui iron']);
    c.rect(6, 18, 1, 5, p['ui iron dark']);
    c.rect(25, 18, 1, 5, p['ui iron dark']);
  });
  // The smelter: a stone beehive furnace with a chimney, a glowing mouth and a bellows.
  piece('furn.smelter', (c) => {
    c.disc(15, 18, 11, p['rock dark']);
    c.disc(15, 17, 10, p.rock);
    c.disc(12, 14, 6, p['rock light']);
    c.rect(11, 3, 8, 9, p['rock edge']);
    c.rect(11, 3, 8, 2, p['rock light']);
    c.rect(13, 4, 4, 2, p.darkness);
    c.rect(11, 19, 9, 8, p.darkness);
    c.rect(12, 22, 7, 5, p['ui ember dark']);
    c.rect(14, 24, 3, 3, p['ui ember']);
    c.put(15, 25, p['ui ember light']);
    for (const [x, y] of [
      [8, 14],
      [20, 13],
      [6, 20],
      [24, 20],
      [10, 9],
      [18, 9],
    ])
      c.put(x, y, p['rock edge']);
    c.rect(25, 21, 5, 2, p['ui oak light']);
    c.rect(25, 27, 5, 2, p['ui oak']);
    c.rect(26, 23, 3, 4, p.dirt);
    c.rect(21, 24, 4, 1, p['ui iron']);
  });
  Object.assign(frames, clamp(p));
  return frames;
}

const QUARTERS = [
  ['nw', 0, 0],
  ['ne', 32, 0],
  ['sw', 0, 32],
  ['se', 32, 32],
];

/** A 64 by 64 drawing cut into the clamp's four 32 px tiles. */
function quarters(big) {
  const out = {};
  for (const [q, ox, oy] of QUARTERS) {
    const img = createImage(32, 32);
    for (let y = 0; y < 32; y++)
      img.data.set(
        big.data.subarray(((oy + y) * 64 + ox) * 4, ((oy + y) * 64 + ox + 32) * 4),
        y * 32 * 4,
      );
    out[q] = img;
  }
  return out;
}

function clamp(p) {
  const frames = {};
  const draw = (lit, n) => {
    const big = createImage(64, 64);
    const put = (x, y, c) => {
      if (x >= 0 && y >= 0 && x < 64 && y < 64) big.data.set([...c, 255], (y * 64 + x) * 4);
    };
    const disc = (cx, cy, rx, ry, c) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) put(x, y, c);
    };
    // A cleared ring of earth, ash and a few log ends: the spot.
    disc(32, 38, 29, 24, p.ink);
    disc(32, 38, 28, 23, p['dirt dark']);
    disc(32, 37, 26, 21, p.dirt);
    if (!lit) {
      disc(32, 38, 15, 11, p['gravel dark']);
      for (let k = 0; k < 10; k++)
        put(
          14 + Math.floor(noise(3, k, 1) * 36),
          24 + Math.floor(noise(3, k, 2) * 28),
          p['dirt light'],
        );
      for (const [x, y] of [
        [20, 46],
        [30, 50],
        [42, 45],
        [48, 36],
        [14, 34],
      ])
        disc(x, y, 3, 2, p.trunk);
      return big;
    }
    // The mound: turf over stacked logs, with vents that glow.
    disc(32, 38, 22, 17, p.ink);
    disc(32, 38, 21, 16, p['dirt dark']);
    disc(32, 36, 20, 14, p['grass dark']);
    disc(30, 33, 15, 9, p.dirt);
    disc(28, 31, 9, 5, p['dirt light']);
    for (let k = 0; k < 14; k++)
      put(
        18 + Math.floor(noise(5, k, 1) * 28),
        26 + Math.floor(noise(5, k, 2) * 20),
        p['grass tip'],
      );
    for (const [x, y] of [
      [22, 38],
      [32, 30],
      [41, 40],
      [30, 45],
    ]) {
      put(x, y, p['ui ember dark']);
      put(x + 1, y, p['ui ember']);
      put(x, y + 1, n % 2 ? p['ui ember light'] : p['ui ember']);
    }
    // Smoke: grey puffs rising from the top vent, drifting right, a different shape each frame.
    const puffs = [
      [32, 24 - n, 4, 3, p['gravel']],
      [34 + n, 17 - n, 5, 4, p['gravel light']],
      [37 + n * 2, 9, 5, 4, p['floor light']],
      [40 + n * 2, 3, 4, 3, p['snow shade']],
    ];
    for (const [x, y, rx, ry, c] of puffs) disc(x, y, rx, ry, c);
    return big;
  };
  for (const [q, img] of Object.entries(quarters(draw(false, 0)))) frames[`furn.clamp.${q}`] = img;
  // The page picks `<art>.<quarter>` first, so each quarter has a still frame, then cycles the numbered ones.
  for (const [q, img] of Object.entries(quarters(draw(true, 1))))
    frames[`furn.clamp.lit.${q}`] = img;
  for (let n = 1; n <= 3; n++)
    for (const [q, img] of Object.entries(quarters(draw(true, n))))
      frames[`furn.clamp.lit.${q}.${n}`] = img;
  return frames;
}

if (isMain(import.meta.url)) {
  for (const [sheet, frames] of [
    ['items', metalItems()],
    ['buildings', metalBuildings()],
  ]) {
    const out = path.join(root, 'art/src', sheet);
    mkdirSync(out, { recursive: true });
    for (const [name, img] of Object.entries(frames))
      writeFileSync(path.join(out, `${name}.png`), encodePng(img));
    console.log(`metal: drew ${Object.keys(frames).length} frames into ${out}`);
  }
}

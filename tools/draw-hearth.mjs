// Draws the P3.6 hearth frames into art/src/buildings/ (docs/ART.md): an open ring of stones that
// is also the outdoor campfire, in three states: `furn.hearth` (cold, charred sticks and ash),
// `furn.hearth.lit.1` to `.3` (flames; the page cycles them) and `furn.hearth.banked` (a bed of
// embers under ash). One 32 px tile, colours only from art/palette.gpl, a 1 px ink outline like
// the walls so it reads on grass, wood floor and stone floor. Seeded and deterministic.
// Usage: node tools/draw-hearth.mjs, then node tools/pack-sheet.mjs buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';
import { canvas, outline } from './draw-furniture.mjs';

const C = 16;
const RING = 10;
const STONES = 11;

export function drawHearth(p = readPalette()) {
  const ash = p['gravel dark'];
  const pit = p['rock dark'];

  // The ring: stones on a circle, the northern half before the fire and the southern half after,
  // so the flames stand inside it. Each stone is lit from the top left.
  function stone(c, i) {
    const a = (i / STONES) * Math.PI * 2 + 0.3;
    const [x, y] = [C + Math.cos(a) * RING, C + Math.sin(a) * (RING - 1)];
    const r = 3 + (noise(71, i, 3) > 0.5 ? 0.4 : 0);
    c.disc(x, y + 0.6, r, p['rock dark']);
    c.disc(x, y, r, p.rock);
    c.disc(x - 0.7, y - 0.8, r - 1.3, p['rock light']);
    c.put(Math.floor(x - 1), Math.floor(y - 1), p['rock edge']);
    return y;
  }
  function ring(c, north) {
    for (let i = 0; i < STONES; i++) {
      const a = (i / STONES) * Math.PI * 2 + 0.3;
      if (Math.sin(a) < 0 === north) stone(c, i);
    }
  }
  function floor(c) {
    c.disc(C, C + 0.5, RING - 2.4, pit);
    c.disc(C, C + 0.5, RING - 3.6, ash);
    for (const [x, y] of [
      [11, 14],
      [20, 13],
      [13, 21],
      [19, 20],
    ])
      c.put(x, y, p['floor']);
  }
  // Two sticks laid across, charred.
  function sticks(c, dark) {
    const wood = dark ? p['ui oak dark'] : p['ui oak grain'];
    for (let i = 0; i < 12; i++) {
      c.rect(10 + i, 18 - Math.floor(i / 4), 1, 2, wood);
      c.rect(10 + i, 14 + Math.floor(i / 4), 1, 2, wood);
    }
    c.rect(11, 17, 3, 1, p.ink);
    c.rect(18, 16, 3, 1, p.ink);
  }
  // A flame as stacked rows from `base` up: wide at the foot, narrowing to a tip that sways.
  function flame(c, cx, base, h, w, phase, colour) {
    for (let j = 0; j < h; j++) {
      const t = j / h;
      const sway = Math.round(Math.sin(phase + j * 0.55) * t * 2.2);
      const half = Math.max(0, w * Math.pow(1 - t, 0.75) * (1 + 0.2 * Math.sin(phase * 1.7 + j)));
      c.rect(Math.round(cx + sway - half), base - j, Math.max(1, Math.round(half * 2)), 1, colour);
    }
  }

  function cold() {
    const c = canvas();
    ring(c, true);
    floor(c);
    sticks(c, false);
    ring(c, false);
    return outline(c.img, p.ink);
  }

  function lit(n) {
    const c = canvas();
    ring(c, true);
    floor(c);
    // Glowing coals under the logs, then the flames: red outside, ember, straw, and a pale core.
    c.disc(C, C + 1, 5.5, p['ui ember dark']);
    c.disc(C, C + 1, 3.8, p['ui ember']);
    sticks(c, true);
    const ph = n * 2.1;
    flame(c, C - 3, 19, 9 + (n % 2) * 2, 3.2, ph + 1, p['aura fire']);
    flame(c, C + 3, 19, 8 + ((n + 1) % 2) * 2, 3, ph + 4, p['aura fire']);
    flame(c, C, 20, 15 + (n === 2 ? 2 : 0) - (n === 3 ? 1 : 0), 5, ph, p['aura fire']);
    flame(c, C, 20, 12 + (n === 2 ? 2 : 0), 3.6, ph + 0.4, p['ui ember']);
    flame(c, C - 3, 19, 6, 1.8, ph + 1, p['ui ember']);
    flame(c, C + 3, 19, 5, 1.8, ph + 4, p['ui ember']);
    flame(c, C, 20, 9, 2.2, ph + 0.7, p['ui ember light']);
    flame(c, C, 20, 5, 1.2, ph + 1, p['straw light']);
    // A spark or two off the tips.
    c.put(C + 2 - n, 4 + n, p['ui ember light']);
    c.put(C - 4 + n, 7 - n, p.amber);
    ring(c, false);
    return outline(c.img, p.ink);
  }

  function banked() {
    const c = canvas();
    ring(c, true);
    floor(c);
    // Embers under a skin of ash: dark red-brown with a few bright points.
    c.disc(C, C + 0.5, 5.6, p['ui ember dark']);
    c.disc(C, C + 0.5, 4.6, p['ui oak dark']);
    for (let i = 0; i < 26; i++) {
      const x = 9 + Math.floor(noise(5, i, 1) * 14);
      const y = 11 + Math.floor(noise(6, i, 1) * 11);
      if ((x - C) ** 2 + (y - C - 0.5) ** 2 > 24) continue;
      c.put(x, y, noise(7, i, 2) > 0.7 ? p['ui ember'] : p['ui ember dark']);
    }
    for (const [x, y] of [
      [14, 15],
      [18, 17],
      [15, 19],
    ])
      c.put(x, y, p['ui ember light']);
    ring(c, false);
    return outline(c.img, p.ink);
  }

  return {
    'furn.hearth': cold(),
    'furn.hearth.lit.1': lit(1),
    'furn.hearth.lit.2': lit(2),
    'furn.hearth.lit.3': lit(3),
    'furn.hearth.banked': banked(),
  };
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  const frames = drawHearth();
  for (const [name, img] of Object.entries(frames))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log(`hearth: drew ${Object.keys(frames).length} frames into ${out}`);
}

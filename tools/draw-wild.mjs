// Draws the Phase 5A Bundle 2 (the wild valley) placeholder frames (docs/ART.md):
// into art/src/sprites-wild/ the animals (`animal.<wolf|bear|stag|hind|boar|goat|hare>.<e|w>.<0|1>`,
// side view facing east with `w` its mirror, two walk frames; `animal.<kind>.dead` lying on its
// side), the tracks (`print.<paw|hoof|hare>.<n|ne|e|se|s|sw|w|nw>`, fully opaque `print` colour on
// transparent; the page fades them with alpha) and `site.midden`; into art/src/items/ `item.hide`,
// `item.bone`, `item.fat` and `item.<stone|bronze|iron>-spear`. Colours only from art/palette.gpl,
// 1 px ink outline on sprites and icons, no randomness: the same output every run.
// Usage: node tools/draw-wild.mjs, then node tools/pack-sheet.mjs sprites-wild items
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { surface } from './draw-items-surface.mjs';
import { flockSprites } from './draw-flock.mjs';
import { wildPrints, wildMidden, wildItems } from './draw-wild-marks.mjs';

const S = 32;
const FEET = 29;
export const ANIMALS = ['wolf', 'bear', 'stag', 'hind', 'boar', 'goat', 'hare'];

function mirror(img) {
  const out = createImage(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      out.data.set(
        img.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4),
        (y * S + (S - 1 - x)) * 4,
      );
  return out;
}

// Four legs as vertical bars ending on the ground. `xs` = [near front, far front, near back, far
// back]; diagonal gait, so near front and far back swing together; the forward-swung foot lifts 1 px.
function legs(s, xs, top, w, cols, frame, which) {
  const swing = frame ? -1 : 1;
  const phase = [swing, -swing, -swing, swing];
  xs.forEach((x, i) => {
    if ((i % 2 === 1) !== (which === 'far')) return;
    const dx = phase[i] * 2;
    const lift = phase[i] > 0 ? 1 : 0;
    s.rect(x + dx, top, w, FEET - top + 1 - lift, which === 'far' ? cols.dark : cols.mid);
    s.rect(x + dx, FEET - lift, w, 1, cols.hoof);
    if (which === 'near') s.rect(x + dx, top, 1, FEET - top - lift, cols.lit);
  });
}

export function wildSprites(p = readPalette()) {
  const frames = {};
  const colours = (mid, lit, dark, hoof = p['rock dark']) => ({ mid, lit, dark, hoof });
  const finish = (name, s) => {
    s.outline(p.ink);
    frames[name] = s.image;
  };
  const eye = (s, x, y) => s.put(x, y, p.ink);

  // Each walker draws far legs, body, head, near legs, in that order.
  const walkers = {
    wolf: (s, f) => {
      const c = colours(p.gravel, p['gravel light'], p['gravel dark']);
      s.line(7, 16, 3, 22, c.dark);
      s.line(8, 16, 4, 22, c.mid);
      legs(s, [21, 18, 8, 11], 21, 2, c, f, 'far');
      s.ell(14, 18, 8, 4.5, c.mid, c.lit, c.dark);
      s.ell(21, 15, 3.6, 3.4, c.mid, c.lit, c.dark);
      s.rect(24, 15, 5, 3, c.mid);
      s.rect(24, 15, 5, 1, c.lit);
      s.put(28, 15, p['rock dark']);
      s.rect(20, 11, 2, 2, c.dark);
      s.put(21, 10, c.dark);
      eye(s, 24, 14);
      s.rect(19, 21, 5, 1, c.lit);
      legs(s, [21, 18, 8, 11], 21, 2, c, f, 'near');
    },
    bear: (s, f) => {
      const c = colours(p['dirt dark'], p.dirt, p['ui oak'], p['ui oak dark']);
      s.put(4, 14, c.dark);
      s.rect(4, 15, 2, 2, c.dark);
      legs(s, [20, 16, 6, 10], 20, 4, c, f, 'far');
      s.ell(14, 17, 10, 7, c.mid, c.lit, c.dark);
      s.ell(19, 13, 5, 4.5, c.mid, c.lit, c.dark);
      s.ell(25, 16, 4, 3.6, c.mid, c.lit, c.dark);
      s.rect(27, 16, 4, 3, p['dirt light']);
      s.put(30, 16, p.ink);
      s.rect(23, 11, 2, 2, c.dark);
      eye(s, 26, 14);
      legs(s, [20, 16, 6, 10], 20, 4, c, f, 'near');
    },
    boar: (s, f) => {
      const c = colours(p['rock dark'], p.rock, p.darkness, p.darkness);
      s.line(5, 19, 2, 16, c.mid);
      legs(s, [21, 18, 8, 11], 24, 2, c, f, 'far');
      s.ell(14, 20, 9, 5.5, c.mid, c.lit, c.dark);
      s.ell(20, 18, 5, 5, c.mid, c.lit, c.dark);
      for (let x = 7; x <= 23; x += 2) {
        const u = (x - 14) / 9.4;
        const top = Math.round(20 - 5.5 * Math.sqrt(Math.max(0, 1 - u * u)));
        s.put(x, top - 1, p['rock edge']);
      }
      s.ell(25, 21, 4, 3.6, c.mid, c.lit, c.dark);
      s.rect(27, 21, 4, 3, c.lit);
      s.put(30, 21, p.ink);
      s.rect(23, 16, 2, 2, c.dark);
      s.put(28, 25, p.bone);
      s.put(29, 24, p.bone);
      s.put(29, 23, p.bone);
      eye(s, 26, 20);
      legs(s, [21, 18, 8, 11], 24, 2, c, f, 'near');
    },
    goat: (s, f) => {
      const c = colours(p.snow, p['snow light'], p['snow shade'], p['gravel dark']);
      s.put(7, 14, c.dark);
      s.put(7, 15, c.mid);
      legs(s, [20, 17, 9, 12], 21, 2, { ...c, mid: p['snow shade'], dark: p.silver }, f, 'far');
      s.ell(14, 18, 6.5, 4, c.mid, c.lit, c.dark);
      s.line(18, 16, 21, 12, c.mid);
      s.line(19, 16, 22, 12, c.mid);
      s.ell(23, 12, 2.6, 2.4, c.mid, c.lit, c.dark);
      s.rect(24, 13, 3, 3, c.mid);
      s.put(26, 13, p['gravel dark']);
      s.rect(24, 16, 1, 3, p['gravel light']);
      s.line(22, 10, 21, 6, p['gravel dark']);
      s.line(21, 6, 18, 5, p['gravel dark']);
      s.put(22, 9, p.gravel);
      eye(s, 24, 11);
      legs(s, [20, 17, 9, 12], 21, 2, c, f, 'near');
    },
    hare: (s, f) => {
      const c = colours(
        p['limestone joint'],
        p['gravel light'],
        p['gravel dark'],
        p['gravel dark'],
      );
      const up = f ? 1 : 0;
      s.ell(12, 26 - up, 4.2, 3, c.mid, c.lit, c.dark);
      s.ell(11, 26 - up, 3, 3, c.mid, c.lit, c.dark);
      s.ell(17, 24 - up, 2.2, 2, c.mid, c.lit, c.dark);
      s.rect(18, 24 - up, 3, 2, c.mid);
      s.put(20, 24 - up, p['rock dark']);
      s.line(16, 22 - up, 14, 17 - up, c.dark);
      s.line(17, 22 - up, 16, 17 - up, c.mid);
      s.put(15, 17 - up, p['ui oak']);
      s.put(7, 25 - up, p.snow);
      s.put(7, 26 - up, p.snow);
      eye(s, 18, 23 - up);
      // Feet: bunched when sitting up, stretched when leaping.
      s.rect(f ? 7 : 9, 28 - up, 5, 1 + up, c.dark);
      s.rect(f ? 18 : 15, 28 - up, 3, 1 + up, c.dark);
      if (f) s.rect(11, 29, 8, 1, c.dark);
    },
  };
  // Stag and hind share a body; the stag has antlers, the hind a pale rump and big ears.
  const deer = (stag) => (s, f) => {
    const c = stag
      ? colours(p['dirt light'], p['leaf litter light'], p.dirt)
      : colours(p.sandstone, p['sandstone light'], p['sandstone dark'], p['ui oak dark']);
    s.line(7, 14, 5, 17, c.dark);
    legs(s, [19, 16, 8, 11], 20, 2, c, f, 'far');
    s.ell(13, 17, 7.5, 3.9, c.mid, c.lit, c.dark);
    if (!stag) s.ell(7, 16, 2.2, 3, p['sand light']);
    for (const dx of [0, 1, 2]) s.line(19 + dx, 16, 23 + dx, 9, c.mid);
    s.ell(25, 8, 2.8, 2.2, c.mid, c.lit, c.dark);
    s.rect(26, 8, 3, 3, c.mid);
    s.put(28, 8, p['rock dark']);
    eye(s, 25, 7);
    if (stag) {
      const a = p['sand light'];
      s.line(23, 6, 22, 1, a);
      s.line(22, 4, 19, 3, a);
      s.line(25, 6, 27, 1, a);
      s.line(26, 4, 29, 3, a);
      s.line(22, 2, 20, 1, a);
    } else {
      s.rect(22, 5, 2, 3, c.mid);
      s.put(22, 5, c.dark);
    }
    legs(s, [19, 16, 8, 11], 20, 2, c, f, 'near');
  };
  walkers.stag = deer(true);
  walkers.hind = deer(false);

  for (const kind of ANIMALS)
    for (const f of [0, 1]) {
      const s = surface();
      walkers[kind](s, f);
      s.outline(p.ink);
      frames[`animal.${kind}.e.${f}`] = s.image;
      frames[`animal.${kind}.w.${f}`] = mirror(s.image);
    }

  // Carcasses: on the side, legs stuck out stiffly, head to the right.
  const dead = {
    wolf: { rx: 8, ry: 4, c: colours(p.gravel, p['gravel light'], p['gravel dark']), leg: 4 },
    bear: { rx: 10, ry: 6, c: colours(p['dirt dark'], p.dirt, p['ui oak']), leg: 4, hr: 4 },
    stag: {
      rx: 8,
      ry: 4,
      c: colours(p['dirt light'], p['leaf litter light'], p.dirt),
      leg: 6,
      horn: 1,
    },
    hind: {
      rx: 8,
      ry: 4,
      c: colours(p.sandstone, p['sandstone light'], p['sandstone dark']),
      leg: 6,
      rump: 1,
    },
    boar: { rx: 9, ry: 5, c: colours(p['rock dark'], p.rock, p.darkness), leg: 3, tusk: 1 },
    goat: { rx: 7, ry: 4, c: colours(p.snow, p['snow light'], p['snow shade']), leg: 5, horn: 2 },
    hare: {
      rx: 4,
      ry: 3,
      c: colours(p['limestone joint'], p['gravel light'], p['gravel dark']),
      leg: 3,
      ears: 1,
    },
  };
  for (const kind of ANIMALS) {
    const d = dead[kind];
    const s = surface();
    const cx = kind === 'hare' ? 14 : 13;
    const cy = FEET - d.ry + 1;
    const hr = d.hr ?? Math.max(2, Math.round(d.ry * 0.7));
    // Legs jutting up and forward from the upper flank.
    for (let i = 0; i < 4; i++) {
      const x = cx - d.rx + 3 + i * Math.max(1, Math.floor((2 * d.rx - 6) / 3));
      const reach = Math.min(d.leg, 3);
      s.line(x, cy - d.ry + 1, x + 2 + (i % 2), cy - d.ry - reach + 1, i % 2 ? d.c.dark : d.c.mid);
      s.line(
        x + 1,
        cy - d.ry + 1,
        x + 3 + (i % 2),
        cy - d.ry - reach + 1,
        i % 2 ? d.c.dark : d.c.mid,
      );
      s.put(x + 2 + (i % 2), cy - d.ry - reach + 1, d.c.hoof);
    }
    s.ell(cx, cy, d.rx, d.ry, d.c.mid, d.c.lit, d.c.dark);
    if (d.rump) s.ell(cx - d.rx + 2, cy, 2, d.ry - 1, p['sand light']);
    s.ell(cx + d.rx + 1, cy + 1, hr, hr - 0.4, d.c.mid, d.c.lit, d.c.dark);
    s.rect(cx + d.rx + hr, cy + 1, 3, Math.max(2, hr - 1), d.c.mid);
    s.put(cx + d.rx + hr + 2, cy + 1, p['rock dark']);
    s.put(cx + d.rx + 1, cy, p.ink);
    s.put(cx + d.rx + 2, cy - 1, p.ink);
    s.put(cx + d.rx + 2, cy + 1, p.ink);
    if (d.tusk) {
      s.put(cx + d.rx + hr + 1, cy + 3, p.bone);
      s.put(cx + d.rx + hr + 2, cy + 4, p.bone);
    }
    if (d.horn) {
      const hx = cx + d.rx + 1;
      const col = d.horn === 1 ? p['sand light'] : p['gravel dark'];
      s.line(hx, cy - hr + 1, hx - 1, cy - hr - 3, col);
      s.line(hx + 1, cy - hr + 1, hx + 3, cy - hr - 3, col);
      if (d.horn === 1) s.line(hx + 3, cy - hr - 3, hx + 5, cy - hr - 3, col);
    }
    if (d.ears) {
      const hx = cx + d.rx + 1;
      s.line(hx, cy - 1, hx - 3, cy - 3, d.c.dark);
      s.line(hx + 1, cy - 1, hx - 2, cy - 2, d.c.mid);
    }
    s.line(cx - d.rx, cy, cx - d.rx - 2, cy + 1, d.c.dark);
    finish(`animal.${kind}.dead`, s);
  }
  return frames;
}

if (isMain(import.meta.url)) {
  const p = readPalette();
  const sheets = {
    'sprites-wild': { ...wildSprites(p), ...flockSprites(p), ...wildPrints(p), ...wildMidden(p) },
    items: wildItems(p),
  };
  for (const [sheet, frames] of Object.entries(sheets)) {
    const out = path.join(root, 'art/src', sheet);
    mkdirSync(out, { recursive: true });
    for (const [name, img] of Object.entries(frames))
      writeFileSync(path.join(out, `${name}.png`), encodePng(img));
    console.log(`wild: drew ${Object.keys(frames).length} frames into ${out}`);
  }
}

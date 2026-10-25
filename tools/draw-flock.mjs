// Draws the Phase 5 Bundle 3 flock animals into art/src/sprites-wild/ (docs/ART.md): sheep
// (`animal.<ewe|ram|lamb>`) and goats (`animal.<nanny|billy|kid>`), each with `.e.0 .e.1 .w.0 .w.1`
// (two-frame walk, side view facing east, `w` the mirror) and `.dead`. Same scale and 1 px ink
// outline as the wild animals in tools/draw-wild.mjs; lamb and kid are half size. Colours only
// from art/palette.gpl, no randomness. Called from tools/draw-wild.mjs.
import { createImage } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { surface } from './draw-items-surface.mjs';

const S = 32;
const FEET = 29;
export const FLOCK = ['ewe', 'ram', 'lamb', 'nanny', 'billy', 'kid'];

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

export function flockSprites(p = readPalette()) {
  const wool = { mid: p['limestone light'], lit: p.bone, dark: p['limestone dark'] };
  const sheepFace = { mid: p['rock dark'], lit: p.rock, dark: p.darkness };
  const brown = { mid: p.dirt, lit: p['dirt light'], dark: p['dirt dark'] };
  const grey = { mid: p.gravel, lit: p['gravel light'], dark: p['gravel dark'] };
  // `k` scales the animal (1 adult, 0.5 young); legs are bars under the body, diagonal gait.
  const kinds = {
    ewe: { k: 1, body: wool, face: sheepFace, leg: p['rock dark'], fleece: true },
    ram: { k: 1.1, body: wool, face: sheepFace, leg: p['rock dark'], fleece: true, curl: true },
    lamb: { k: 0.5, body: wool, face: sheepFace, leg: p['rock dark'], fleece: true },
    nanny: { k: 1, body: brown, face: brown, leg: p['dirt dark'], horn: 3 },
    billy: { k: 1.1, body: grey, face: grey, leg: p['rock dark'], horn: 6, beard: true },
    kid: { k: 0.5, body: brown, face: brown, leg: p['dirt dark'] },
  };

  const walk = (o, f) => {
    const s = surface();
    const { k, body: b } = o;
    const rx = Math.round(7 * k + (k < 1 ? 1 : 0));
    const ry = Math.round(4.5 * k + (k < 1 ? 0.5 : 0));
    const legLen = Math.round(8 * k);
    const cx = 14 - (k > 1 ? 1 : 0);
    const cy = FEET - legLen - ry + 3;
    const lw = k < 1 ? 1 : 2;
    const xs = [
      cx + Math.round(5 * k),
      cx + Math.round(3 * k),
      cx - Math.round(5 * k),
      cx - Math.round(3 * k),
    ];
    const swing = f ? -1 : 1;
    const phase = [swing, -swing, -swing, swing];
    const leg = (i, col) => {
      const dx = phase[i] * (k < 1 ? 1 : 2);
      const lift = phase[i] > 0 ? 1 : 0;
      s.rect(xs[i] + dx, cy, lw, FEET - cy + 1 - lift, col);
    };
    leg(1, o.leg);
    leg(3, o.leg);
    s.line(cx - rx, cy - 1, cx - rx - 1, cy + 1, b.dark);
    s.ell(cx, cy, rx, ry, b.mid, b.lit, b.dark);
    if (o.fleece) {
      for (let i = 0; i < 5; i++) {
        const x = cx - rx + 2 + Math.round((i * (2 * rx - 3)) / 4);
        s.put(x, cy - ry + (i % 2) + 1, b.lit);
        s.put(x + 1, cy + ry - 2 - (i % 2), b.dark);
      }
      s.ell(cx - rx + 2, cy - 1, 2 * k + 1, 2 * k + 1, b.mid, b.lit);
    }
    // Head: forward and a little up, a snout, an ear and a dark eye.
    const hx = cx + rx + 1;
    const hy = cy - Math.round(ry * 0.6);
    const hr = Math.max(2, Math.round(2.6 * k));
    s.line(cx + rx - 2, cy - 1, hx, hy, b.mid);
    s.ell(hx, hy, hr, hr - 0.3, o.face.mid, o.face.lit, o.face.dark);
    s.rect(hx + 1, hy, hr + 1, Math.max(2, hr), o.face.mid);
    s.put(hx + hr + 1, hy, p.darkness);
    s.put(hx, hy - 1, p.ink);
    s.rect(hx - hr, hy - 1, 2, 1, o.face.dark);
    if (o.fleece && k >= 1) s.rect(hx - 1, hy - hr, 3, 1, b.lit);
    if (o.curl) {
      // Horns curling back round the ear.
      const h = p['sand light'];
      s.line(hx - 1, hy - hr, hx - 3, hy - hr - 1, h);
      s.line(hx - 3, hy - hr - 1, hx - 4, hy - hr + 2, h);
      s.line(hx - 4, hy - hr + 2, hx - 2, hy - hr + 3, p.sand);
    }
    if (o.horn) {
      const h = p['sand light'];
      s.line(hx - 1, hy - hr, hx - 2 - o.horn / 3, hy - hr - o.horn, h);
      s.line(hx, hy - hr, hx - o.horn / 2, hy - hr - o.horn + 1, p.sand);
    } else if (!o.fleece) {
      s.put(hx - 1, hy - hr, b.dark);
      s.put(hx, hy - hr - 1, b.dark);
    }
    if (o.beard) s.rect(hx + hr - 1, hy + hr - 1, 1, 3, p['gravel dark']);
    if (k < 1) s.rect(hx, hy - hr, 1, 1, b.dark);
    leg(0, o.leg);
    leg(2, o.leg);
    s.outline(p.ink);
    return s.image;
  };

  // Carcass: on its side, legs jutting up and forward, head to the right.
  const dead = (o) => {
    const s = surface();
    const { k, body: b } = o;
    const rx = Math.round(7 * k + (k < 1 ? 1 : 0));
    const ry = Math.round(4 * k + (k < 1 ? 0.5 : 0));
    const cx = 13;
    const cy = FEET - ry + 1;
    for (let i = 0; i < 4; i++) {
      const x = cx - rx + 3 + i * Math.max(1, Math.floor((2 * rx - 6) / 3));
      const r = Math.max(2, Math.round(3 * k));
      s.line(x, cy - ry + 1, x + 2 + (i % 2), cy - ry - r + 1, i % 2 ? b.dark : o.leg);
      s.put(x + 2 + (i % 2), cy - ry - r + 1, p['rock dark']);
    }
    s.ell(cx, cy, rx, ry, b.mid, b.lit, b.dark);
    const hr = Math.max(2, Math.round(2.6 * k));
    s.ell(cx + rx + 1, cy + 1, hr, hr - 0.4, o.face.mid, o.face.lit, o.face.dark);
    s.rect(cx + rx + hr, cy + 1, 2, Math.max(2, hr - 1), o.face.mid);
    s.put(cx + rx + 2, cy, p.ink);
    if (o.horn || o.curl) {
      const hx = cx + rx + 1;
      s.line(hx, cy - hr + 1, hx - 1, cy - hr - 2, p['sand light']);
      s.line(hx + 1, cy - hr + 1, hx + 3, cy - hr - 2, p['sand light']);
    }
    if (o.beard) s.rect(cx + rx + hr - 1, cy + hr, 1, 2, p['gravel dark']);
    s.outline(p.ink);
    return s.image;
  };

  const frames = {};
  for (const [kind, o] of Object.entries(kinds)) {
    for (const f of [0, 1]) {
      const img = walk(o, f);
      frames[`animal.${kind}.e.${f}`] = img;
      frames[`animal.${kind}.w.${f}`] = mirror(img);
    }
    frames[`animal.${kind}.dead`] = dead(o);
  }
  return frames;
}

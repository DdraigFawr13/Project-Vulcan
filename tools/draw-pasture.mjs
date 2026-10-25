// Draws the Phase 5 Bundle 3 pasture frames into art/src/buildings/ (docs/ART.md): the wattle
// hurdle (`build.hurdle.<0-15>`, the neighbour mask of walls: north 1, east 2, south 4, west 8)
// and the hurdle gate (`build.gate-hurdle.<h|v>`), a low band 6 px wide of stakes every 8 px with
// two woven rods between them, so the grass shows through; and the hay ground tiles
// `pasture.meadow` (tall uncut grass), `pasture.swath` (cut hay in rows on stubble),
// `pasture.cocks` (two haycocks on stubble), `pasture.stubble`, all opaque 32 px tiles, plus the
// transparent `pasture.rick.<1-3>` (a haystack, small, half, full) and `pasture.tuft` (wool).
// Colours only from art/palette.gpl, no randomness. Called from tools/draw-buildings.mjs.
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';
import { canvas } from './draw-furniture.mjs';
import { surface } from './draw-items-surface.mjs';

const S = 32;
const B0 = 13;
const B1 = 18;
const inBox = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// Which axis a band pixel runs along ('x' east-west, 'y' north-south), or none outside the band.
function bandAxis(mask, x, y) {
  if (inBox(x, y, B0, 0, B1, B0 - 1)) return mask & 1 ? 'y' : null;
  if (inBox(x, y, B0, B1 + 1, B1, S - 1)) return mask & 4 ? 'y' : null;
  if (inBox(x, y, B1 + 1, B0, S - 1, B1)) return mask & 2 ? 'x' : null;
  if (inBox(x, y, 0, B0, B0 - 1, B1)) return mask & 8 ? 'x' : null;
  if (!inBox(x, y, B0, B0, B1, B1)) return null;
  return mask & 10 || !(mask & 5) ? 'x' : 'y';
}

function hurdlePixel(p, axis, along, a) {
  if (along % 8 < 2) return a === 0 ? p['ui oak light'] : p['ui oak'];
  const weave = (along >> 2) % 2;
  if (a === 1 || a === 4) return (along + a) % 4 < 2 ? p['straw dark'] : p['leaf litter light'];
  if (a === 2 && !weave) return p['leaf litter'];
  if (a === 3 && weave) return p['straw dark'];
  return undefined;
}

function hurdle(p, mask, gate) {
  const c = canvas();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const axis = bandAxis(mask, x, y);
      if (!axis) continue;
      const along = axis === 'x' ? x : y;
      const a = (axis === 'x' ? y : x) - B0;
      // Stakes stand in the centre tile whichever way the weave runs.
      const col = inBox(x, y, 16, 16, 17, 17) ? p['ui oak light'] : hurdlePixel(p, axis, along, a);
      if (col && !(gate && along >= 7 && along <= 24)) c.put(x, y, col);
    }
  if (gate) {
    // A leaf between two posts: top and bottom rails and a diagonal brace.
    const at = (u, v) => (gate === 'h' ? [u, v] : [v, u]);
    const dot = (u, v, col) => c.put(...at(u, v), col);
    for (let u = 7; u <= 24; u++) {
      const post = u <= 8 || u >= 23;
      for (let a = 0; a < 6; a++) {
        if (post) dot(u, B0 + a, a === 0 ? p['ui oak light'] : p['ui oak dark']);
        else if (a === 1 || a === 4) dot(u, B0 + a, p['leaf litter light']);
      }
    }
    for (let u = 9; u <= 22; u++) dot(u, B0 + 4 - Math.round(((u - 9) * 3) / 13), p.straw);
    dot(21, B0 + 2, p['ui iron light']);
  }
  return c.img;
}

function stubbleTile(p) {
  const c = canvas();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = noise(41, x, y);
      c.put(x, y, n < 0.25 ? p['leaf litter'] : p['leaf litter light']);
      if (noise(42, x, y) > 0.86) c.put(x, y, p['straw dark']);
      if (noise(43, x, y) > 0.93 && y < S - 1) c.put(x, y + 1, p.straw);
    }
  return c;
}

function meadowTile(p) {
  const c = canvas();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      c.put(x, y, noise(44, x >> 1, y >> 1) < 0.4 ? p['grass dark'] : p.grass);
  // Tall blades: vertical runs, dark at the foot, pale at the seeding tip.
  for (let x = 0; x < S; x++) {
    if (noise(45, x, 0) < 0.08) continue;
    const top = 4 + Math.floor(noise(46, x, 1) * 14);
    const len = 12 + Math.floor(noise(47, x, 2) * 10);
    for (let i = 0; i < len; i++) {
      const y = (top + i) % S;
      const t = i / len;
      c.put(
        x,
        y,
        t < 0.15
          ? p['straw blade']
          : t < 0.4
            ? p['grass tip']
            : t < 0.75
              ? p['grass light']
              : p.grass,
      );
    }
    if (noise(48, x, 3) > 0.5) c.put(x, top % S, p['straw light']);
  }
  return c;
}

function swathTile(p) {
  const c = stubbleTile(p);
  // Rows of cut hay, a row every 8 px running east to west, joined across tiles; a swell now and
  // then to read as lying hay.
  for (let row = 0; row < 4; row++)
    for (let x = 0; x < S; x++) {
      const bulge = noise(49, x >> 2, row) > 0.6 ? 1 : 0;
      const y0 = row * 8 + 2 - bulge;
      c.put(x, y0, p['straw dark']);
      c.put(x, y0 + 1, p.straw);
      c.put(x, y0 + 2, noise(50, x, row) > 0.7 ? p['straw blade'] : p['straw light']);
      c.put(x, y0 + 3, p.straw);
      c.put(x, y0 + 4 + (bulge ? 0 : -1), p['straw dark']);
    }
  return c;
}

// A mound of hay as an ellipse stack on a surface, shaded from the upper left.
function haycock(s, p, cx, cy, rx, ry) {
  s.ell(cx, cy, rx, ry, p.straw, p['straw light'], p['straw dark']);
  for (let i = -rx + 2; i < rx - 1; i += 3)
    s.put(cx + i, cy - Math.floor(ry / 2) + (i % 2), p['straw blade']);
  s.put(cx, cy - ry, p['straw dark']);
}

function onto(base, sprite) {
  for (let i = 0; i < S * S; i++)
    if (sprite.data[i * 4 + 3]) base.img.data.set(sprite.data.subarray(i * 4, i * 4 + 4), i * 4);
}

function cocksTile(p) {
  const c = stubbleTile(p);
  const s = surface();
  haycock(s, p, 10, 13, 6, 5);
  haycock(s, p, 22, 24, 6, 5);
  s.outline(p.ink);
  onto(c, s.image);
  return c;
}

function rick(p, size) {
  const s = surface();
  const [rx, ry] = [
    [7, 4],
    [10, 7],
    [12, 11],
  ][size - 1];
  const cy = 28 - ry;
  haycock(s, p, 16, cy, rx, ry);
  if (size === 3) {
    // A tall stack with a peaked cap and a binding rope.
    for (let i = 0; i < 5; i++) s.put(16, cy - ry - i + 1, p['straw dark']);
    s.rect(15, cy - ry + 1, 3, 3, p.straw);
    s.line(16 - rx + 1, cy + 3, 16 + rx - 1, cy + 3, p['straw dark']);
  }
  if (size === 2) s.line(16 - rx + 1, cy + 2, 16 + rx - 1, cy + 2, p['straw dark']);
  s.outline(p.ink);
  return s.image;
}

function tuft(p) {
  const s = surface();
  s.ell(15, 22, 4, 2.4, p['snow light'], p.bone, p['snow shade']);
  s.ell(20, 24, 3, 1.8, p.snow, p['snow light'], p['limestone dark']);
  s.put(12, 20, p.bone);
  s.put(18, 21, p['snow shade']);
  s.put(23, 23, p.bone);
  s.outline(p['limestone dark']);
  return s.image;
}

export function drawPasture(p = readPalette()) {
  const frames = {};
  for (let mask = 0; mask < 16; mask++) frames[`build.hurdle.${mask}`] = hurdle(p, mask);
  frames['build.gate-hurdle.h'] = hurdle(p, 10, 'h');
  frames['build.gate-hurdle.v'] = hurdle(p, 5, 'v');
  frames['pasture.meadow'] = meadowTile(p).img;
  frames['pasture.swath'] = swathTile(p).img;
  frames['pasture.cocks'] = cocksTile(p).img;
  frames['pasture.stubble'] = stubbleTile(p).img;
  for (const n of [1, 2, 3]) frames[`pasture.rick.${n}`] = rick(p, n);
  frames['pasture.tuft'] = tuft(p);
  return frames;
}

// Rock-wall grounds and the fallen log for draw-nature.mjs (docs/ART.md); palette colours only.
import { S, noise, blobs, canvas, shade, marks, sprite, wrap } from './draw-nature.mjs';

// Solid rock grounds: shaded base, then a structure that wraps at the tile edge.
export const slate = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['slate dark', 'slate', 'slate light'], 8, 0.4, 0.62);
    // Thin parallel cleavage lines (slope -1/2), broken here and there, lit on one side.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const k = (x + 2 * y) % 8;
        const on = noise(seed, Math.floor((x + 2 * y) / 8) % 4, Math.floor(x / 6)) < 0.8;
        if (k === 0 && on) set(x, y, p['slate line']);
        else if (k === 1 && on && noise(seed + 1, x, y) < 0.5) set(x, y, p['slate light']);
      }
  });

// Granite capped with wind-packed snow: rock shows through in dark patches and along the ridges.
export const snowcap = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['rock dark', 'rock', 'rock light'], 8, 0.4, 0.62);
    const cover = (x, y) => blobs(seed + 5, x, y, 16) * 0.7 + blobs(seed + 6, x, y, 8) * 0.3;
    const snowy = (x, y) => cover(x, y) + (noise(seed + 8, x, y) - 0.5) * 0.12 < 0.52;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!snowy(x, y)) {
          // Bare rock: darker where deep inside a patch, lit edge below the snow.
          if (snowy(x, wrap(y - 1))) set(x, y, p['rock dark']);
          else if (snowy(wrap(x - 1), y) && noise(seed + 9, x, y) < 0.5) set(x, y, p['rock edge']);
          continue;
        }
        // Snow: drifts shaded on the lee (lower right) side, sparkle on the windward side.
        const lee = !snowy(wrap(x + 1), y) || !snowy(x, wrap(y + 1));
        const v = blobs(seed + 7, x, y, 8);
        set(x, y, p[lee ? 'snow shade' : v > 0.6 ? 'snow light' : 'snow']);
      }
    marks(p, set, seed + 1, 8, ['snow shade'], 3, 1, 1); // wind ripples
  });

export const limestone = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['limestone dark', 'limestone', 'limestone light'], 8, 0.36, 0.64);
    // Blocks 16 wide and 8 high, courses offset by half a block; joints dark, a lit lip below.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const row = Math.floor(y / 8);
        const vx = (x + (row % 2) * 8) % 16 === 0;
        if (y % 8 === 0 || vx) set(x, y, p['limestone joint']);
        else if (y % 8 === 1 && noise(seed + 2, x, row) < 0.6) set(x, y, p['limestone light']);
      }
    marks(p, set, seed + 3, 14, ['limestone joint'], 2, 1, 0); // pits
    marks(p, set, seed + 4, 8, ['limestone joint'], 1, 0, 1);
  });

export const sandstone = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['sandstone dark', 'sandstone', 'sandstone light'], 8, 0.4, 0.64);
    // Horizontal bedding bands with a slight wave; each band row picks a tone.
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const w = wrap(y + Math.round(1.5 * Math.sin((x / S) * Math.PI * 2 + seed)));
        const band = w % 6;
        if (band === 0) set(x, y, p['sandstone band']);
        else if (band === 1 && noise(seed + 1, x, Math.floor(w / 6)) < 0.55)
          set(x, y, p['sandstone light']);
      }
  });

// A mossy trunk lying on the diagonal from lower left to upper right.
export function log(p) {
  const d = (x, y) => Math.abs(x + y - 38) / Math.SQRT2; // distance from the trunk axis
  const along = (x, y) => (x - y + 32) / Math.SQRT2;
  const body = (x, y) => d(x, y) <= 3.6 && along(x, y) >= 10 && along(x, y) <= 38;
  const img = sprite(
    p,
    281,
    [
      {
        mask: body,
        colours: ['rock dark', 'trunk', 'dirt light'],
        shade: (x, y) => (x + y < 38 ? 0.35 : -0.3),
      },
    ],
    { shadow: [17, 25, 11, 3] },
  );
  // Moss on the upper side, in patches; cut end rings at the lower left.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!body(x, y) || !body(x - 1, y) || !body(x + 1, y) || !body(x, y - 1) || !body(x, y + 1))
        continue;
      const patch = noise(282, Math.floor(x / 3), Math.floor(y / 3)) < 0.55;
      if (x + y < 38 && patch)
        img.data.set([...p[noise(283, x, y) < 0.4 ? 'oak light' : 'oak'], 255], (y * S + x) * 4);
      else if (along(x, y) < 12.5)
        img.data.set([...p[d(x, y) < 1.6 ? 'dirt dark' : 'sand dark'], 255], (y * S + x) * 4);
    }
  return img;
}

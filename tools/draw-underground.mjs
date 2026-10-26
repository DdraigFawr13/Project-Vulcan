// P1.3 underground frames for draw-nature.mjs (docs/ART.md): wall and floor grounds, stairs, shaft,
// and ore-vein sprites. Palette colours only; wrapped noise keeps grounds seamless.
import { S, noise, blobs, canvas, shade, marks, wrap } from './draw-nature.mjs';

const fill = (set, c, x0, y0, x1, y1) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
};

const earth = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['trunk', 'dirt dark', 'dirt'], 4, 0.4, 0.68);
    marks(p, set, seed + 1, 18, ['leaf litter dark'], 2, 1, 0);
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(noise(seed, k, 1) * S);
      const y = Math.floor(noise(seed, k, 2) * S);
      for (const [dx, dy, c] of [
        [0, 0, 'gravel'],
        [1, 0, 'gravel dark'],
        [0, 1, 'gravel dark'],
        [1, 1, 'rock'],
      ])
        set(wrap(x + dx), wrap(y + dy), p[c]);
      set(wrap(x - 1), wrap(y + 1), p.ink);
    }
  });

const clay = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['needle dark', 'needle', 'needle light'], 16, 0.35, 0.7);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const layer = noise(seed + 3, 0, Math.floor(y / 3));
        if (y % 6 === 0 && noise(seed + 4, Math.floor(x / 8), y) < 0.8) set(x, y, p['needle dark']);
        else if (y % 6 === 1 && layer < 0.5 && noise(seed + 5, x, y) < 0.6)
          set(x, y, p['needle light']);
      }
  });

const groundwater = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['slate line', 'slate dark', 'slate dark'], 8, 0.35, 0.99);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (blobs(seed + 2, x, y, 16) > 0.62 && noise(seed + 3, x, y) < 0.5)
          set(x, y, p['deep water']);
    marks(p, set, seed + 4, 14, ['slate line'], 4, 1, 0);
    marks(p, set, seed + 5, 7, ['deep water light'], 2, 1, 0); // glints
    marks(p, set, seed + 6, 2, ['slate light'], 1, 1, 0);
  });

const caveFloor = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['darkness', 'ink', 'ink'], 6, 0.35, 0.99);
    marks(p, set, seed + 1, 20, ['rock dark'], 1, 1, 0);
    for (let k = 0; k < 14; k++) {
      const x = Math.floor(noise(seed, k, 1) * S);
      const y = Math.floor(noise(seed, k, 2) * S);
      set(x, y, p['rock light']);
      set(wrap(x + 1), y, p.rock);
      set(x, wrap(y + 1), p['rock dark']);
      set(wrap(x + 1), wrap(y + 1), p['rock dark']);
    }
  });

// Dug stone floor around an opening.
const surround = (p, set, seed) => {
  shade(p, set, seed, ['floor dark', 'floor', 'floor'], 8, 0.4, 0.99);
  marks(p, set, seed + 1, 20, ['gravel'], 2, 1, 0);
};

// A run of steps: each band is `h` rows, a lit lip on top, and a shadow row under it.
const steps = (set, p, x0, x1, y0, bands) => {
  let y = y0;
  for (const [h, body, lip] of bands) {
    fill(set, p[body], x0, y, x1, y + h - 1);
    fill(set, p[lip], x0, y, x1, y);
    y += h;
  }
};

const frame = (set, p, x0, y0, x1, y1, c = 'ink') => {
  fill(set, p[c], x0 - 1, y0 - 1, x1 + 1, y0 - 1);
  fill(set, p[c], x0 - 1, y1 + 1, x1 + 1, y1 + 1);
  fill(set, p[c], x0 - 1, y0, x0 - 1, y1);
  fill(set, p[c], x1 + 1, y0, x1 + 1, y1);
};

const stairsDown = (p, seed) =>
  canvas((set) => {
    surround(p, set, seed);
    frame(set, p, 7, 5, 24, 26);
    steps(set, p, 7, 24, 5, [
      [6, 'rock', 'rock edge'],
      [5, 'rock dark', 'rock light'],
      [5, 'ink', 'rock'],
      [5, 'darkness', 'rock dark'],
    ]);
    fill(set, p['floor light'], 6, 4, 25, 4);
  });

const stairsUp = (p, seed) =>
  canvas((set) => {
    surround(p, set, seed);
    frame(set, p, 7, 5, 24, 26);
    steps(set, p, 7, 24, 5, [
      [5, 'floor light', 'bone'],
      [5, 'floor', 'floor light'],
      [5, 'floor dark', 'floor'],
      [6, 'rock', 'floor dark'],
    ]);
    // Light falls in from above onto the top step.
    fill(set, p.bone, 9, 6, 22, 6);
    fill(set, p['rock dark'], 7, 11, 24, 11);
    fill(set, p['rock dark'], 7, 16, 24, 16);
    fill(set, p['rock dark'], 7, 21, 24, 21);
  });

const stairsBoth = (p, seed) =>
  canvas((set) => {
    surround(p, set, seed);
    frame(set, p, 7, 3, 24, 28);
    steps(set, p, 7, 24, 3, [
      [4, 'floor light', 'bone'],
      [4, 'floor', 'floor light'],
      [8, 'floor', 'floor light'], // landing
      [4, 'rock dark', 'rock'],
      [5, 'ink', 'rock dark'],
      [3, 'darkness', 'ink'],
    ]);
    fill(set, p['rock dark'], 7, 7, 24, 7);
    fill(set, p['floor dark'], 7, 15, 24, 15);
    fill(set, p['floor dark'], 7, 11, 24, 11);
  });

const shaft = (p, seed) =>
  canvas((set) => {
    surround(p, set, seed);
    fill(set, p.ink, 4, 4, 27, 27);
    fill(set, p.trunk, 5, 5, 26, 26);
    fill(set, p['dirt light'], 5, 5, 26, 6);
    fill(set, p['dirt light'], 5, 5, 6, 26);
    fill(set, p['dirt dark'], 5, 25, 26, 26);
    fill(set, p['dirt dark'], 25, 5, 26, 26);
    fill(set, p.ink, 9, 9, 22, 22);
    fill(set, p.darkness, 10, 10, 21, 21);
    fill(set, p.ink, 10, 10, 21, 10);
    fill(set, p.ink, 10, 10, 10, 21);
    for (const [x, y] of [
      [6, 6],
      [25, 6],
      [6, 25],
      [25, 25],
    ])
      set(x, y, p.gravel);
  });

export const undergroundTiles = (p) => ({
  'tile.earth.1': earth(p, 301),
  'tile.clay.1': clay(p, 311),
  'tile.groundwater.1': groundwater(p, 321),
  'tile.cave-floor.1': caveFloor(p, 331),
  'tile.stairs-down.1': stairsDown(p, 341),
  'tile.stairs-up.1': stairsUp(p, 351),
  'tile.stairs.1': stairsBoth(p, 361),
  'tile.shaft.1': shaft(p, 371),
});

// ---- ore veins ----------------------------------------------------------------------------
// Irregular nugget clusters from wrapped noise (so a vein continues into the next tile), ~32%
// of the tile. Ink outline, a lit upper-left rim, accent specks inside.
const VEINS = {
  copper: {
    seed: 401,
    cols: ['dirt dark', 'needle light', 'amber'],
    accent: 'malachite',
    dark: 'oak dark',
  },
  tin: {
    seed: 411,
    cols: ['gravel', 'floor light', 'bone'],
    accent: 'snow light',
    dark: 'floor dark',
  },
  iron: {
    seed: 421,
    cols: ['needle dark', 'sandstone dark', 'berry'],
    accent: 'sandstone light',
    dark: 'dirt dark',
  },
  sulphur: {
    seed: 431,
    cols: ['straw', 'sulphur', 'straw blade'],
    accent: 'snow light',
    dark: 'straw dark',
  },
  gold: { seed: 441, cols: ['needle', 'gold', 'straw blade'], accent: 'bone', dark: 'dirt dark' },
  silver: {
    seed: 451,
    cols: ['slate light', 'silver', 'snow light'],
    accent: 'bone',
    dark: 'slate dark',
  },
  gems: {
    seed: 461,
    cols: ['gem purple', 'gem purple light', 'bone'],
    accent: 'gem red',
    dark: 'slate line',
  },
  salt: {
    seed: 481,
    cols: ['floor light', 'bone', 'snow light'],
    accent: 'snow light',
    dark: 'gravel dark',
  },
  obsidian: {
    seed: 471,
    cols: ['darkness', 'ink', 'slate light'],
    accent: 'snow light',
    dark: 'darkness',
  },
};

function vein(p, name) {
  const { seed, cols, accent, dark } = VEINS[name];
  const field = (x, y) => blobs(seed, x, y, 8) * 0.6 + blobs(seed + 1, x, y, 4) * 0.4;
  const values = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) values.push(field(x, y));
  const limit = values.sort((a, b) => a - b)[Math.floor(S * S * 0.34)];
  const raw = (x, y) => field(wrap(x), wrap(y)) <= limit;
  // Drop pixels with no neighbour so every speck is at least a small nugget.
  const inMask = (x, y) =>
    raw(x, y) && (raw(x - 1, y) || raw(x + 1, y) || raw(x, y - 1) || raw(x, y + 1));
  return canvas((set) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!inMask(x, y)) continue;
        const edge =
          !inMask(x - 1, y) || !inMask(x + 1, y) || !inMask(x, y - 1) || !inMask(x, y + 1);
        if (edge) {
          set(x, y, p.ink);
          continue;
        }
        const rim = !inMask(x - 1, y - 1) || !inMask(x - 1, y) || !inMask(x, y - 1);
        const shadowed = !inMask(x + 1, y + 1) || !inMask(x + 1, y) || !inMask(x, y + 1);
        const r = noise(seed + 9, x, y);
        let c = rim ? cols[2] : shadowed ? cols[0] : cols[1];
        if (!rim && r > 0.82) c = accent;
        else if (!rim && !shadowed && r < 0.12) c = dark;
        set(x, y, p[c]);
      }
    // Gems and obsidian: a bright facet or glint on the lit side of each nugget.
    if (name === 'gems' || name === 'obsidian')
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++)
          if (
            inMask(x, y) &&
            !inMask(x - 1, y - 1) &&
            inMask(x + 1, y + 1) &&
            noise(seed + 3, x, y) < 0.7
          )
            set(x + 1, y + 1, p[name === 'gems' ? 'bone' : 'snow light']);
  });
}

export const undergroundVeins = (p) =>
  Object.fromEntries(Object.keys(VEINS).map((n) => [`vein.${n}.1`, vein(p, n)]));

// Draws the P1.1 `tiles-world` and `sprites-nature` placeholder sheets into art/src/ (docs/ART.md),
// using only colours from art/palette.gpl. Seeded, so a re-run gives identical files.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { undergroundTiles, undergroundVeins } from './draw-underground.mjs';
import { slate, limestone, sandstone, snowcap, log } from './draw-nature-rock.mjs';

export const S = 32;

export function noise(seed, x, y) {
  let h =
    Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(x, 0x27d4eb2f) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// Smooth value noise that wraps at the tile edge, so tiles repeat seamlessly.
export function blobs(seed, x, y, cell) {
  const n = S / cell;
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const at = (i, j) => noise(seed, ((i % n) + n) % n, ((j % n) + n) % n);
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

export function canvas(draw) {
  const image = createImage(S, S);
  const set = (x, y, rgb, alpha = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    image.data.set([...rgb, alpha], (y * S + x) * 4);
  };
  draw(set);
  return image;
}

export const wrap = (v) => ((v % S) + S) % S;

// ---- ground tiles -------------------------------------------------------------------------

// Base shading by wrapped noise: [dark, mid, light] palette names.
export function shade(p, set, seed, [dark, mid, light], cell = 8, lo = 0.38, hi = 0.66) {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = blobs(seed, x, y, cell) + (noise(seed + 7, x, y) - 0.5) * 0.25;
      set(x, y, p[v < lo ? dark : v > hi ? light : mid]);
    }
}

// Scatter `count` marks of `len` pixels; dx/dy give the direction; wraps at the edges.
export function marks(p, set, seed, count, colours, len, dx, dy) {
  for (let k = 0; k < count; k++) {
    const x = Math.floor(noise(seed, k, 1) * S);
    const y = Math.floor(noise(seed, k, 2) * S);
    const c = p[colours[Math.floor(noise(seed, k, 3) * colours.length)]];
    for (let i = 0; i < len; i++) set(wrap(x + i * dx), wrap(y + i * dy), c);
  }
}

const forestFloor = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['leaf litter dark', 'leaf litter', 'leaf litter light'], 6);
    marks(p, set, seed + 1, 26, ['leaf litter dark', 'leaf litter light'], 2, 1, 0);
    marks(p, set, seed + 2, 12, ['fleck green'], 2, 1, 1);
  });

const needles = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['needle dark', 'needle', 'needle light'], 8, 0.4, 0.62);
    marks(p, set, seed + 1, 40, ['needle dark', 'needle light'], 4, 1, 1);
    marks(p, set, seed + 2, 16, ['needle light'], 3, 1, -1);
  });

const dryGrass = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['straw dark', 'straw', 'straw light'], 8);
    // Upright blades: pale tip over a dark root.
    for (let k = 0; k < 22; k++) {
      const x = Math.floor(noise(seed, k, 101) * S);
      const y = Math.floor(noise(seed, k, 202) * S);
      set(x, wrap(y - 1), p['straw blade']);
      set(x, y, p['straw light']);
      set(x, wrap(y + 1), p['straw dark']);
      set(wrap(x + 1), wrap(y + 1), p['straw dark']);
    }
  });

const marsh = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['marsh dark', 'marsh', 'marsh light'], 8);
    // Small pools: wrapped noise blobs below a threshold, with a lit bottom edge.
    const pool = (x, y) => blobs(seed + 5, x, y, 8) + (noise(seed + 6, x, y) - 0.5) * 0.15 < 0.28;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (pool(x, y)) set(x, y, p[pool(x, wrap(y + 1)) ? 'pool' : 'pool light']);
    marks(p, set, seed + 1, 10, ['marsh dark'], 1, 0, 1);
  });

const tundra = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['tundra dark', 'tundra', 'tundra light'], 4, 0.4, 0.62);
    for (let k = 0; k < 34; k++) {
      const x = Math.floor(noise(seed, k, 1) * S);
      const y = Math.floor(noise(seed, k, 2) * S);
      set(x, y, p.lichen);
      if (noise(seed, k, 3) < 0.4) set(wrap(x + 1), y, p.lichen);
    }
  });

const snow = (p, seed) =>
  canvas((set) => {
    shade(p, set, seed, ['snow shade', 'snow', 'snow light'], 16, 0.3, 0.7);
    marks(p, set, seed + 1, 16, ['snow shade'], 3, 1, 0);
  });

export function drawTilesWorld(p = readPalette()) {
  return {
    'tile.forest-floor.1': forestFloor(p, 101),
    'tile.forest-floor.2': forestFloor(p, 102),
    'tile.needles.1': needles(p, 111),
    'tile.needles.2': needles(p, 112),
    'tile.dry-grass.1': dryGrass(p, 121),
    'tile.dry-grass.2': dryGrass(p, 122),
    'tile.marsh.1': marsh(p, 131),
    'tile.marsh.2': marsh(p, 132),
    'tile.tundra.1': tundra(p, 141),
    'tile.snow.1': snow(p, 151),
    'tile.slate.1': slate(p, 161),
    'tile.limestone.1': limestone(p, 171),
    'tile.sandstone.1': sandstone(p, 181),
    'tile.snowcap.1': snowcap(p, 191),
    ...undergroundTiles(p),
  };
}

// ---- nature sprites -----------------------------------------------------------------------

// A shape is a mask function over the 32x32 frame. `paint` shades it lit from the top left, adds
// an ink outline where a neighbour is outside the mask, and a soft shadow under it.
export function sprite(p, seed, parts, { shadow = [16, 27, 9, 3] } = {}) {
  return canvas((set) => {
    const [sx, sy, rx, ry] = shadow;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2 <= 1) set(x, y, p.ink, 90);
    for (const part of parts) {
      const inside = (x, y) => x >= 0 && y >= 0 && x < S && y < S && part.mask(x, y);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          if (!inside(x, y)) continue;
          const edge =
            !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          if (edge && part.outline !== false) {
            set(x, y, p.ink);
            continue;
          }
          const [dark, mid, light] = part.colours;
          const lit = part.shade ? part.shade(x, y) : 0;
          const v = lit + (noise(seed, x, y) - 0.5) * 0.5;
          set(x, y, p[v < -0.22 ? dark : v > 0.22 ? light : mid]);
        }
    }
  });
}

const disc = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
// Lighting for a round shape: positive towards the top left.
const lightFrom = (cx, cy, r) => (x, y) => (-(x - cx) - (y - cy)) / (r * 1.2);
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const union =
  (...masks) =>
  (x, y) =>
    masks.some((m) => m(x, y));

// A crown made of overlapping lobes (a lumpy round outline).
const lobes = (cx, cy, r, count, lobeR, seed) =>
  union(
    disc(cx, cy, r, r * 0.9),
    ...Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + noise(seed, i, 9);
      return disc(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.7, lobeR, lobeR);
    }),
  );

const trunk = (colours, x0 = 14, x1 = 17) => ({
  mask: rect(x0, 20, x1, 27),
  colours,
  shade: (x) => (x < (x0 + x1) / 2 ? 0.3 : -0.3),
});

const tree = (p, seed, crown) => sprite(p, seed, [trunk(crown.trunk), crown.part]);

function oak(p) {
  const mask = lobes(16, 13, 10, 7, 4.5, 1);
  return tree(p, 201, {
    trunk: ['rock dark', 'trunk', 'dirt light'],
    part: { mask, colours: ['oak dark', 'oak', 'oak light'], shade: lightFrom(14, 11, 10) },
  });
}

function ash(p) {
  // Airier: smaller separate clumps with gaps, so the crown reads as lighter and open.
  const mask = union(
    disc(11, 12, 5, 5),
    disc(21, 11, 5, 4.5),
    disc(16, 7, 5, 4.5),
    disc(16, 15, 6, 4.5),
    disc(9, 18, 3.5, 3),
    disc(23, 18, 3.5, 3),
  );
  return tree(p, 211, {
    trunk: ['rock dark', 'trunk', 'dirt light'],
    part: { mask, colours: ['oak', 'ash', 'ash light'], shade: lightFrom(14, 10, 10) },
  });
}

function birch(p) {
  const mask = union(disc(16, 11, 7, 9), disc(12, 13, 5, 6), disc(21, 13, 5, 6));
  const stem = sprite(p, 221, [
    {
      mask: rect(15, 18, 17, 27),
      colours: ['gravel', 'bone', 'bone'],
      shade: (x) => (x < 16 ? 0.4 : -0.3),
    },
    {
      mask: mask,
      colours: ['ash', 'birch leaf', 'birch leaf light'],
      shade: lightFrom(14, 9, 9),
    },
  ]);
  // Dark bark marks on the trunk.
  for (const y of [21, 24]) stem.data.set([...p.ink, 255], (y * S + 16) * 4);
  return stem;
}

function pine(p) {
  // Stacked triangles, widest at the bottom, with a pointed top.
  const tier = (top, bottom, half) => (x, y) =>
    y >= top && y <= bottom && Math.abs(x - 16) <= (half * (y - top)) / (bottom - top) + 0.5;
  const mask = union(tier(2, 12, 6), tier(8, 19, 8), tier(14, 26, 11));
  return sprite(p, 231, [
    trunk(['rock dark', 'trunk', 'dirt light'], 15, 16),
    {
      mask,
      colours: ['pine dark', 'pine', 'pine light'],
      shade: (x, y) => (-(x - 16) / 14 - (y % 6 < 2 ? 0.5 : 0)) * 1.2,
    },
  ]);
}

function willow(p) {
  // Round crown with hanging fronds down both sides.
  const fronds = (x, y) => {
    for (const fx of [7, 10, 13, 19, 22, 25]) {
      const len = 8 + Math.floor(noise(241, fx, 1) * 6);
      if (x === fx && y >= 14 && y <= 14 + len) return true;
    }
    return false;
  };
  return sprite(p, 241, [
    trunk(['rock dark', 'trunk', 'dirt light'], 15, 16),
    { mask: fronds, colours: ['willow dark', 'willow', 'willow light'], outline: false },
    {
      mask: disc(16, 11, 11, 8),
      colours: ['willow dark', 'willow', 'willow light'],
      shade: (x, y) => lightFrom(14, 8, 11)(x, y) - (y > 16 ? 0.15 : 0),
    },
  ]);
}

function bush(p) {
  const img = sprite(
    p,
    251,
    [
      {
        mask: union(disc(16, 20, 10, 7), disc(11, 18, 6, 6), disc(21, 18, 6, 6)),
        colours: ['oak dark', 'oak', 'oak light'],
        shade: lightFrom(14, 15, 9),
      },
    ],
    { shadow: [16, 27, 11, 2.5] },
  );
  for (const [bx, by] of [
    [10, 18],
    [15, 15],
    [21, 17],
    [13, 22],
    [19, 22],
    [24, 21],
  ])
    img.data.set([...p.berry, 255], (by * S + bx) * 4);
  return img;
}

function herb(p) {
  const img = sprite(
    p,
    261,
    [
      {
        mask: union(disc(16, 23, 6, 3.5), disc(12, 22, 3.5, 3), disc(20, 22, 3.5, 3)),
        colours: ['oak dark', 'oak', 'oak light'],
        shade: lightFrom(14, 20, 6),
      },
    ],
    { shadow: [16, 27, 7, 1.8] },
  );
  for (const [fx, fy] of [
    [12, 20],
    [16, 19],
    [20, 21],
    [14, 23],
  ])
    img.data.set([...p.bone, 255], (fy * S + fx) * 4);
  return img;
}

function boulder(p) {
  const mask = union(disc(16, 20, 11, 8), disc(11, 21, 6, 6), disc(22, 19, 6, 6));
  const img = sprite(
    p,
    271,
    [
      {
        mask,
        colours: ['rock', 'gravel', 'gravel light'],
        shade: (x, y) => lightFrom(13, 15, 11)(x, y) * 0.8,
      },
    ],
    { shadow: [16, 27, 12, 2.5] },
  );
  // Light top edge: the first lit pixel under the outline on each column.
  for (let x = 0; x < S; x++)
    for (let y = 0; y < S; y++) {
      if (!mask(x, y)) continue;
      if (x > 8 && x < 24) img.data.set([...p['floor light'], 255], ((y + 1) * S + x) * 4);
      break;
    }
  return img;
}

export function drawSpritesNature(p = readPalette()) {
  return {
    'tree.oak.1': oak(p),
    'tree.ash.1': ash(p),
    'tree.birch.1': birch(p),
    'tree.pine.1': pine(p),
    'tree.willow.1': willow(p),
    'bush.berry.1': bush(p),
    'herb.wild.1': herb(p),
    'boulder.1': boulder(p),
    'log.fallen.1': log(p),
    ...undergroundVeins(p),
  };
}

if (isMain(import.meta.url)) {
  for (const [sheet, frames] of [
    ['tiles-world', drawTilesWorld()],
    ['sprites-nature', drawSpritesNature()],
  ]) {
    const out = path.join(root, 'art/src', sheet);
    mkdirSync(out, { recursive: true });
    for (const [name, image] of Object.entries(frames))
      writeFileSync(path.join(out, `${name}.png`), encodePng(image));
    console.log(`${sheet}: drew ${Object.keys(frames).length} frames into ${out}`);
  }
}

// The rest of the Phase 5A Bundle 2 art (tools/draw-wild.mjs draws the animals and calls these):
// tracks (`print.<paw|hoof|hare>.<dir>`), `site.midden` and the items `item.hide`, `item.bone`,
// `item.fat`, `item.<stone|bronze|iron>-spear`. Colours only from art/palette.gpl; deterministic.
import { createImage } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { surface } from './draw-items-surface.mjs';

const S = 32;
const PRINT_KINDS = ['paw', 'hoof', 'hare'];
const DIRS = {
  n: [0, -1],
  ne: [1, -1],
  e: [1, 0],
  se: [1, 1],
  s: [0, 1],
  sw: [-1, 1],
  w: [-1, 0],
  nw: [-1, -1],
};

// Tracks, drawn in a frame whose x axis runs along the direction of travel (u) and y across (v),
// then sampled into the tile. Each tile carries two prints, staggered left and right of the line.
const PRINT_SHAPES = {
  // Pad and four toes ahead of it.
  paw: (u, v) => {
    if ((u / 2.3) ** 2 + (v / 2.7) ** 2 <= 1) return true;
    return [-3.4, -1.2, 1.2, 3.4].some((tv, i) => {
      const tu = 3.6 + (i === 0 || i === 3 ? -1.1 : 0);
      return (u - tu) ** 2 + (v - tv) ** 2 <= 1.1;
    });
  },
  // Two slots side by side, each narrowing to the front.
  hoof: (u, v) =>
    [-1.9, 1.9].some((c) => {
      const w = 1.25 - Math.max(0, u) * 0.12;
      return Math.abs(u + 0.5) <= 2.8 && Math.abs(v - c * (1 - Math.max(0, u) * 0.06)) <= w;
    }),
  // Two big hind feet side by side, two small fore feet in line behind them.
  hare: (u, v) =>
    [-2.2, 2.2].some((c) => (u - 1) ** 2 / 6.5 + (v - c) ** 2 / 1.5 <= 1) ||
    [-0.7, 0.7].some((c) => (u + 4.4) ** 2 + (v - c) ** 2 <= 0.9),
};

export function wildPrints(p = readPalette(), colour = p.print) {
  const frames = {};
  for (const kind of PRINT_KINDS)
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const img = createImage(S, S);
      const len = Math.hypot(dx, dy);
      const [ux, uy] = [dx / len, dy / len];
      const reach = dx && dy ? 0.24 : 0.25;
      const marks = [
        [-reach * S, -3.2],
        [reach * S, 3.2],
      ];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++)
          for (const [t, off] of marks) {
            // Rotate the pixel into the print's frame: u along travel, v across (to the right).
            const rx = x + 0.5 - 16 - ux * t + uy * off;
            const ry = y + 0.5 - 16 - uy * t - ux * off;
            if (PRINT_SHAPES[kind](rx * ux + ry * uy, -rx * uy + ry * ux))
              img.data.set([...colour, 255], (y * S + x) * 4);
          }
      frames[`print.${kind}.${dir}`] = img;
    }
  return frames;
}

export function wildMidden(p = readPalette()) {
  const s = surface();
  // A low heap: a dark wide base, a taller crown, then the pale bits showing through.
  s.ell(16, 21, 14, 7.5, p['dirt dark'], p.dirt, p['ui oak']);
  s.ell(14, 17, 8.5, 5, p['ui oak'], p['dirt dark'], p['ui oak dark']);
  s.ell(21, 19, 5, 3.5, p['dirt dark'], p.dirt, p['ui oak']);
  for (const [x, y] of [
    [9, 24],
    [12, 21],
    [19, 24],
    [24, 22],
    [16, 18],
    [7, 21],
    [26, 25],
    [14, 25],
  ])
    s.put(x, y, p['rock dark']);
  // Bones: a rib arc, a long bone, a skull and a few splinters.
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    s.put(10 + 5 - 5 * Math.cos(a), 20 - 3 * Math.sin(a), p.bone);
  }
  s.line(17, 24, 23, 22, p.bone);
  s.put(17, 23, p.bone);
  s.put(23, 21, p.bone);
  s.rect(20, 17, 3, 2, p.bone);
  s.put(21, 18, p['rock dark']);
  for (const [x, y] of [
    [8, 25],
    [13, 26],
    [25, 24],
    [18, 27],
    [11, 22],
  ])
    s.put(x, y, p['limestone light']);
  s.outline(p.ink);
  return { 'site.midden': s.image };
}

export function wildItems(p = readPalette()) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };
  icon('item.hide', (s) => {
    // A pelt folded in three, fur edge showing at the top and a flipped corner.
    s.ell(16, 20, 12, 7, p['dirt dark'], p.dirt, p['ui oak']);
    s.ell(15, 17, 10, 5, p.dirt, p['dirt light'], p['dirt dark']);
    s.line(6, 19, 26, 19, p['dirt dark']);
    s.line(8, 15, 24, 15, p['dirt light']);
    for (let x = 6; x <= 26; x += 2) s.put(x, 24 + (x % 4 === 0 ? 1 : 0), p['ui oak']);
    for (let x = 8; x <= 24; x += 3) s.put(x, 12, p['leaf litter light']);
    s.rect(21, 17, 5, 3, p['leaf litter']);
    s.put(25, 17, p['leaf litter light']);
    s.line(9, 22, 22, 22, p['ui oak']);
    s.line(10, 13, 20, 13, p['dirt light']);
  });
  icon('item.bone', (s) => {
    const bone = (x0, y0, x1, y1) => {
      s.line(x0, y0, x1, y1, p.bone);
      s.line(x0, y0 + 1, x1, y1 + 1, p['limestone light']);
      for (const [x, y] of [
        [x0, y0],
        [x1, y1],
      ]) {
        s.ell(x, y - 1, 2, 2, p.bone, p['snow light'], p['limestone dark']);
        s.ell(x, y + 2, 2, 2, p.bone, p['snow light'], p['limestone dark']);
      }
    };
    bone(7, 8, 24, 22);
    bone(7, 22, 24, 8);
    s.put(16, 15, p['limestone dark']);
  });
  icon('item.fat', (s) => {
    // A pale lump in a cloth gathered and tied at the top.
    s.ell(16, 21, 10, 7, p['limestone light'], p.bone, p['limestone dark']);
    s.ell(16, 19, 6.5, 4.5, p['straw blade'], p['snow light'], p['straw light']);
    s.put(13, 17, p['snow light']);
    s.put(14, 17, p['snow light']);
    s.line(11, 15, 13, 10, p['limestone light']);
    s.line(21, 15, 19, 10, p['limestone light']);
    s.rect(13, 8, 6, 3, p.bone);
    s.rect(13, 10, 6, 1, p.straw);
    s.line(9, 24, 23, 24, p['limestone dark']);
  });
  const metals = {
    stone: [p['gravel light'], p.gravel, p['gravel dark']],
    bronze: [p['straw blade'], p.straw, p['straw dark']],
    iron: [p['slate light'], p.slate, p['slate dark']],
  };
  for (const [material, [l, m, d]] of Object.entries(metals))
    icon(`item.${material}-spear`, (s) => {
      // Shaft on the diagonal, leaf-shaped head at the top right.
      const [x0, y0, x1, y1] = [5, 28, 19, 12];
      s.line(x0, y0, x1, y1, p.trunk);
      s.line(x0 + 1, y0, x1 + 1, y1, p['dirt light']);
      const [ux, uy] = [0.66, -0.75];
      for (let i = 0; i < 11; i++) {
        const w = Math.round(2.6 * Math.sin(((i + 1.2) / 12) * Math.PI));
        const bx = 20 + ux * i;
        const by = 11 + uy * i;
        s.line(bx + uy * w, by - ux * w, bx - uy * w, by + ux * w, m);
        s.put(bx - uy * w, by + ux * w, l);
        s.put(bx + uy * w, by - ux * w, d);
      }
      s.put(27, 3, l);
      // Binding where head meets shaft.
      s.line(18, 14, 21, 14, material === 'stone' ? p.straw : p['ui oak dark']);
      s.line(18, 13, 21, 13, material === 'stone' ? p['straw dark'] : p['ui oak dark']);
    });
  return frames;
}

// Draws the P3.4 furniture frames into art/src/buildings/ (docs/ART.md): carpentry bench, bed
// (`.v` head north, `.h` head west), table, chairs and shelves (`.n/.e/.s/.w` name the side the
// back or wall is on) and chest, one tile each, using only colours from art/palette.gpl.
// Top-down at the walls' three-quarter angle, lit from the top left, with a 1 px ink outline so
// a piece reads on wood floor, stone floor and grass. Shelves fill the band of the tile nearest
// their wall, about a third deep. Seeded and deterministic.
// Usage: node tools/draw-furniture.mjs, then node tools/pack-sheet.mjs buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';

const S = 32;

function canvas() {
  const img = createImage(S, S);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    img.data.set([...c, 255], (y * S + x) * 4);
  };
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };
  const disc = (cx, cy, r, c) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) put(x, y, c);
  };
  return { img, put, rect, disc };
}

const has = (img, x, y) => x >= 0 && y >= 0 && x < S && y < S && img.data[(y * S + x) * 4 + 3] > 0;
function outline(img, ink) {
  const mark = [];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (
        !has(img, x, y) &&
        (has(img, x - 1, y) || has(img, x + 1, y) || has(img, x, y - 1) || has(img, x, y + 1))
      )
        mark.push([x, y]);
  for (const [x, y] of mark) img.data.set([...ink, 255], (y * S + x) * 4);
  return img;
}

// A turned copy: quarter turns clockwise (1: n -> e), or a transpose for the bed.
function turn(img, quarters) {
  let cur = img;
  for (let q = 0; q < quarters; q++) {
    const out = createImage(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        out.data.set(
          cur.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4),
          (x * S + (S - 1 - y)) * 4,
        );
    cur = out;
  }
  return cur;
}
function transpose(img) {
  const out = createImage(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      out.data.set(img.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4), (x * S + y) * 4);
  return out;
}

export function drawFurniture(p = readPalette()) {
  const wood = p['ui oak light'];
  const woodMid = p['ui oak'];
  const woodDark = p['ui oak grain'];
  const lit = p['straw dark'];

  // A wooden block seen from above and slightly from the south: lit top, shaded front face.
  function slab(c, x, y, w, h, front, grainSeed) {
    c.rect(x, y, w, h, wood);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        if (noise(grainSeed, x + i, y + j) > 0.86) c.put(x + i, y + j, p['leaf litter dark']);
    c.rect(x, y, w, 1, lit);
    c.rect(x, y, 1, h, lit);
    c.rect(x, y + h, w, front, woodMid);
    c.rect(x, y + h + front - 1, w, 1, woodDark);
  }

  function bench() {
    const c = canvas();
    slab(c, 3, 9, 26, 11, 5, 41);
    // Plank joints along the top.
    c.rect(4, 14, 24, 1, woodMid);
    // Legs under the front face.
    c.rect(4, 25, 3, 3, woodDark);
    c.rect(25, 25, 3, 3, woodDark);
    // Vice at the right end: iron body, jaw and screw.
    c.rect(22, 6, 7, 9, p['ui iron']);
    c.rect(22, 6, 7, 1, p['ui iron light']);
    c.rect(22, 6, 1, 9, p['ui iron light']);
    c.rect(22, 14, 7, 1, p['ui iron dark']);
    c.rect(19, 10, 3, 2, p['ui iron light']);
    c.rect(17, 9, 2, 4, woodDark);
    // A saw lying on the top: grey blade, oak handle.
    c.rect(5, 11, 11, 3, p['ui iron light']);
    c.rect(5, 13, 11, 1, p['ui iron']);
    for (let x = 5; x < 16; x += 2) c.put(x, 14, p['ui iron dark']);
    c.rect(3, 10, 3, 5, woodDark);
    c.put(4, 12, wood);
    // Shavings: curls on the top and on the floor in front.
    for (const [x, y] of [
      [9, 17],
      [12, 16],
      [15, 18],
      [6, 28],
      [10, 29],
      [14, 28],
      [19, 29],
    ])
      c.put(x, y, p['straw light']);
    for (const [x, y] of [
      [8, 17],
      [13, 17],
      [11, 29],
    ])
      c.put(x, y, p['straw blade']);
    return outline(c.img, p.ink);
  }

  function bed() {
    const c = canvas();
    // Posts and rails of the frame, head to the north.
    c.rect(7, 2, 18, 28, woodMid);
    c.rect(7, 2, 18, 1, lit);
    c.rect(7, 2, 1, 28, lit);
    c.rect(24, 3, 1, 27, woodDark);
    c.rect(7, 29, 18, 1, woodDark);
    // Taller headboard.
    c.rect(7, 2, 18, 4, wood);
    c.rect(7, 2, 18, 1, lit);
    c.rect(7, 5, 18, 1, woodDark);
    // Mattress with a pillow, then the blanket.
    c.rect(9, 6, 14, 22, p['limestone light']);
    c.rect(10, 7, 12, 6, p.bone);
    c.rect(10, 7, 12, 1, p['snow light']);
    c.rect(10, 12, 12, 1, p['limestone']);
    c.rect(9, 14, 14, 14, p['slate light']);
    c.rect(9, 14, 14, 1, p['snow shade']);
    for (let y = 18; y < 28; y += 4) c.rect(10, y, 12, 1, p.slate);
    c.rect(9, 27, 14, 1, p['slate dark']);
    c.rect(22, 14, 1, 14, p.slate);
    // Foot board.
    c.rect(7, 28, 18, 2, wood);
    c.rect(7, 29, 18, 1, woodDark);
    return outline(c.img, p.ink);
  }

  function table() {
    const c = canvas();
    slab(c, 5, 5, 22, 18, 5, 43);
    c.rect(6, 11, 20, 1, woodMid);
    c.rect(6, 17, 20, 1, woodMid);
    c.rect(7, 28, 3, 1, woodDark);
    c.rect(22, 28, 3, 1, woodDark);
    c.rect(6, 28, 1, 0, woodDark);
    return outline(c.img, p.ink);
  }

  // A chair with its back on the north side (turned for the others).
  function chair() {
    const c = canvas();
    // Seat first, then the back across the north edge.
    c.rect(9, 11, 14, 14, wood);
    c.rect(9, 11, 14, 1, lit);
    c.rect(9, 11, 1, 14, lit);
    c.rect(9, 23, 14, 2, woodMid);
    c.rect(9, 24, 14, 1, woodDark);
    for (const [x, y] of [
      [10, 13],
      [13, 16],
    ])
      c.put(x, y, p['leaf litter dark']);
    c.rect(11, 18, 10, 1, woodMid);
    c.rect(8, 6, 16, 5, woodMid);
    c.rect(8, 6, 16, 1, lit);
    c.rect(8, 10, 16, 1, woodDark);
    c.rect(11, 7, 2, 3, wood);
    c.rect(19, 7, 2, 3, wood);
    return outline(c.img, p.ink);
  }

  function chest() {
    const c = canvas();
    // Lid (lit top) over the body (front face).
    c.rect(5, 8, 22, 10, wood);
    c.rect(5, 8, 22, 1, lit);
    c.rect(5, 8, 1, 10, lit);
    c.rect(5, 18, 22, 8, woodMid);
    c.rect(5, 25, 22, 1, woodDark);
    c.rect(5, 17, 22, 1, woodDark);
    // Iron bands over lid and body, and a lock plate.
    for (const x of [8, 22]) {
      c.rect(x, 8, 3, 18, p['ui iron']);
      c.rect(x, 8, 1, 17, p['ui iron light']);
      c.rect(x + 2, 9, 1, 17, p['ui iron dark']);
    }
    c.rect(14, 16, 4, 5, p['ui iron light']);
    c.rect(14, 16, 4, 1, p.silver);
    c.rect(15, 18, 2, 2, p['ui iron dark']);
    c.put(15, 18, p.gold);
    return outline(c.img, p.ink);
  }

  // A narrow shelf against the north wall: a plank band with three pots.
  function shelf() {
    const c = canvas();
    c.rect(2, 1, 28, 10, wood);
    c.rect(2, 1, 28, 1, lit);
    c.rect(2, 1, 1, 10, lit);
    c.rect(2, 10, 28, 1, woodDark);
    c.rect(3, 9, 26, 1, woodMid);
    // Pots: a clay jar, a straw crock and a dark bottle, lit from the top left.
    c.disc(8, 5.5, 3.2, p.sandstone);
    c.disc(7.5, 5, 2, p['sandstone light']);
    c.disc(8.5, 6, 1, p['sandstone dark']);
    c.disc(16, 5.5, 3.6, p['sand dark']);
    c.disc(15.5, 5, 2.4, p['sand light']);
    c.disc(16, 5.5, 1.4, p['dirt dark']);
    c.disc(24, 5.5, 2.8, p['slate dark']);
    c.disc(23.5, 5, 1.6, p['slate light']);
    c.disc(24, 5.5, 0.9, p['slate line']);
    return outline(c.img, p.ink);
  }

  const bedV = bed();
  const frames = {
    'furn.bench': bench(),
    'furn.bed.v': bedV,
    'furn.bed.h': transpose(bedV),
    'furn.table': table(),
    'furn.chest': chest(),
  };
  const chairN = chair();
  const shelfN = shelf();
  ['n', 'e', 's', 'w'].forEach((side, i) => {
    frames[`furn.chair.${side}`] = turn(chairN, i);
    frames[`furn.shelf.${side}`] = turn(shelfN, i);
  });
  return frames;
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  const frames = drawFurniture();
  for (const [name, img] of Object.entries(frames))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log(`furniture: drew ${Object.keys(frames).length} frames into ${out}`);
}

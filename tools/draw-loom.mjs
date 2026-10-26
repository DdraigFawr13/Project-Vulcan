// Draws the 5B Bundle 5 loom and tan pit (docs/ART.md) into art/src/buildings/: `furn.loom`, an
// upright warp-weighted loom standing against a wall (two posts, a top beam, pale warp threads, a
// band of woven cloth, a shuttle on the floor), and `furn.pits`, one square tan pit of brown
// liquor in a timber edge with bark floating on it (the station is drawn as one of these on each
// of its pits). One tile each, colours only from art/palette.gpl, a 1 px ink outline, lit from the
// top left like the bench.
// Usage: node tools/draw-loom.mjs, then node tools/pack-sheet.mjs buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';
import { canvas, outline } from './draw-furniture.mjs';

export function loomBuildings(p = readPalette()) {
  const wood = p['ui oak light'];
  const mid = p['ui oak'];
  const dark = p['ui oak grain'];

  const loom = canvas();
  // Posts and beams.
  for (const x of [4, 24]) {
    loom.rect(x, 2, 4, 27, mid);
    loom.rect(x, 2, 1, 27, wood);
    loom.rect(x + 3, 2, 1, 27, dark);
  }
  loom.rect(4, 2, 24, 4, mid);
  loom.rect(4, 2, 24, 1, wood);
  loom.rect(4, 5, 24, 1, dark);
  loom.rect(4, 24, 24, 3, mid);
  loom.rect(4, 24, 24, 1, wood);
  loom.rect(4, 26, 24, 1, dark);
  // Warp threads hang from the top beam; the lower part is woven cloth in two stripes.
  for (let x = 9; x < 23; x += 2) loom.rect(x, 6, 1, 18, p['sand light']);
  loom.rect(8, 15, 16, 9, p['sand dark']);
  loom.rect(8, 15, 16, 2, p.sandstone);
  loom.rect(8, 21, 16, 2, p.sandstone);
  for (let y = 15; y < 24; y += 2) for (let x = 8; x < 24; x += 3) loom.put(x, y, p['sand light']);
  // The heddle bar across the threads, and the weights hanging below the cloth.
  loom.rect(7, 11, 18, 2, wood);
  loom.rect(7, 12, 18, 1, dark);
  for (const x of [10, 14, 18, 22]) loom.rect(x, 27, 2, 2, p['rock light']);
  // A shuttle on the floor.
  loom.rect(11, 29, 9, 2, p['straw dark']);
  loom.rect(12, 29, 7, 1, p['straw light']);

  const pit = canvas();
  // Timber edge: planks round a square, lit on the top and left.
  pit.rect(1, 1, 30, 30, mid);
  pit.rect(1, 1, 30, 2, wood);
  pit.rect(1, 1, 2, 30, wood);
  pit.rect(1, 29, 30, 2, dark);
  pit.rect(29, 1, 2, 30, dark);
  // The liquor: brown, darker towards the shaded side, with a few lit ripples.
  pit.rect(5, 5, 22, 22, p['leaf litter dark']);
  pit.rect(5, 5, 22, 3, p['dirt dark']);
  pit.rect(5, 5, 3, 22, p['dirt dark']);
  for (let y = 8; y < 27; y++)
    for (let x = 8; x < 27; x++) {
      const n = noise(31, x, y);
      if (n > 0.9) pit.put(x, y, p['leaf litter light']);
      else if (n < 0.1) pit.put(x, y, p.dirt);
    }
  for (const [x, y] of [
    [10, 11],
    [17, 18],
    [21, 12],
  ])
    pit.rect(x, y, 3, 1, p['leaf litter']);
  // Bark floating on it.
  for (const [x, y, w] of [
    [9, 20, 5],
    [18, 9, 4],
    [20, 22, 4],
  ]) {
    pit.rect(x, y, w, 2, p['needle dark']);
    pit.rect(x, y, w, 1, p.needle);
  }
  // Nail heads on the edge.
  for (const [x, y] of [
    [3, 3],
    [27, 3],
    [3, 27],
    [27, 27],
  ])
    pit.put(x, y, p['ui iron light']);

  return { 'furn.loom': outline(loom.img, p.ink), 'furn.pits': outline(pit.img, p.ink) };
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  for (const [name, img] of Object.entries(loomBuildings()))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log('loom: drew furn.loom and furn.pits');
}

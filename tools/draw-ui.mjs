// Draws the P2.8 `ui` sheet (docs/ART.md, docs/UI_STYLE.md): the oak plank bar, the iron button
// plate in its normal and ember "on" states, the oak page frame with iron corners and the paper
// texture. Each piece is its own small PNG because CSS uses them as 9-slice borders and tiled
// backgrounds; art/src/ui/ is the source and public/art/ui/ the copy the page loads. Drawn at
// 1 art px to 2 CSS px from art/palette.gpl's `ui` entries. Deterministic.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';

function canvas(width, height) {
  const image = createImage(width, height);
  const put = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    image.data.set([r, g, b, a], (y * width + x) * 4);
  };
  const rect = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c);
  };
  return { image, put, rect };
}

/** A 16 px riveted plate: dark outline, light top-left edge, shadow bottom-right, four rivets. */
function plate(p, face, light, shade) {
  const s = canvas(16, 16);
  s.rect(0, 0, 16, 16, p['ui oak dark']);
  s.rect(1, 1, 14, 14, face);
  s.rect(1, 1, 14, 1, light);
  s.rect(1, 1, 1, 14, light);
  s.rect(1, 14, 14, 1, shade);
  s.rect(14, 1, 1, 14, shade);
  for (const [x, y] of [
    [3, 3],
    [12, 3],
    [3, 12],
    [12, 12],
  ]) {
    s.put(x, y, light);
    s.put(x + 1, y + 1, shade);
  }
  return s.image;
}

export function drawUi(p = readPalette()) {
  const frames = {};

  // Two planks across a 24 px strip, seamless left to right, with grain and a dark lower edge.
  const plank = canvas(32, 24);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 32; x++) {
      const row = y % 11;
      let c = p['ui oak'];
      if (noise(41, x >> 2, y) > 0.72) c = p['ui oak grain'];
      if (noise(42, x, y) > 0.94) c = p['ui oak light'];
      if (row === 0) c = p['ui oak light'];
      if (row === 10) c = p['ui oak grain'];
      plank.put(x, y, c);
    }
  plank.rect(0, 22, 32, 2, p['ui oak dark']);
  // A nail head on each plank so the strip reads as boards, not a gradient.
  plank.put(6, 5, p['ui iron light']);
  plank.put(22, 16, p['ui iron light']);
  frames['ui.plank'] = plank.image;

  frames['ui.iron'] = plate(p, p['ui iron'], p['ui iron light'], p['ui iron dark']);
  frames['ui.iron.on'] = plate(p, p['ui ember'], p['ui ember light'], p['ui ember dark']);

  // The page frame: outline, two px of oak, a dark inner line, iron brackets at the corners. The
  // middle stays clear; the paper texture fills it.
  const frame = canvas(16, 16);
  frame.rect(0, 0, 16, 16, p['ui oak dark']);
  frame.rect(1, 1, 14, 14, p['ui oak']);
  frame.rect(1, 1, 14, 1, p['ui oak light']);
  frame.rect(3, 3, 10, 10, p['ui oak dark']);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) frame.put(x, y, [0, 0, 0], 0);
  for (const [x, y] of [
    [0, 0],
    [12, 0],
    [0, 12],
    [12, 12],
  ]) {
    frame.rect(x, y, 4, 4, p['ui iron']);
    frame.put(x + 1, y + 1, p['ui iron light']);
    frame.put(x + 2, y + 2, p['ui iron dark']);
  }
  frames['ui.oak-frame'] = frame.image;

  // Paper: the page colour with soft flecks and a few fibres, seamless on a 32 px tile.
  const paper = canvas(32, 32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const n = noise(43, x, y);
      paper.put(x, y, n > 0.9 ? p['ui page dark'] : n < 0.08 ? p['ui page light'] : p['ui page']);
    }
  for (let k = 0; k < 5; k++) {
    const x = Math.floor(noise(44, k, 1) * 32);
    const y = Math.floor(noise(44, k, 2) * 32);
    for (let i = 0; i < 4; i++) paper.put((x + i) % 32, (y + (i >> 1)) % 32, p['ui page dark']);
  }
  frames['ui.paper'] = paper.image;
  return frames;
}

if (isMain(import.meta.url)) {
  const frames = drawUi();
  for (const dir of ['art/src/ui', 'public/art/ui']) {
    mkdirSync(path.join(root, dir), { recursive: true });
    for (const [name, image] of Object.entries(frames))
      writeFileSync(path.join(root, dir, `${name.slice(3)}.png`), encodePng(image));
  }
  console.log(`ui: ${Object.keys(frames).length} pieces in art/src/ui and public/art/ui`);
}

// Packs art/src/<sheet>/*.png into public/art/<sheet>.png and <sheet>.json (docs/ART.md).
// Frames of one size go on a grid in name order, each extruded by one pixel so tiles never show
// seams when the camera zooms; the JSON is a Phaser atlas (JSON hash) plus the grid for tilesets.
// Usage: node tools/pack-sheet.mjs <sheet> [<sheet> ...]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, decodePng, encodePng } from './png.mjs';

const MARGIN = 1;
const SPACING = 2;

export function packSheet(frames) {
  const names = Object.keys(frames).sort();
  if (names.length === 0) throw new Error('no frames to pack');
  const { width: size, height } = frames[names[0]];
  for (const name of names)
    if (frames[name].width !== size || frames[name].height !== height)
      throw new Error(
        `${name}: ${frames[name].width}x${frames[name].height}, expected ${size}x${height}`,
      );
  const columns = Math.ceil(Math.sqrt(names.length));
  const rows = Math.ceil(names.length / columns);
  const sheet = createImage(
    2 * MARGIN + columns * size + (columns - 1) * SPACING,
    2 * MARGIN + rows * height + (rows - 1) * SPACING,
  );
  const atlas = {};
  names.forEach((name, i) => {
    const x = MARGIN + (i % columns) * (size + SPACING);
    const y = MARGIN + Math.floor(i / columns) * (height + SPACING);
    const src = frames[name];
    // Copy with a one-pixel border repeated from the frame's own edge.
    for (let dy = -1; dy <= height; dy++)
      for (let dx = -1; dx <= size; dx++) {
        const sx = Math.min(Math.max(dx, 0), size - 1);
        const sy = Math.min(Math.max(dy, 0), height - 1);
        const from = (sy * size + sx) * 4;
        sheet.data.set(src.data.subarray(from, from + 4), ((y + dy) * sheet.width + x + dx) * 4);
      }
    atlas[name] = {
      frame: { x, y, w: size, h: height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: size, h: height },
      sourceSize: { w: size, h: height },
    };
  });
  return {
    image: sheet,
    json: {
      frames: atlas,
      grid: { tile: size, margin: MARGIN, spacing: SPACING, columns, order: names },
      meta: { size: { w: sheet.width, h: sheet.height }, scale: '1' },
    },
  };
}

if (isMain(import.meta.url)) {
  const sheets = process.argv.slice(2);
  if (sheets.length === 0)
    throw new Error('usage: node tools/pack-sheet.mjs <sheet> [<sheet> ...]');
  const out = path.join(root, 'public/art');
  mkdirSync(out, { recursive: true });
  for (const sheet of sheets) {
    const dir = path.join(root, 'art/src', sheet);
    const frames = {};
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.png')))
      frames[file.slice(0, -4)] = decodePng(readFileSync(path.join(dir, file)));
    const { image, json } = packSheet(frames);
    json.meta.image = `${sheet}.png`;
    writeFileSync(path.join(out, `${sheet}.png`), encodePng(image));
    writeFileSync(path.join(out, `${sheet}.json`), `${JSON.stringify(json, null, 2)}\n`);
    console.log(`${sheet}: ${Object.keys(frames).length} frames, ${image.width}x${image.height}`);
  }
}

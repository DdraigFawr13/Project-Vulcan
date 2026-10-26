// Draws the P4.7 field frames into art/src/buildings/ (docs/ART.md): ploughed furrows, one opaque
// 32 px tile each, colours only from art/palette.gpl. The furrows run north to south at a period of
// 8 px and the sprout and stalk marks repeat every 8 px down, so neighbouring tiles join into one
// stretch of furrows with no edge between them (the taste board's pick: furrows shaped to the good
// soil, no edge). States: `field.plan` (turned soil), `field.sown` (green sprouts), `field.ripe.barley`
// (golden stalks), `field.ripe.turnips` (leafy tops over pale crowns), `field.fallow` (stubble and
// dry soil); 5B Bundle 2: `field.ripe.oats`, `.beans`, `.cabbages` and `field.blight` (browned
// dead stalks). Seeded and deterministic.
// Usage: node tools/draw-fields.mjs, then node tools/pack-sheet.mjs buildings
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';
import { canvas } from './draw-furniture.mjs';

const PERIOD = 8;

export function drawFields(p = readPalette()) {
  // Furrow columns by x % 8: trough, shadowed slope, ridge, lit slope; the soil under a crop.
  const soil = (x, dry) => {
    const k = x % PERIOD;
    if (k === 0 || k === 7) return dry ? p['leaf litter dark'] : p['dirt dark'];
    if (k === 1 || k === 6) return dry ? p['leaf litter'] : p.dirt;
    return k === 3 || k === 4 ? (dry ? p['leaf litter light'] : p['dirt light']) : p.dirt;
  };
  const frame = (dry, marks) => {
    const c = canvas();
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) c.put(x, y, soil(x, dry));
    // Marks sit on the ridges (x % 8 from 2 to 5) in a pattern that repeats every 8 px down.
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const k = x % PERIOD;
        if (k < 2 || k > 5) continue;
        const colour = marks(k, y % PERIOD, noise(7, x, y % PERIOD));
        if (colour) c.put(x, y, colour);
      }
    return c.img;
  };
  const crest = (k) => k === 3 || k === 4;
  return {
    'field.plan': frame(false, (k, y, n) => (n > 0.86 ? p['dirt light'] : undefined)),
    'field.sown': frame(false, (k, y, n) => {
      if (!crest(k) && n < 0.8) return undefined;
      if (!crest(k)) return p['grass dark'];
      return [p['grass light'], p['grass tip'], p.grass, p['grass dark']][y % 4];
    }),
    'field.ripe.barley': frame(false, (k, y, n) => {
      if (crest(k))
        return y % 4 === 0 ? p['straw blade'] : y % 4 === 3 ? p['straw dark'] : p['straw light'];
      return n > 0.45 ? p.straw : undefined;
    }),
    'field.ripe.turnips': frame(false, (k, y, n) => {
      if (crest(k) && y % 4 < 2) return k === 3 ? p['birch leaf light'] : p['birch leaf'];
      if (crest(k) && y % 4 === 2) return p['gem purple light'];
      return n > 0.7 ? p['grass light'] : undefined;
    }),
    // 5B Bundle 2 (the taste board's looks): oats hang pale nodding heads, beans stand dark and
    // leafy with pale pods, cabbages sit as round blue-green heads every other ridge.
    'field.ripe.oats': frame(false, (k, y, n) => {
      if (crest(k)) return y % 4 === 1 ? p['sand light'] : y % 4 === 3 ? p['straw dark'] : p.straw;
      return n > 0.55 && y % 2 ? p['sand light'] : undefined;
    }),
    'field.ripe.beans': frame(false, (k, y, n) => {
      if (crest(k)) return y % 4 === 2 ? p['grass light'] : y % 4 === 0 ? p['pine dark'] : p.pine;
      return n > 0.5 ? p['grass dark'] : undefined;
    }),
    'field.ripe.cabbages': frame(false, (k, y, n) => {
      if (y % 8 < 2 || y % 8 > 6) return n > 0.8 ? p['grass dark'] : undefined;
      if (crest(k)) return y % 8 === 4 ? p['willow light'] : p.willow;
      return p['willow dark'];
    }),
    // Blight: the crop browned and dead on its ridges.
    'field.blight': frame(false, (k, y, n) => {
      if (crest(k))
        return y % 4 === 0 ? p['leaf litter dark'] : n > 0.5 ? p['leaf litter'] : p['dirt dark'];
      return n > 0.6 ? p['leaf litter light'] : undefined;
    }),
    'field.fallow': frame(true, (k, y, n) =>
      crest(k) && y % 4 === 1 && n > 0.3 ? p['straw dark'] : undefined,
    ),
  };
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  const frames = drawFields();
  for (const [name, image] of Object.entries(frames))
    writeFileSync(path.join(out, `${name}.png`), encodePng(image));
  console.log(`fields: drew ${Object.keys(frames).length} frames into ${out}`);
}

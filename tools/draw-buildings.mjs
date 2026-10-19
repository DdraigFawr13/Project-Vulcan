// Draws the P3.1 `buildings` placeholder sheet into art/src/buildings/ (docs/ART.md): the parts
// colonists build, using only colours from art/palette.gpl. Slim walls (the taste board's pick)
// are a band a third of a tile wide through the middle of their tile, one frame for each set of
// the four sides it joins a neighbour on (`.<mask>`: north 1, east 2, south 4, west 8); the rest
// of the tile shows what lies under it, and the renderer lays a half floor (`.half.<side>`) on
// the side of a wall that meets a floor (a quarter, `.q.<corner>`, in an inner corner), so a wall
// works over every floor and ground. Doors are a narrow leaf drawn over the wall they stand in,
// in a run east-west (`.h`) or north-south (`.v`); stairs are the plan's ghost only (a cut stair
// is a tile kind). Seeded and deterministic.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';

const S = 32;
// The band: 11 px wide, from 11 to 21 (about a third of the tile).
const B0 = 11;
const B1 = 21;

function image(draw) {
  const img = createImage(S, S);
  const put = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    img.data.set([...rgb, 255], (y * S + x) * 4);
  };
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };
  draw({ put, rect });
  return img;
}

const has = (img, x, y) => x >= 0 && y >= 0 && x < S && y < S && img.data[(y * S + x) * 4 + 3] > 0;

// Ink on every transparent pixel beside an opaque one, so a part reads on any ground.
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

// The rectangles a band joining `mask`'s sides covers: the middle and an arm to each side.
function bandRects(mask) {
  const w = B1 - B0 + 1;
  const rects = [[B0, B0, w, w]];
  if (mask & 1) rects.push([B0, 0, w, B0]);
  if (mask & 2) rects.push([B1 + 1, B0, S - B1 - 1, w]);
  if (mask & 4) rects.push([B0, B1 + 1, w, S - B1 - 1]);
  if (mask & 8) rects.push([0, B0, B0, w]);
  return rects;
}
const inBand = (rects, x, y) =>
  rects.some(([x0, y0, w, h]) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h);

// Stone: coursed blocks with mortar joints, lit from the top left.
function stoneAt(p, x, y) {
  const row = Math.floor(y / 4);
  const off = row % 2 ? 3 : 0;
  if (y % 4 === 3 || (x + off) % 6 === 5) return p['limestone joint'];
  const n = noise(11, Math.floor((x + off) / 6), row);
  return n < 0.3 ? p['rock'] : n < 0.75 ? p['rock light'] : p['rock edge'];
}
// Wood: planks along the band, with grain.
function woodAt(p, x, y, across) {
  const u = across ? x : y;
  const v = across ? y : x;
  if (u % 4 === 3) return p['dirt dark'];
  const n = noise(12, Math.floor(u / 4), Math.floor(v / 9));
  if (noise(13, u, v) > 0.9) return p['leaf litter dark'];
  return n < 0.4 ? p.trunk : n < 0.8 ? p['leaf litter'] : p['leaf litter light'];
}

function wall(p, material, mask) {
  const rects = bandRects(mask);
  // Planks run along the longer run: across when it joins east or west only.
  const across = !(mask & 5) && !!(mask & 10);
  const img = image(({ put }) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!inBand(rects, x, y)) continue;
        put(x, y, material === 'stone' ? stoneAt(p, x, y) : woodAt(p, x, y, !across));
      }
  });
  // A light top edge and a dark bottom edge give the band some height.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!has(img, x, y)) continue;
      if (!has(img, x, y - 1) && y > 0)
        img.data.set(
          [...p[material === 'stone' ? 'limestone light' : 'straw'], 255],
          (y * S + x) * 4,
        );
      else if (!has(img, x, y + 1) && y < S - 1)
        img.data.set(
          [...p[material === 'stone' ? 'rock dark' : 'dirt dark'], 255],
          (y * S + x) * 4,
        );
    }
  return outline(img, p.ink);
}

function floor(p, material) {
  return image(({ put }) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (material === 'stone') {
          // Flagstones: four slabs a tile, joints in dark floor.
          const joint = x % 16 === 15 || y % 16 === 15 || x === 0 || y === 0;
          const n = noise(21, Math.floor(x / 16), Math.floor(y / 16));
          const fleck = noise(22, x, y) > 0.92;
          put(
            x,
            y,
            joint
              ? p['floor dark']
              : fleck
                ? p['floor dark']
                : n < 0.5
                  ? p.floor
                  : p['floor light'],
          );
        } else {
          // Boards running east-west, ends staggered.
          const row = Math.floor(y / 6);
          const end = (x + row * 11) % 32 === 0;
          const n = noise(23, row, Math.floor((x + row * 11) / 32));
          const grain = noise(24, x, y) > 0.88;
          put(
            x,
            y,
            y % 6 === 5 || end
              ? p['dirt dark']
              : grain
                ? p.dirt
                : n < 0.5
                  ? p['dirt light']
                  : p['leaf litter light'],
          );
        }
      }
  });
}

// The half of a floor towards one side, for under the open side of a wall.
function half(full, side) {
  const img = createImage(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const keep =
        side === 'n'
          ? y < S / 2
          : side === 's'
            ? y >= S / 2
            : side === 'w'
              ? x < S / 2
              : x >= S / 2;
      if (keep)
        img.data.set(full.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4), (y * S + x) * 4);
    }
  return img;
}

// The quarter of a floor in one corner, for the inner corner of a wall that turns round a floor.
function quarter(full, corner) {
  const img = createImage(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const north = y < S / 2;
      const west = x < S / 2;
      const keep = corner === (north ? 'n' : 's') + (west ? 'w' : 'e');
      if (keep)
        img.data.set(full.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4), (y * S + x) * 4);
    }
  return img;
}

// A door in a run east-west (`h`) or north-south (`v`): a narrow leaf about a third of a tile
// wide in the middle of the band, between dark jambs; the rest of the tile is clear, and the
// renderer lays the wall it stands in under it, so the door reads as one block in the wall
// (Morgan's pick, 2026-10-19). Wood is an oak leaf with a latch; stone an open sill of flags.
const LEAF0 = 10;
const LEAF1 = 21;
function door(p, material, run) {
  const h = run === 'h';
  const rects = bandRects(h ? 10 : 5);
  const img = image(({ put }) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!inBand(rects, x, y)) continue;
        const along = h ? x : y;
        const across = (h ? y : x) - B0;
        if (along < LEAF0 || along > LEAF1) continue;
        if (along === LEAF0 || along === LEAF1) {
          put(x, y, p['ui oak dark']);
          continue;
        }
        if (material === 'stone') {
          put(x, y, noise(32, along, across) < 0.5 ? p.floor : p['floor light']);
          continue;
        }
        put(x, y, noise(33, along, across) > 0.88 ? p['ui oak'] : p['ui oak light']);
      }
    if (material === 'wood') {
      // The latch, beside the middle of the leaf.
      const [lx, ly] = h ? [LEAF1 - 2, B0 + 5] : [B0 + 5, LEAF1 - 2];
      put(lx, ly, p['ui iron light']);
    }
  });
  // Lit along the top, shaded along the bottom, like a wall.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!has(img, x, y)) continue;
      if (!has(img, x, y - 1) && y > 0)
        img.data.set(
          [...p[material === 'stone' ? 'limestone light' : 'dirt light'], 255],
          (y * S + x) * 4,
        );
      else if (!has(img, x, y + 1) && y < S - 1)
        img.data.set(
          [...p[material === 'stone' ? 'rock dark' : 'ui oak dark'], 255],
          (y * S + x) * 4,
        );
    }
  return outline(img, p.ink);
}

// A plan's ghost of a stair down: steps dropping into the dark.
function stair(p, material) {
  const img = image(({ rect }) => {
    rect(4, 4, 24, 24, p.darkness);
    for (let k = 0; k < 4; k++) {
      const c =
        material === 'stone'
          ? [p['rock light'], p.rock, p['rock dark'], p['slate dark']][k]
          : [p['leaf litter light'], p.trunk, p['dirt dark'], p['leaf litter dark']][k];
      rect(4, 4 + k * 6, 24 - k * 4, 5, c);
    }
  });
  return outline(img, p.ink);
}

export function drawBuildings(p = readPalette()) {
  const frames = {};
  for (const m of ['stone', 'wood']) {
    for (let mask = 0; mask < 16; mask++) frames[`build.wall-${m}.${mask}`] = wall(p, m, mask);
    const full = floor(p, m);
    frames[`build.floor-${m}`] = full;
    for (const side of ['n', 'e', 's', 'w'])
      frames[`build.floor-${m}.half.${side}`] = half(full, side);
    for (const corner of ['ne', 'se', 'sw', 'nw'])
      frames[`build.floor-${m}.q.${corner}`] = quarter(full, corner);
    for (const run of ['h', 'v']) frames[`build.door-${m}.${run}`] = door(p, m, run);
    frames[`build.stair-${m}`] = stair(p, m);
  }
  return frames;
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/buildings');
  mkdirSync(out, { recursive: true });
  const frames = drawBuildings();
  for (const [name, img] of Object.entries(frames))
    writeFileSync(path.join(out, `${name}.png`), encodePng(img));
  console.log(`buildings: drew ${Object.keys(frames).length} frames into ${out}`);
}

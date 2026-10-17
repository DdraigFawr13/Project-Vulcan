// Draws the P0.4 `tiles-base` placeholder sheet into art/src/tiles-base/ (docs/ART.md), using only
// the colours in art/palette.gpl. Seeded, so a re-run gives identical files. Morgan's art pass
// replaces these PNGs with files of the same names and sizes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';

const TILE = 32;

export function readPalette(file = path.join(root, 'art/palette.gpl')) {
  const colours = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line);
    if (match) colours[match[4].trim()] = [+match[1], +match[2], +match[3]];
  }
  return colours;
}

// A small integer hash: the same tile, seed and position always give the same value in [0, 1).
function noise(seed, x, y) {
  let h =
    Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(x, 0x27d4eb2f) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// Smooth value noise on a grid of `cell` pixels that wraps at the tile edge, so tiles repeat seamlessly.
function blobs(seed, x, y, cell) {
  const n = TILE / cell;
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

function tile(draw) {
  const image = createImage(TILE, TILE);
  const set = (x, y, rgb, alpha = 255) => {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    image.data.set([...rgb, alpha], (y * TILE + x) * 4);
  };
  draw(set);
  return image;
}

// Three shades by smooth noise, then a sprinkle of single-pixel specks.
const ground = (p, seed, [dark, mid, light], speck, cell = 8) =>
  tile((set) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const v = blobs(seed, x, y, cell) + (noise(seed + 7, x, y) - 0.5) * 0.25;
        set(x, y, p[v < 0.38 ? dark : v > 0.66 ? light : mid]);
        if (speck && noise(seed + 3, x, y) < speck.rate) set(x, y, p[speck.colour]);
      }
  });

function grass(p, seed) {
  const base = ground(p, seed, ['grass dark', 'grass', 'grass light'], null);
  return tile((set) => {
    for (let i = 0; i < TILE * TILE; i++)
      set(i % TILE, i >> 5, base.data.subarray(i * 4, i * 4 + 3));
    // Short blades: a lit tip over a dark root.
    for (let k = 0; k < 14; k++) {
      const x = Math.floor(noise(seed, k, 101) * TILE);
      const y = Math.floor(noise(seed, k, 202) * (TILE - 2)) + 1;
      set(x, y - 1, p['grass tip']);
      set(x, y, p['grass light']);
      set(x, y + 1, p['grass dark']);
    }
  });
}

function gravel(p, seed) {
  return tile((set) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, p['dirt dark']);
    for (let k = 0; k < 70; k++) {
      const x = Math.floor(noise(seed, k, 1) * TILE);
      const y = Math.floor(noise(seed, k, 2) * TILE);
      const shade = ['gravel dark', 'gravel', 'gravel light'][Math.floor(noise(seed, k, 3) * 3)];
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        set((x + dx) % TILE, (y + dy) % TILE, p[shade]);
      set((x + 1) % TILE, (y + 2) % TILE, p['gravel dark']);
    }
  });
}

function stoneFloor(p, seed) {
  return tile((set) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const slab = (x >> 4) + 2 * (y >> 4);
        const v = noise(seed, slab, 0) + (noise(seed + 1, x, y) - 0.5) * 0.3;
        const mortar = x % 16 === 15 || y % 16 === 15;
        const lit = x % 16 === 0 || y % 16 === 0;
        set(
          x,
          y,
          p[mortar ? 'gravel dark' : lit ? 'floor light' : v < 0.4 ? 'floor dark' : 'floor'],
        );
      }
  });
}

function rockWall(p, seed) {
  const base = ground(
    p,
    seed,
    ['rock dark', 'rock', 'rock light'],
    { rate: 0.03, colour: 'ink' },
    4,
  );
  return tile((set) => {
    for (let i = 0; i < TILE * TILE; i++)
      set(i % TILE, i >> 5, base.data.subarray(i * 4, i * 4 + 3));
    for (let x = 0; x < TILE; x++) {
      set(x, 0, p['rock edge']);
      set(x, 1, p['rock edge']);
      set(x, TILE - 1, p.ink);
    }
  });
}

function water(p, seed, [base, light], waves) {
  return tile((set) => {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) set(x, y, p[base]);
    for (let k = 0; k < waves; k++) {
      const x = Math.floor(noise(seed, k, 5) * TILE);
      const y = Math.floor(noise(seed, k, 6) * TILE);
      for (let dx = 0; dx < 4; dx++) set((x + dx) % TILE, y, p[light]);
    }
  });
}

const overlaySelect = (p) =>
  tile((set) => {
    for (const [cx, cy] of [
      [0, 0],
      [TILE - 1, 0],
      [0, TILE - 1],
      [TILE - 1, TILE - 1],
    ])
      for (let i = 0; i < 7; i++)
        for (let w = 0; w < 2; w++) {
          const sx = cx === 0 ? 1 : -1;
          const sy = cy === 0 ? 1 : -1;
          set(cx + sx * i, cy + sy * w, p.bone);
          set(cx + sx * w, cy + sy * i, p.bone);
        }
  });

const overlayDesignate = (p) =>
  tile((set) => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
        if (edge) set(x, y, p.amber, 220);
        else if ((x + y) % 8 < 2) set(x, y, p.amber, 120);
      }
  });

/** Every frame of the sheet by art name (docs/ART.md naming). */
export function drawTilesBase(p = readPalette()) {
  return {
    'tile.grass.1': grass(p, 11),
    'tile.grass.2': grass(p, 12),
    'tile.grass.3': grass(p, 13),
    'tile.dirt.1': ground(p, 21, ['dirt dark', 'dirt', 'dirt light'], {
      rate: 0.03,
      colour: 'sand dark',
    }),
    'tile.sand.1': ground(
      p,
      31,
      ['sand dark', 'sand', 'sand light'],
      { rate: 0.02, colour: 'dirt light' },
      16,
    ),
    'tile.gravel.1': gravel(p, 41),
    'tile.stone-floor.1': stoneFloor(p, 51),
    'tile.rock-wall.1': rockWall(p, 61),
    'tile.darkness.1': ground(p, 71, ['darkness', 'darkness', 'ink'], null),
    'tile.water-shallow.1': water(p, 81, ['shallow water', 'shallow water light'], 9),
    'tile.water-deep.1': water(p, 91, ['deep water', 'deep water light'], 5),
    'overlay.select': overlaySelect(p),
    'overlay.designate': overlayDesignate(p),
  };
}

if (isMain(import.meta.url)) {
  const out = path.join(root, process.argv[2] ?? 'art/src/tiles-base');
  mkdirSync(out, { recursive: true });
  for (const [name, image] of Object.entries(drawTilesBase()))
    writeFileSync(path.join(out, `${name}.png`), encodePng(image));
  console.log(`tiles-base: drew ${Object.keys(drawTilesBase()).length} frames into ${out}`);
}

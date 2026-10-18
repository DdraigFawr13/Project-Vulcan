// Draws the P2.4 `items` placeholder sheet into art/src/items/ (docs/ART.md): item icons as they lie
// on a ground tile, map marks and the handcart, using only colours from art/palette.gpl.
// Seeded and deterministic. Every opaque icon gets a 1 px ink outline so it reads on grass, dirt and snow.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';
import { surface } from './draw-items-surface.mjs';
import { readPalette } from './draw-tiles-base.mjs';
import { noise } from './draw-nature.mjs';

const S = 32;

export function drawItems(p = readPalette()) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };

  // A heap of rock lumps; `flecks` are scattered over the lumps as ore or crystal specks.
  const heap = (base, flecks, seed, extra) => (s) => {
    const [dark, mid, light] = base.map((n) => p[n]);
    s.ell(16, 24, 10, 4, dark);
    s.ell(11, 20, 6, 5, mid, light, dark);
    s.ell(21, 21, 6, 5, mid, light, dark);
    s.ell(16, 15, 6, 5, mid, light, dark);
    for (let k = 0; k < 14; k++) {
      const x = 7 + Math.floor(noise(seed, k, 1) * 18);
      const y = 11 + Math.floor(noise(seed, k, 2) * 14);
      const c = p[flecks[k % flecks.length]];
      const here = s.image.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4);
      if (here[3] > 0) {
        s.put(x, y, c);
        if (k % 3 === 0) s.put(x + 1, y, c);
      }
    }
    extra?.(s);
  };
  const rocks = ['rock dark', 'rock', 'rock light'];

  icon('item.logs', (s) => {
    const log = (cx, cy) => {
      s.rect(cx - 9, cy - 3, 18, 6, p.trunk);
      s.rect(cx - 9, cy + 2, 18, 1, p['dirt dark']);
      s.rect(cx - 8, cy - 3, 16, 1, p['dirt light']);
      s.ell(cx - 9, cy, 3, 3, p['leaf litter light']);
      s.put(cx - 9, cy, p['leaf litter']);
      s.put(cx - 8, cy, p['leaf litter']);
      s.rect(cx + 3, cy - 1, 3, 1, p['dirt dark']);
    };
    log(13, 25);
    log(19, 20);
    log(13, 15);
  });
  icon('item.stone', heap(rocks, ['rock edge', 'rock dark'], 1));
  icon(
    'item.ore',
    heap(['rock dark', 'rock', 'rock light'], ['gravel light', 'bone', 'gravel'], 2),
  );
  icon('item.copper-ore', heap(rocks, ['malachite', 'sandstone light', 'sandstone'], 3));
  icon('item.tin-ore', heap(rocks, ['slate light', 'slate', 'bone'], 4));
  icon(
    'item.iron-ore',
    heap(['rock dark', 'rock', 'rock light'], ['sandstone dark', 'sandstone band', 'dirt'], 5),
  );
  icon(
    'item.sulphur',
    heap(['sand dark', 'sulphur', 'straw blade'], ['sulphur', 'straw light', 'amber'], 6),
  );
  icon('item.gold-ore', heap(rocks, ['gold', 'gold', 'straw light'], 7));
  icon('item.silver-ore', heap(rocks, ['silver', 'silver', 'bone'], 8));
  icon('item.obsidian', (s) => {
    const shard = (x, y, h, w) => {
      for (let i = 0; i < h; i++) {
        const half = Math.round((w * (1 - Math.abs(i - h * 0.6) / h)) / 2);
        for (let dx = -half; dx <= half; dx++)
          s.put(x + dx, y - i, dx < 0 ? p['slate dark'] : p.darkness);
        s.put(x - half, y - i, p['slate light']);
      }
    };
    s.ell(16, 25, 10, 3, p['rock dark']);
    shard(10, 26, 11, 6);
    shard(22, 26, 12, 6);
    shard(16, 27, 14, 8);
    s.put(15, 17, p['slate light']);
    s.put(15, 18, p.silver);
  });
  icon('item.gems', (s) => {
    const gem = (cx, cy, r, mid, lit) => {
      for (let y = -r; y <= r; y++) {
        const half = r - Math.abs(y);
        for (let x = -half; x <= half; x++) s.put(cx + x, cy + y, x + y < -1 ? lit : mid);
      }
      s.put(cx - 1, cy - 1, p.bone);
    };
    s.ell(16, 26, 9, 2, p['rock dark']);
    gem(11, 22, 4, p['gem red'], p['gem purple light']);
    gem(21, 21, 5, p['gem purple'], p['gem purple light']);
    gem(16, 15, 5, p['ice shade'], p['ice light']);
  });
  icon('item.salt', (s) => {
    s.ell(16, 24, 10, 4, p['limestone dark']);
    s.ell(11, 20, 5, 4, p.limestone, p['limestone light'], p['limestone dark']);
    s.ell(21, 20, 6, 5, p.limestone, p.bone, p['limestone dark']);
    s.ell(16, 15, 5, 4, p['limestone light'], p.bone, p.limestone);
    for (const [x, y] of [
      [9, 19],
      [20, 18],
      [15, 14],
      [23, 22],
    ])
      s.put(x, y, p['snow light']);
    for (const [x, y] of [
      [13, 22],
      [18, 21],
    ])
      s.put(x, y, p['limestone joint']);
  });
  icon('item.ingot', (s) => {
    const bar = (x, y) => {
      for (let i = 0; i < 5; i++)
        s.rect(
          x + (i < 1 ? 1 : 0) - (i > 3 ? 0 : 0) + (i === 0 ? 0 : -1),
          y + i,
          14 + (i === 0 ? -2 : 0) + (i === 0 ? 0 : 2),
          1,
          p[i === 0 ? 'floor light' : i < 4 ? 'gravel light' : 'gravel dark'],
        );
      s.rect(x + 2, y + 1, 8, 1, p.bone);
    };
    bar(3, 22);
    bar(15, 22);
    bar(9, 16);
    bar(9, 10);
  });
  icon('item.preserved', (s) => {
    // A sack and two wrapped bundles.
    s.ell(12, 20, 7, 7, p['straw dark'], p.straw, p['dirt light']);
    s.ell(12, 20, 6, 6, p.straw, p['straw light'], p['straw dark']);
    s.rect(10, 11, 5, 3, p['straw dark']);
    s.rect(9, 13, 7, 1, p['dirt dark']);
    s.line(9, 14, 15, 14, p['dirt dark']);
    s.put(11, 10, p.straw);
    s.put(14, 10, p.straw);
    for (const [x, y, w] of [
      [19, 20, 9],
      [20, 13, 8],
    ]) {
      s.rect(x, y, w, 6, p.limestone);
      s.rect(x, y, w, 1, p['limestone light']);
      s.rect(x, y + 5, w, 1, p['limestone dark']);
      s.rect(x + 3, y, 1, 6, p['dirt dark']);
      s.rect(x + w - 3, y, 1, 6, p['dirt dark']);
    }
  });
  icon('item.grain', (s) => {
    s.ell(16, 24, 11, 4, p['straw dark']);
    s.ell(16, 20, 9, 5, p.straw, p['straw light'], p['straw dark']);
    for (let k = 0; k < 16; k++) {
      const x = 8 + Math.floor(noise(11, k, 1) * 16);
      const y = 16 + Math.floor(noise(11, k, 2) * 8);
      s.put(x, y, p[k % 2 ? 'straw blade' : 'straw dark']);
    }
    for (const x of [11, 15, 19, 23]) {
      s.line(x - 2, 17, x + 1, 8 + (x % 3), p['straw dark']);
      s.ell(x + 1, 8 + (x % 3), 1.2, 2, p['straw light']);
    }
  });
  icon('item.berries', (s) => {
    s.ell(16, 25, 10, 3, p['dirt dark']);
    s.ell(16, 21, 9, 5, p['oak dark'], p.oak, p['pine dark']);
    for (const [x, y] of [
      [10, 20],
      [15, 17],
      [21, 19],
      [13, 24],
      [19, 23],
      [24, 23],
      [17, 13],
      [12, 14],
    ]) {
      s.ell(x, y, 2, 2, p.berry, p['gem red']);
      s.put(x - 1, y - 1, p.bone);
    }
  });
  icon('item.fish', (s) => {
    const fish = (x, y) => {
      s.ell(x, y, 7, 3, p['slate light'], p.silver, p.slate);
      s.rect(x - 6, y + 1, 12, 1, p.bone);
      for (let i = 0; i < 4; i++) s.line(x + 6, y, x + 10, y - 3 + i, p.slate);
      for (let i = 0; i < 4; i++) s.line(x + 6, y, x + 10, y + 3 - i, p.slate);
      s.put(x - 5, y - 1, p.ink);
      s.put(x - 2, y - 3, p.slate);
    };
    fish(13, 14);
    fish(15, 22);
  });
  icon('item.game', (s) => {
    s.ell(15, 19, 8, 5, p.dirt, p['dirt light'], p['dirt dark']);
    s.ell(7, 15, 3, 3, p['dirt light'], p['skin human'], p.dirt);
    s.put(5, 14, p.ink);
    s.line(5, 11, 4, 8, p.bone);
    s.line(8, 12, 9, 9, p.bone);
    for (const x of [10, 14, 18, 21]) s.rect(x, 23, 2, 4, p['dirt dark']);
    s.rect(22, 15, 4, 2, p['dirt light']);
    s.ell(15, 22, 5, 1.5, p['berry']);
    s.ell(15, 22, 3, 1, p['needle dark']);
  });
  icon('item.meal', (s) => {
    s.ell(16, 22, 10, 6, p['dirt dark'], p.dirt, p.trunk);
    s.ell(16, 19, 8, 3.5, p['needle light']);
    s.ell(14, 19, 4, 2, p.needle, p['straw light']);
    s.put(19, 18, p['oak light']);
    s.put(12, 20, p['oak']);
    s.put(21, 20, p.berry);
    s.line(11, 12, 11, 8, p['snow shade']);
    s.line(16, 13, 17, 7, p['snow shade']);
    s.line(21, 12, 20, 9, p['snow shade']);
    s.rect(9, 25, 14, 2, p.trunk);
  });
  icon('item.tools', (s) => {
    // Pick (head up left) crossing a hammer.
    s.line(7, 26, 22, 8, p.trunk);
    s.line(8, 26, 23, 8, p['dirt light']);
    s.ell(8, 8, 2, 2, p['rock light']);
    s.line(4, 11, 12, 6, p['gravel light']);
    s.line(4, 12, 12, 7, p['gravel dark']);
    s.line(24, 26, 10, 9, p.trunk);
    s.line(25, 26, 11, 9, p['dirt light']);
    s.rect(18, 6, 9, 5, p['gravel light']);
    s.rect(18, 9, 9, 2, p['gravel dark']);
    s.line(19, 7, 25, 7, p.bone);
  });
  icon('item.weapon', (s) => {
    // Sword on the diagonal and a spear beside it.
    s.line(6, 25, 24, 6, p['gravel light']);
    s.line(7, 25, 25, 6, p['floor light']);
    s.line(5, 24, 5, 28, p.bone);
    s.line(4, 22, 9, 27, p.amber);
    s.line(3, 21, 8, 26, p.sandstone);
    s.line(26, 27, 14, 6, p.trunk);
    s.line(27, 27, 15, 6, p['dirt light']);
    s.line(13, 6, 14, 2, p['gravel light']);
    s.line(15, 6, 14, 2, p['floor light']);
    s.rect(13, 5, 3, 2, p['gravel dark']);
  });
  icon('item.cloth', (s) => {
    const bolt = (y, w, c, d, l) => {
      s.rect(16 - w / 2, y, w, 5, c);
      s.rect(16 - w / 2, y, w, 1, l);
      s.rect(16 - w / 2, y + 4, w, 1, d);
      s.rect(16 + w / 2 - 3, y + 1, 1, 3, d);
    };
    bolt(21, 22, p['slate light'], p.slate, p.silver);
    bolt(16, 18, p['sand light'], p.sand, p.bone);
    bolt(11, 20, p['sandstone light'], p.sandstone, p.amber);
    s.rect(7, 8, 8, 3, p['leaf litter light']);
    s.rect(7, 8, 8, 1, p.amber);
  });
  icon('item.leather', (s) => {
    s.ell(16, 20, 11, 7, p.dirt, p['dirt light'], p['dirt dark']);
    for (const [x, y] of [
      [6, 14],
      [26, 15],
      [8, 27],
      [25, 26],
    ])
      s.ell(x, y, 2.5, 2.5, p.dirt);
    s.ell(14, 19, 5, 3, p['dirt light']);
    for (let x = 9; x < 24; x += 3) s.put(x, 26, p['dirt dark']);
    s.line(11, 15, 21, 15, p['dirt dark']);
    s.put(13, 21, p['leaf litter light']);
    s.put(20, 22, p['leaf litter light']);
  });
  icon('item.herbs', (s) => {
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * 3;
      s.line(16, 25, x, 8 + (i % 2) * 3, p[i % 2 ? 'oak light' : 'ash']);
      s.ell(x, 8 + (i % 2) * 3, 2, 2.5, p[i % 3 ? 'oak' : 'ash light']);
    }
    s.rect(13, 20, 7, 2, p['straw dark']);
    s.rect(14, 20, 5, 1, p.straw);
    s.line(16, 25, 12, 28, p['oak dark']);
    s.line(16, 25, 20, 28, p['oak dark']);
    s.put(10, 7, p['gem purple light']);
    s.put(21, 9, p['gem purple light']);
  });
  icon('item.wares', (s) => {
    s.rect(4, 15, 15, 12, p.dirt);
    s.rect(4, 15, 15, 2, p['dirt light']);
    s.rect(4, 25, 15, 2, p['dirt dark']);
    s.rect(4, 20, 15, 1, p['dirt dark']);
    s.rect(4, 15, 2, 12, p.trunk);
    s.rect(17, 15, 2, 12, p.trunk);
    s.ell(24, 22, 4, 4.5, p.sandstone, p['sandstone light'], p['sandstone dark']);
    s.rect(22, 16, 5, 2, p['sandstone dark']);
    s.rect(21, 20, 7, 1, p['sandstone band']);
    s.rect(8, 10, 8, 5, p['limestone']);
    s.rect(8, 10, 8, 1, p['limestone light']);
  });
  icon('item.bedroll', (s) => {
    s.ell(16, 24, 11, 3, p['dirt dark']);
    s.rect(6, 14, 20, 10, p.sandstone);
    s.rect(6, 14, 20, 2, p['sandstone light']);
    s.rect(6, 22, 20, 2, p['sandstone dark']);
    s.ell(6, 19, 3, 5, p['sandstone light']);
    s.ell(6, 19, 1.5, 3, p['sandstone dark']);
    s.rect(12, 14, 2, 10, p.trunk);
    s.rect(21, 14, 2, 10, p.trunk);
    s.ell(26, 19, 2, 5, p['sandstone dark']);
  });
  icon('item.bedroll.laid', (s) => {
    s.rect(9, 3, 14, 26, p.sandstone);
    s.rect(9, 3, 14, 1, p['sandstone light']);
    s.rect(10, 3, 1, 26, p['sandstone light']);
    s.rect(22, 3, 1, 26, p['sandstone dark']);
    s.rect(9, 28, 14, 1, p['sandstone dark']);
    s.rect(11, 5, 10, 6, p['limestone light']);
    s.rect(11, 5, 10, 1, p.bone);
    s.rect(11, 10, 10, 1, p.limestone);
    s.rect(10, 13, 12, 14, p.straw);
    s.rect(10, 13, 12, 1, p['straw light']);
    for (let y = 16; y < 27; y += 4) s.rect(11, y, 10, 1, p['straw dark']);
  });

  // ---- map marks ---------------------------------------------------------------------------
  icon('mark.fell', (s) => {
    // A small axe in the top-right corner: light handle and head so it reads over dark canopies.
    s.line(18, 12, 27, 3, p.bone);
    s.line(19, 12, 28, 3, p['limestone light']);
    s.rect(22, 2, 4, 3, p.bone);
    s.rect(21, 3, 2, 5, p['limestone light']);
    s.rect(19, 4, 2, 3, p.silver);
    s.put(22, 3, p['snow light']);
  });
  const zone = createImage(S, S);
  // A straw wash with a dashed edge, so the store reads on grass, sand and under a bush.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const edge = (x === 0 || y === 0 || x === S - 1 || y === S - 1) && (x + y) % 4 < 2;
      zone.data.set(edge ? [...p['straw light'], 220] : [...p.straw, 72], (y * S + x) * 4);
    }
  frames['zone.stockpile'] = zone;

  icon('cart', (s) => {
    // Handcart, top-down three-quarter: two shafts toward the viewer, bed, load and two wheels.
    s.line(11, 21, 9, 30, p.trunk);
    s.line(12, 21, 10, 30, p['dirt light']);
    s.line(21, 21, 23, 30, p.trunk);
    s.line(20, 21, 22, 30, p['dirt light']);
    s.rect(9, 29, 3, 1, p['dirt dark']);
    s.rect(21, 29, 3, 1, p['dirt dark']);
    s.rect(7, 5, 18, 18, p['dirt dark']);
    s.rect(8, 6, 16, 16, p.dirt);
    for (const y of [10, 14, 18]) s.rect(8, y, 16, 1, p['dirt dark']);
    s.rect(8, 6, 16, 1, p['dirt light']);
    s.rect(7, 20, 18, 3, p.trunk);
    s.rect(7, 20, 18, 1, p['dirt light']);
    s.rect(10, 7, 7, 6, p.straw);
    s.rect(10, 7, 7, 1, p['straw light']);
    s.rect(17, 9, 5, 5, p.slate);
    s.rect(17, 9, 5, 1, p['slate light']);
    for (const x of [3, 25]) {
      s.ell(x + 2, 15, 2.2, 6.5, p['dirt dark'], p.trunk);
      s.rect(x + 1, 12, 2, 6, p.trunk);
      s.rect(x + 2, 11, 1, 8, p['dirt light']);
    }
  });
  return frames;
}

if (isMain(import.meta.url)) {
  const out = path.join(root, 'art/src/items');
  mkdirSync(out, { recursive: true });
  const frames = drawItems();
  for (const [name, image] of Object.entries(frames))
    writeFileSync(path.join(out, `${name}.png`), encodePng(image));
  console.log(`items: drew ${Object.keys(frames).length} frames into ${out}`);
}

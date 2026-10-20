// The P5.8 `items` frames (tools/draw-items.mjs): an open grave, a filled mound, its carved
// wooden marker (drawn over the mound) and a wattle hurdle for each edge of a burial ground.
import { surface } from './draw-items-surface.mjs';
import { createImage } from './png.mjs';

export function burialItems(p) {
  const S = 32;
  const frames = {};
  const icon = (name, draw, outline = true) => {
    const s = surface();
    draw(s);
    if (outline) s.outline(p.ink);
    frames[name] = s.image;
  };
  icon('grave.dug', (s) => {
    s.rect(8, 2, 16, 21, p['dirt light']); // rim
    s.rect(10, 4, 12, 17, p['dirt dark']);
    s.rect(11, 6, 10, 14, p.darkness);
    s.rect(10, 4, 12, 1, p.dirt);
    s.rect(10, 4, 1, 17, p.dirt);
    for (const [x, y] of [
      [13, 9],
      [18, 13],
      [15, 17],
      [19, 8],
    ])
      s.put(x, y, p.ink);
    s.ell(16, 26, 8, 3.5, p.dirt, p['dirt light'], p['dirt dark']);
    for (const [x, y] of [
      [12, 25],
      [17, 24],
      [20, 26],
      [15, 27],
    ])
      s.put(x, y, p['dirt light']);
  });
  icon('grave.mound', (s) => {
    s.ell(16, 16, 7, 13, p.dirt, p['dirt light'], p['dirt dark']);
    s.ell(15, 14, 3, 8, p['dirt light']);
    s.ell(16, 16, 7, 13, p.dirt, null, p['dirt dark']); // re-shade shadow side
    s.ell(14, 13, 3, 8, p['dirt light']);
    for (const [x, y] of [
      [18, 10],
      [17, 20],
      [13, 22],
      [19, 16],
      [12, 8],
    ])
      s.put(x, y, p['dirt dark']);
  });
  icon('grave.marker', (s) => {
    s.rect(15, 3, 3, 11, p.trunk);
    s.rect(15, 3, 1, 11, p['dirt light']);
    s.rect(11, 6, 11, 2, p.trunk);
    s.rect(11, 6, 11, 1, p['dirt light']);
    s.put(16, 4, p['leaf litter light']);
    s.rect(14, 14, 5, 1, p['dirt dark']);
  });
  // Hurdle: drawn along the north edge (7 px thick), rotated for the others.
  const hurdleN = () => {
    const s = surface();
    const T = 7;
    const withy = [p['leaf litter light'], p['leaf litter'], p['dirt light'], p['leaf litter']];
    for (let y = 0; y < T; y++) for (let x = 0; x < S; x++) s.put(x, y, withy[y % 4]);
    for (let k = 0; k < 4; k++) {
      const cx = 2 + k * 8;
      for (let y = 0; y < T; y++) {
        if ((y + k) % 2 === 0) {
          s.put(cx, y, p['dirt dark']);
          s.put(cx + 1, y, p.trunk);
        }
      }
    }
    for (let x = 0; x < S; x++) s.put(x, T - 1, p['dirt dark']);
    for (let k = 0; k < 4; k++) {
      s.put(2 + k * 8, 0, p.trunk);
      s.put(3 + k * 8, 0, p['dirt light']);
    }
    return s.image;
  };
  const rot = (img, turns) => {
    const o = createImage(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        let nx = x,
          ny = y;
        for (let t = 0; t < turns; t++) [nx, ny] = [S - 1 - ny, nx]; // 90 deg clockwise
        o.data.set(img.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4), (ny * S + nx) * 4);
      }
    return o;
  };
  const hn = hurdleN();
  const dirs = { n: 0, e: 1, s: 2, w: 3 };
  for (const [d, t] of Object.entries(dirs)) frames[`burial.hurdle.${d}`] = rot(hn, t);
  return frames;
}

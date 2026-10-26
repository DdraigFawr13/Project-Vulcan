// The P4.7 `items` icons (tools/draw-items.mjs): turnips, seed grain, the worn wool cloak (a
// settler's cloak lies on no tile, but the frame is there for the store and the item page) and,
// since 5B Bundle 2, oats, beans and cabbages.
import { noise } from './draw-nature.mjs';
import { surface } from './draw-items-surface.mjs';

export function cropItems(p) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };
  icon('item.turnips', (s) => {
    const turnip = (cx, cy) => {
      s.ell(cx, cy, 5, 4.5, p.bone, p['limestone light'], p['limestone dark']);
      s.ell(cx, cy - 3, 4, 2.2, p['gem purple'], p['gem purple light']);
      for (const dx of [-2, 0, 2]) s.line(cx + dx, cy - 5, cx + dx * 2, cy - 9, p['birch leaf']);
    };
    turnip(11, 21);
    turnip(21, 21);
    turnip(16, 14);
  });
  // 5B Bundle 2: oats in a loose heap, a pile of dried beans, three cabbage heads.
  icon('item.oats', (s) => {
    // Three nodding stalks over the heap, oats' loose heads hanging to one side.
    for (const x of [11, 16, 21]) {
      s.line(x, 20, x + 1, 9, p['straw dark']);
      for (const [dx, dy] of [
        [2, 10],
        [3, 12],
        [2, 14],
        [-1, 11],
      ])
        s.put(x + dx, dy, p['sand light']);
    }
    s.ell(16, 21, 10, 5, p['sand dark'], p.sand, p['straw dark']);
    for (let k = 0; k < 22; k++) {
      const x = 8 + Math.floor(noise(13, k, 1) * 17);
      const y = 17 + Math.floor(noise(13, k, 2) * 7);
      s.put(x, y, k % 2 ? p['sand light'] : p['straw light']);
    }
  });
  icon('item.beans', (s) => {
    s.ell(16, 21, 10, 5, p['dirt'], p['dirt light'], p['dirt dark']);
    for (let k = 0; k < 16; k++) {
      const x = 8 + Math.floor(noise(17, k, 1) * 16);
      const y = 17 + Math.floor(noise(17, k, 2) * 7);
      s.put(x, y, p['sand dark']);
      s.put(x + 1, y, k % 3 ? p['leaf litter light'] : p.bone);
    }
  });
  icon('item.cabbages', (s) => {
    const head = (cx, cy) => {
      s.ell(cx, cy, 5, 4.5, p.willow, p['willow light'], p['willow dark']);
      s.ell(cx, cy - 1, 2.5, 2, p['birch leaf light']);
    };
    head(11, 21);
    head(21, 21);
    head(16, 14);
  });
  icon('item.seed', (s) => {
    s.ell(16, 22, 9, 4, p['dirt dark']);
    s.ell(16, 19, 8, 5, p['leaf litter'], p['leaf litter light'], p['leaf litter dark']);
    for (let k = 0; k < 18; k++) {
      const x = 9 + Math.floor(noise(11, k, 1) * 15);
      const y = 15 + Math.floor(noise(11, k, 2) * 8);
      s.put(x, y, k % 3 ? p['straw blade'] : p['straw light']);
      s.put(x + 1, y, p.straw);
    }
  });
  icon('item.cloak', (s) => {
    s.ell(16, 18, 10, 9, p['slate dark'], p.slate, p['slate line']);
    s.rect(9, 9, 14, 4, p.slate);
    s.rect(9, 9, 14, 1, p['slate light']);
    s.rect(14, 8, 4, 3, p['straw dark']);
    s.rect(15, 12, 2, 14, p['slate line']);
    s.rect(8, 25, 16, 2, p['slate dark']);
  });
  return frames;
}

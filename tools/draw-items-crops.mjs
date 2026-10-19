// The P4.7 `items` icons (tools/draw-items.mjs): turnips, seed grain and the worn wool cloak (a
// settler's cloak lies on no tile, but the frame is there for the store and the item page).
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

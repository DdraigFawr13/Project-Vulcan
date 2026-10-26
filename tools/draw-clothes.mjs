// The 5B Bundle 5 `items` icons (tools/draw-items.mjs): the garments (`item.smock`, `item.tunic`,
// `item.leather-coat`, `item.hide-coat`; `item.cloak` is in draw-items-crops.mjs) and what they
// are made from (`item.wool`, `item.linen`, `item.fur`, `item.flax`). Colours only from
// art/palette.gpl, a 1 px ink outline like the other icons.
import { surface } from './draw-items-surface.mjs';
import { noise } from './draw-nature.mjs';

export function clothesItems(p) {
  const frames = {};
  const icon = (name, draw) => {
    const s = surface();
    draw(s);
    s.outline(p.ink);
    frames[name] = s.image;
  };
  // A garment laid flat, front on: body, sleeves spread from the shoulders, a neck notch.
  const garment = (s, { mid, light, dark, hem, sleeve }) => {
    s.rect(10, 8, 12, hem - 8, mid);
    s.rect(10, 8, 2, hem - 8, light);
    s.rect(20, 8, 2, hem - 8, dark);
    for (const side of [-1, 1])
      for (let k = 0; k < sleeve; k++) {
        const x = side < 0 ? 9 - k : 22 + k;
        s.rect(x, 8 + Math.floor(k / 2), 1, 6, mid);
        s.put(x, 8 + Math.floor(k / 2), side < 0 ? light : dark);
      }
    s.rect(14, 8, 4, 1, dark);
    s.rect(15, 9, 2, 1, dark);
    s.rect(10, hem - 1, 12, 1, dark);
  };
  icon('item.smock', (s) => {
    const [mid, light, dark] = [p.bone, p['limestone light'], p['limestone dark']];
    garment(s, { mid, light, dark, hem: 25, sleeve: 4 });
    s.rect(14, 12, 4, 1, dark);
    for (const y of [17, 21]) s.rect(12, y, 8, 1, light);
  });
  icon('item.tunic', (s) => {
    const [mid, light, dark] = [p.sandstone, p['sandstone light'], p['sandstone dark']];
    garment(s, { mid, light, dark, hem: 25, sleeve: 5 });
    s.rect(10, 17, 12, 1, p['sandstone band']);
    s.rect(14, 8, 4, 1, p['sandstone band']);
  });
  icon('item.leather-coat', (s) => {
    garment(s, { mid: p.dirt, light: p['dirt light'], dark: p['dirt dark'], hem: 28, sleeve: 6 });
    s.rect(15, 10, 2, 18, p['dirt dark']);
    for (const y of [12, 16, 20, 24]) s.put(14, y, p['straw dark']);
    s.rect(10, 18, 12, 1, p['dirt dark']);
  });
  icon('item.hide-coat', (s) => {
    const [mid, light, dark] = [p['leaf litter'], p['leaf litter light'], p['leaf litter dark']];
    garment(s, { mid, light, dark, hem: 27, sleeve: 6 });
    // Fur: a ragged collar and hem of lighter hair.
    for (let x = 10; x < 22; x++) {
      s.put(x, 27, p.sand);
      s.put(x, 28 + (noise(21, x, 1) > 0.5 ? 1 : 0), p['sand dark']);
    }
    for (let x = 12; x < 20; x++) s.put(x, 8 + (x % 2), p['sand light']);
    s.rect(15, 10, 2, 17, dark);
    for (const [x, y] of [
      [8, 14],
      [23, 14],
      [7, 15],
      [24, 15],
    ])
      s.put(x, y, p.sand);
  });
  // Cloth: a rolled bolt on its side, the cut end showing the roll.
  const bolt = (s, mid, light, dark, stripe) => {
    s.rect(6, 12, 20, 12, mid);
    s.rect(6, 12, 20, 2, light);
    s.rect(6, 22, 20, 2, dark);
    s.ell(7, 18, 3, 6, light, undefined, dark);
    s.ell(7, 18, 1.2, 3, dark);
    s.rect(14, 12, 1, 12, stripe);
    s.rect(21, 12, 1, 12, stripe);
  };
  icon('item.wool', (s) => bolt(s, p.slate, p['slate light'], p['slate dark'], p['slate line']));
  icon('item.linen', (s) => bolt(s, p['sand light'], p.bone, p.sand, p['sand dark']));
  // Cured hide: a pelt with a ragged hair edge, lighter than leather.
  icon('item.fur', (s) => {
    s.ell(16, 19, 11, 8, p['leaf litter'], p['leaf litter light'], p['leaf litter dark']);
    for (const [x, y] of [
      [6, 13],
      [26, 13],
      [6, 25],
      [26, 25],
      [16, 10],
      [16, 28],
    ])
      s.ell(x, y, 2.5, 2.5, p['leaf litter']);
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * 6.2832;
      const x = 16 + Math.round(11 * Math.cos(t));
      const y = 19 + Math.round(8 * Math.sin(t));
      s.put(x, y, a % 2 ? p.sand : p['sand dark']);
    }
    for (const [x, y] of [
      [12, 17],
      [17, 16],
      [20, 21],
      [13, 22],
    ])
      s.line(x, y, x + 2, y + 1, p['sand dark']);
  });
  // Flax: a tied sheaf of pale stalks with a few small blue flowers at the tops.
  icon('item.flax', (s) => {
    for (let i = 0; i < 7; i++)
      s.line(16, 26, 10 + i * 2, 7 + (i % 3) * 2, i % 2 ? p['straw dark'] : p['birch leaf']);
    for (const [x, y] of [
      [10, 7],
      [14, 9],
      [18, 7],
      [22, 9],
      [12, 6],
      [20, 6],
    ]) {
      s.put(x, y, p.silver);
      s.put(x + 1, y, p['ice shade']);
    }
    s.rect(13, 20, 6, 2, p['straw dark']);
    s.rect(13, 20, 6, 1, p.straw);
    s.line(16, 26, 12, 29, p['straw dark']);
    s.line(16, 26, 20, 29, p['straw dark']);
  });
  return frames;
}

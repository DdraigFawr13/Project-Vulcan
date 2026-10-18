// Draws the P2.1 `sprites-people` placeholder sheet into art/src/sprites-people/ (docs/ART.md):
// one body per race (4 facings, standing + 2 walk frames), grey clothes overlays and grey hair
// overlays that the renderer tints. Only colours from art/palette.gpl; deterministic (no random).
// Usage: node tools/draw-people.mjs, then node tools/pack-sheet.mjs sprites-people
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readPalette } from './draw-tiles-base.mjs';
import { HAIR_STYLES, hair } from './draw-people-hair.mjs';
import { isMain, root } from './lib.mjs';
import { createImage, encodePng } from './png.mjs';

const S = 32;
const FEET = 29; // last interior row of the feet; the outline sits on row 30
const CX = 16;

// h = hh + th + ll. tw/hw even. aw arm width, al arm length, lw leg width.
export const RACES = {
  human: { hh: 6, hw: 6, th: 8, ll: 8, tw: 8, aw: 2, al: 7, lw: 3, skin: 'skin human' },
  elf: { hh: 6, hw: 6, th: 8, ll: 9, tw: 6, aw: 2, al: 7, lw: 2, skin: 'skin elf', ears: 'point' },
  dwarf: { hh: 6, hw: 8, th: 6, ll: 5, tw: 10, aw: 3, al: 5, lw: 4, skin: 'skin dwarf', beard: 1 },
  orc: { hh: 6, hw: 8, th: 9, ll: 8, tw: 10, aw: 3, al: 8, lw: 4, skin: 'skin orc', tusks: 1 },
  giant: { hh: 8, hw: 8, th: 12, ll: 9, tw: 14, aw: 4, al: 11, lw: 6, skin: 'skin giant' },
  halfling: { hh: 6, hw: 6, th: 4, ll: 5, tw: 6, aw: 2, al: 4, lw: 3, skin: 'skin halfling' },
  goblin: {
    hh: 6,
    hw: 6,
    th: 4,
    ll: 5,
    tw: 6,
    aw: 2,
    al: 4,
    lw: 2,
    skin: 'skin goblin',
    ears: 'big',
  },
};
export const FACINGS = ['s', 'n', 'e', 'w'];

const grid = () => new Array(S * S).fill(null);
const inside = (x, y) => x >= 0 && y >= 0 && x < S && y < S;
function fill(g, x, y, w, h, c) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) if (inside(i, j)) g[j * S + i] = c;
}

// The parts of one figure for a facing (s, n or e) and frame, in painting order (back to front).
// role: leg, torso, arm, head. `far` parts are shaded dark. The head box is the same in every
// frame, so hair never has to follow a bob.
function layout(r, facing, frame) {
  const side = facing === 'e';
  const legTop = FEET + 1 - r.ll;
  const torsoTop = legTop - r.th;
  const head = { x0: CX - r.hw / 2 + (side ? 1 : 0), y0: torsoTop - r.hh, w: r.hw, h: r.hh };
  const step = frame === 0 ? 0 : frame === 1 ? 1 : -1; // walk phase
  const parts = [];
  const tw = side ? r.tw - 2 : r.tw;
  const tx = CX - tw / 2;
  const armY = torsoTop + 1;
  if (!side) {
    // Front or back: two legs, the lifted one 1 px shorter and 1 px further out; arms swing in y.
    const gap = tw - 2 * r.lw;
    for (const [i, x] of [tx, tx + tw - r.lw].entries()) {
      const lifted = (i === 0 ? 1 : -1) === step;
      const out = lifted ? (i === 0 ? -1 : 1) : 0;
      parts.push({ role: 'leg', x: x + out, y: legTop, w: r.lw, h: r.ll - (lifted ? 1 : 0), gap });
    }
    parts.push({ role: 'torso', x: tx, y: torsoTop, w: tw, h: r.th });
    parts.push({ role: 'arm', x: tx - r.aw - 1, y: armY - step, w: r.aw, h: r.al, hand: 0 });
    parts.push({ role: 'arm', x: tx + tw + 1, y: armY + step, w: r.aw, h: r.al, hand: 1 });
  } else {
    // Side: far leg and arm behind, near ones in front, swinging +-2 px along x.
    const lx = CX - Math.floor(r.lw / 2);
    const ax = CX - Math.floor(r.aw / 2);
    parts.push({
      role: 'arm',
      far: 1,
      x: ax + step * 2 - (step ? 0 : 1),
      y: armY,
      w: r.aw,
      h: r.al,
    });
    parts.push({
      role: 'leg',
      far: 1,
      x: lx - (step ? step * 2 : 1),
      y: legTop,
      w: r.lw,
      h: r.ll - (step === 1 ? 1 : 0),
    });
    parts.push({ role: 'torso', x: tx, y: torsoTop, w: tw, h: r.th });
    parts.push({
      role: 'leg',
      x: lx + step * 2,
      y: legTop,
      w: r.lw,
      h: r.ll - (step === -1 ? 1 : 0),
    });
    parts.push({ role: 'arm', x: ax - step * 2, y: armY, w: r.aw, h: r.al, hand: 0 });
  }
  parts.push({ role: 'head', x: head.x0, y: head.y0, w: r.hw, h: r.hh });
  return { parts, head, torsoTop, legTop, tx, tw };
}

function drawBody(p, race, facing, frame) {
  const r = RACES[race];
  const { parts, head, torsoTop, tx, tw } = layout(r, facing, frame);
  const body = grid();
  const protect = new Set(); // beard cells that clothes must not cover
  const skin = r.skin;
  const dark = `${skin} dark`;
  for (const q of parts) {
    const c = q.far ? dark : skin;
    fill(body, q.x, q.y, q.w, q.h, c);
    if (!q.far && facing !== 'e' && q.role !== 'arm') fill(body, q.x + q.w - 1, q.y, 1, q.h, dark);
    if (q.role === 'leg') {
      fill(body, q.x, q.y + q.h - 1, q.w, 1, 'dirt dark'); // shoes
      fill(body, q.x, q.y + q.h - 2, q.w, 1, dark);
    }
  }
  const hx1 = head.x0 + head.w - 1;
  const hy1 = head.y0 + head.h - 1;
  const eyeY = hy1 - 2;
  const px = (x, y, c, keep) => {
    if (inside(x, y)) body[y * S + x] = c;
    if (keep) protect.add(y * S + x);
  };
  if (facing === 's') {
    px(CX - 2, eyeY, 'ink');
    px(CX + 1, eyeY, 'ink');
    if (r.tusks) {
      px(head.x0 + 1, hy1, 'bone');
      px(hx1 - 1, hy1, 'bone');
    }
  } else if (facing === 'e') {
    px(hx1 - 1, eyeY, 'ink');
    px(hx1 + 1, eyeY + 1, skin); // nose
    if (r.tusks) px(hx1, hy1, 'bone');
  }
  if (r.ears) {
    const rows = r.ears === 'big' ? [2, 3] : [3];
    const reach = 2; // big ears stick out; elf ears sweep up to a point
    const sides = facing === 'e' ? [-1] : [-1, 1];
    for (const sd of sides)
      for (let k = 1; k <= reach; k++) {
        const x = sd < 0 ? head.x0 - k : hx1 + k;
        for (const row of rows) px(x, head.y0 + row - (k === reach ? 1 : 0), skin);
        px(x, head.y0 + 2, k === reach && r.ears === 'point' ? skin : dark);
        if (k === reach && r.ears === 'point') px(x, head.y0 + 1, skin);
      }
  }
  if (r.beard && facing !== 'n') {
    const front = facing === 's';
    const b0 = front ? head.x0 : hx1 - 3;
    for (let y = eyeY + 1; y <= hy1; y++) fill(body, b0, y, front ? head.w : 4, 1, 'trunk');
    for (let i = 0; i < 3; i++) {
      const bw = (front ? head.w : 4) - 2 - 2 * i;
      if (bw < 1) break;
      const bx = front ? CX - bw / 2 : hx1 - 3 + 1;
      for (let x = bx; x < bx + bw; x++) px(x, torsoTop + i, 'trunk', true);
    }
    for (let y = eyeY + 1; y <= hy1; y++)
      for (let x = b0; x < b0 + (front ? head.w : 4); x++) protect.add(y * S + x);
  }
  // Outline: ink around every painted cell.
  const out = body.slice();
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (!body[y * S + x]) {
        const n = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => inside(x + dx, y + dy) && body[(y + dy) * S + x + dx]);
        if (n) out[y * S + x] = 'ink';
      }
  return { body: out, protect, parts, head, torsoTop, tx, tw };
}

// Clothes: tunic over torso and upper arms, trousers over legs down to the shins.
function drawClothes(figure, r) {
  const g = grid();
  const { parts, protect } = figure;
  for (const q of parts) {
    if (q.role === 'head') continue;
    const rows = q.role === 'leg' ? q.h - 2 : q.role === 'arm' ? Math.ceil(r.al / 2) : q.h;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < q.w; i++) {
        const x = q.x + i;
        const y = q.y + j;
        if (protect.has(y * S + x)) continue;
        let c = q.far ? 'tint dark' : 'tint mid';
        if (!q.far && (j === 0 || i === 0) && q.role !== 'leg') c = 'tint light';
        if (!q.far && i === q.w - 1 && q.w > 2) c = 'tint dark';
        if (q.role === 'torso' && j === rows - 1) c = 'tint dark'; // hem
        if (q.role === 'leg' && !q.far && i === 0) c = 'tint light';
        g[y * S + x] = c;
      }
  }
  return g;
}

function toImage(p, g, flip) {
  const image = createImage(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const c = g[y * S + (flip ? S - 1 - x : x)];
      if (!c) continue;
      if (!p[c]) throw new Error(`colour "${c}" is not in art/palette.gpl`);
      image.data.set([...p[c], 255], (y * S + x) * 4);
    }
  return image;
}

export function drawPeople(p = readPalette()) {
  const frames = {};
  const hands = {};
  for (const race of Object.keys(RACES)) {
    const r = RACES[race];
    for (const facing of FACINGS) {
      const src = facing === 'w' ? 'e' : facing;
      const flip = facing === 'w';
      let headBox;
      for (const frame of [0, 1, 2]) {
        const f = drawBody(p, race, src, frame);
        headBox = f.head;
        const name = `${race}.${facing}.${frame}`;
        frames[`person.${name}`] = toImage(p, f.body, flip);
        frames[`clothes.${name}`] = toImage(p, drawClothes(f, r), flip);
        if (frame === 0 && (facing === 's' || facing === 'e'))
          hands[`${race}.${facing}`] = f.parts
            .filter((q) => q.role === 'arm' && !q.far)
            .map((q) => [flip ? S - 1 - (q.x + (q.w >> 1)) : q.x + (q.w >> 1), q.y + q.h - 1]);
      }
      const f0 = drawBody(p, race, src, 0);
      for (const style of HAIR_STYLES) {
        const g = grid();
        for (const [x, y, c] of hair(style, src, headBox, f0.torsoTop))
          if (inside(x, y)) g[y * S + x] = c;
        frames[`hair.${style}.${race}.${facing}`] = toImage(p, g, flip);
      }
    }
  }
  return { frames, hands };
}

if (isMain(import.meta.url)) {
  const { frames, hands } = drawPeople();
  const out = path.join(root, 'art/src/sprites-people');
  mkdirSync(out, { recursive: true });
  for (const [name, image] of Object.entries(frames))
    writeFileSync(path.join(out, `${name}.png`), encodePng(image));
  console.log(`sprites-people: drew ${Object.keys(frames).length} frames into ${out}`);
  for (const [k, v] of Object.entries(hands)) console.log(`hands ${k}: ${JSON.stringify(v)}`);
}

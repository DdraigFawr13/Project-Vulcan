// Hair overlays for tools/draw-people.mjs: light-grey ramp (tint light/mid/dark) that the renderer
// multiplies with a hair colour. Per race and facing (no head bob, so walk frames share them).
// `head` is { x0, y0, w, h } of the head box; `torsoTop` is the first torso row.
const L = 'tint light';
const M = 'tint mid';
const D = 'tint dark';

export const HAIR_STYLES = ['short', 'long', 'braid'];

export function hair(style, facing, head, torsoTop) {
  const cells = [];
  const put = (x, y, c) => cells.push([x, y, c]);
  const row = (y, x0, x1, c) => {
    for (let x = x0; x <= x1; x++) put(x, y, typeof c === 'function' ? c(x) : c);
  };
  const { x0, y0, w, h } = head;
  const x1 = x0 + w - 1;
  const back = facing === 'n';
  const side = facing === 'e';
  // Which columns of the head the hair covers: whole width seen from s or n, the rear half from e.
  const c0 = x0;
  const c1 = side ? x0 + Math.floor(w / 2) : x1;
  // Cap: a dark top row that stands in for the outline, then a lit row and a mid row.
  row(y0 - 1, c0 + 1, side ? c1 + 1 : c1 - 1, D);
  row(y0, c0, side ? c1 + 1 : c1, (x) => (x < x0 + w / 2 ? L : M));
  row(y0 + 1, c0, side ? c1 + 1 : c1, M);
  const drop = back ? h - 2 : 2; // how far the cap's sides come down the head
  for (let y = y0 + 2; y < y0 + drop; y++) row(y, c0, c1, y % 2 ? M : D);
  if (!back && !side) {
    put(c0, y0 + 2, D);
    put(c1, y0 + 2, D);
  }
  if (style === 'long') {
    const end = torsoTop + 3;
    for (let y = y0 + 2; y <= end; y++) {
      if (back || side) row(y, c0, c1, y > end - 2 ? D : M);
      else {
        put(c0, y, y > end - 2 ? D : M);
        put(c1, y, y > end - 2 ? D : M);
      }
    }
  }
  if (style === 'braid') {
    const end = torsoTop + 6;
    const bx = back ? x0 + Math.floor(w / 2) : side ? x0 : x1;
    for (let y = back ? y0 + drop : y0 + 2; y <= end; y++) put(bx, y, y % 2 ? D : M);
    if (back) for (let y = y0 + 2; y < y0 + drop; y++) put(bx, y, y % 2 ? D : M);
  }
  return cells;
}

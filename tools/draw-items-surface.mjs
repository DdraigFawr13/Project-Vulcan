// The 32x32 drawing surface the `items` sheet's icons share (tools/draw-items.mjs).
import { createImage } from './png.mjs';

const S = 32;

// A drawing surface over a 32x32 RGBA image with the shape helpers the icons share.
export function surface() {
  const image = createImage(S, S);
  const put = (x, y, rgb, a = 255) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    image.data.set([...rgb, a], (y * S + x) * 4);
  };
  const has = (x, y) => x >= 0 && y >= 0 && x < S && y < S && image.data[(y * S + x) * 4 + 3] > 0;
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };
  // Filled ellipse; `lit` shades the upper left with a light colour and the lower right with a dark one.
  const ell = (cx, cy, rx, ry, c, lit, dark) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x - cx) / (rx + 0.4);
        const v = (y - cy) / (ry + 0.4);
        if (u * u + v * v > 1) continue;
        put(x, y, lit && u + v < -0.7 ? lit : dark && u + v > 0.6 ? dark : c);
      }
  };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  };
  // Surround every opaque pixel with ink on transparent 4-neighbours (call once, last).
  const outline = (ink) => {
    const mark = [];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++)
        if (!has(x, y) && (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1)))
          mark.push([x, y]);
    for (const [x, y] of mark) put(x, y, ink);
  };
  return { image, put, rect, ell, line, outline };
}

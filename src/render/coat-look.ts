// How a worn coat looks (Seen at Work Part 3, V-190, Morgan's mock-up form 2026-11-20 Q2 A, Q3 A):
// the coat drawings are PixelLab edits of each villager, so the coat's pixels are the ones the edit
// changed below the head. A ragged coat (the worker says which, from its life left) is dulled and
// darkened, with a torn, uneven hem and a few small holes showing the tunic beneath; a fine one has
// richer colour, a one-pixel brass trim along the hem and a clasp at the throat. Pure pixel maths
// on RGBA arrays, every colour snapped to the game's palette; a picture choice, never game state.

export type Look = 'ragged' | 'fine';
type Rgb = readonly [number, number, number];

/** Rows of head above a coat begins, from the top of the figure (32 px villagers). */
const HEAD = 9;
/** Summed channel difference over which a pixel counts as changed by the coat edit. */
const CHANGED = 60;
/** Darker than this is outline, never coat. */
const OUTLINE = 34;
const HOLE: Rgb = [34, 26, 20];
const TRIM: Rgb = [200, 116, 58];
const TRIM_LIGHT: Rgb = [222, 180, 90];

const lum = (r: number, g: number, b: number): number => (r * 3 + g * 4 + b) / 8;

/** The palette's colours from a GIMP palette file's text (`art/palette.gpl`). */
export function readPalette(gpl: string): Rgb[] {
  return gpl
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 3 && p.slice(0, 3).every((x) => /^\d+$/.test(x)))
    .map((p) => [Number(p[0]), Number(p[1]), Number(p[2])] as const);
}

/** The distinct opaque colours of an RGBA image: the packed people sheet is snapped to the game's
 * palette, so its colours are a palette the looks can snap to (render cannot read `art/`). */
export function sheetColours(data: Uint8ClampedArray): Rgb[] {
  const seen = new Set<number>();
  for (let i = 0; i < data.length; i += 4)
    if (data[i + 3]! >= 128) seen.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
  return [...seen].map((k) => [k >> 16, (k >> 8) & 255, k & 255] as const);
}

/** The nearest palette colour, weighted for the eye as the art scripts weigh it. */
function snapper(palette: readonly Rgb[]): (c: Rgb) => Rgb {
  const cache = new Map<number, Rgb>();
  return ([r, g, b]) => {
    const key = (r << 16) | (g << 8) | b;
    let best = cache.get(key);
    if (best) return best;
    let d = Infinity;
    for (const q of palette) {
      const e = (q[0] - r) ** 2 * 3 + (q[1] - g) ** 2 * 4 + (q[2] - b) ** 2 * 2;
      if (e < d) [d, best] = [e, q];
    }
    cache.set(key, best ?? [r, g, b]);
    return best ?? [r, g, b];
  };
}

/** Which pixels of a coat drawing are coat: opaque, not outline, below the head, and new or
 * changed from the same villager without it. */
export function coatMask(base: Uint8ClampedArray, coat: Uint8ClampedArray, w: number): boolean[] {
  const h = coat.length / 4 / w;
  let top = h;
  for (let i = 0; i < w * h && top === h; i++) if (coat[i * 4 + 3]! >= 128) top = Math.floor(i / w);
  const mask = Array.from({ length: w * h }, () => false);
  for (let y = top + HEAD; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (coat[i + 3]! < 128 || lum(coat[i]!, coat[i + 1]!, coat[i + 2]!) < OUTLINE) continue;
      const diff =
        Math.abs(coat[i]! - base[i]!) +
        Math.abs(coat[i + 1]! - base[i + 1]!) +
        Math.abs(coat[i + 2]! - base[i + 2]!);
      mask[y * w + x] = base[i + 3]! < 128 || diff > CHANGED;
    }
  return mask;
}

/** A small seeded generator, so a coat's tears stay put from frame to frame. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A coat drawing being redrawn: its pixels, mask and coat cells, and the hem and neck rows. */
interface Work {
  base: Uint8ClampedArray;
  out: Uint8ClampedArray;
  mask: boolean[];
  cells: number[];
  w: number;
  hem: Map<number, number>;
  neck: Map<number, number>;
  snap: (c: Rgb) => Rgb;
}

const put = (k: Work, p: number, c: Rgb) => k.out.set([...c, 255], p * 4);

/** Each coat pixel's colour through `f` (channel, luminance), snapped to the palette. */
function tint(k: Work, f: (c: number, l: number) => number): void {
  for (const p of k.cells) {
    const [r, g, b] = [k.out[p * 4]!, k.out[p * 4 + 1]!, k.out[p * 4 + 2]!];
    const l = lum(r, g, b);
    const c = [f(r, l), f(g, l), f(b, l)].map((v) => Math.min(255, Math.round(v)));
    put(k, p, k.snap(c as unknown as Rgb));
  }
}

/** Dull, darker cloth; a torn, uneven hem and a few holes that show the tunic beneath. */
function ragged(k: Work, seed: number): void {
  const { base, out, mask, w } = k;
  tint(k, (c, l) => 0.55 * c + 0.25 * l);
  const rnd = rng(seed);
  for (const [x, y] of [...k.hem].sort((a, b) => a[0] - b[0])) {
    if (x === 0 || x === w - 1) continue;
    const cut = rnd() < 0.6 ? [0, 1, 1, 2, 3][Math.floor(rnd() * 5)]! : 0;
    for (let d = 0; d < cut; d++) {
      const p = (y - d) * w + x;
      if (!mask[p]) continue;
      // The tunic beneath shows where the hem is torn, else nothing.
      out.set(base[p * 4 + 3]! >= 128 ? base.subarray(p * 4, p * 4 + 4) : [0, 0, 0, 0], p * 4);
    }
  }
  const near = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  const inner = k.cells.filter((p) => near.every((d) => mask[p + d]));
  const holes = Math.max(2, Math.floor(inner.length / 45));
  for (let n = 0; n < holes && inner.length; n++) {
    const p = inner.splice(Math.floor(rnd() * inner.length), 1)[0]!;
    put(k, p, k.snap(HOLE));
    if (mask[p + 1]) put(k, p + 1, k.snap(HOLE));
  }
}

/** Richer cloth, a one-pixel brass trim along the hem and a clasp at the throat. */
function fine(k: Work): void {
  tint(k, (c) => c * 1.12);
  for (const [x, y] of k.hem) put(k, y * k.w + x, k.snap(TRIM_LIGHT));
  const xs = [...k.neck.keys()];
  if (!xs.length) return;
  const mid = Math.floor((Math.min(...xs) + Math.max(...xs)) / 2);
  const y = k.neck.get(mid);
  if (y === undefined) return;
  put(k, y * k.w + mid, k.snap(TRIM_LIGHT));
  if (k.mask[(y + 1) * k.w + mid]) put(k, (y + 1) * k.w + mid, k.snap(TRIM));
}

/** The coat drawing with a ragged or fine look drawn over its coat pixels; `seed` places the tears.
 * `base` is the same villager and frame without the coat, `w` the frame's width. */
export function coatLook(
  base: Uint8ClampedArray,
  coat: Uint8ClampedArray,
  w: number,
  look: Look,
  palette: readonly Rgb[],
  seed: number,
): Uint8ClampedArray {
  const mask = coatMask(base, coat, w);
  const cells = mask.flatMap((m, p) => (m ? [p] : []));
  // The coat's lowest and highest pixel in each column.
  const hem = new Map<number, number>();
  const neck = new Map<number, number>();
  for (const p of cells) {
    const [x, y] = [p % w, Math.floor(p / w)];
    hem.set(x, Math.max(hem.get(x) ?? -1, y));
    neck.set(x, Math.min(neck.get(x) ?? Infinity, y));
  }
  const k: Work = {
    base,
    out: new Uint8ClampedArray(coat),
    mask,
    cells,
    w,
    hem,
    neck,
    snap: snapper(palette),
  };
  if (look === 'ragged') ragged(k, seed);
  else fine(k);
  return k.out;
}

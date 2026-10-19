// Where the band stops the cart: the green (V-050, revised at the Phase 3 playtest). Every
// buildable tile with enough land, wood and stone around it (`start`) is scored from the land
// alone: level, dry ground, fresh water a short walk off, and wood and stone to spare. The best
// is the first choice; the best at least `green.apart` tiles from it is the one the band moves
// to if the player sends the first back (once). Scores, not dice, so a seed always gives the
// same two spots and no stream is drawn.
import type { EngineContent } from '../core/index.ts';
import {
  countsAround,
  findStart,
  reachableAround,
  tileUses,
  type StartCounts,
} from './features.ts';

/** One choice of green, with what the band liked about it (the ledger line's words). */
export interface GreenChoice {
  x: number;
  y: number;
  /** Whether the land, wood and stone the `start` dials ask for are all within reach. */
  met: boolean;
  /** Metres of rise per tile step, on average, across the green's own ground. */
  rise: number;
  /** The share of the green's own ground that can be built on. */
  dry: number;
  /** Tiles to the nearest fresh water, by steps along rows and columns. */
  water: number;
  /** What lies within `start.radius` that the band can reach. */
  near: StartCounts;
}

/** Most candidates whose reach is flood-filled before the search settles for what it has. */
const MOST_FILLS = 400;

/** Steps along rows and columns from each tile to the nearest drinkable one (any ground between). */
function waterSteps(content: EngineContent, tiles: readonly number[], width: number): number[] {
  const out = new Array<number>(tiles.length).fill(Infinity);
  const queue: number[] = [];
  tiles.forEach((t, i) => {
    if (content.terrain.kinds[t]!.drinkable) {
      out[i] = 0;
      queue.push(i);
    }
  });
  for (let k = 0; k < queue.length; k += 1) {
    const i = queue[k]!;
    const x = i % width;
    for (const n of [x > 0 && i - 1, x < width - 1 && i + 1, i - width, i + width])
      if (n !== false && n >= 0 && n < tiles.length && out[n] === Infinity) {
        out[n] = out[i]! + 1;
        queue.push(n);
      }
  }
  return out;
}

/** Summed-area table of `value`, so any square's total is four look-ups. */
function table(value: (i: number) => number, width: number, height: number) {
  const w = width + 1;
  const s = new Float64Array(w * (height + 1));
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      s[(y + 1) * w + x + 1] =
        value(y * width + x) + s[y * w + x + 1]! + s[(y + 1) * w + x]! - s[y * w + x]!;
  return (x: number, y: number, r: number): [total: number, area: number] => {
    const [x0, y0] = [Math.max(0, x - r), Math.max(0, y - r)];
    const [x1, y1] = [Math.min(width, x + r + 1), Math.min(height, y + r + 1)];
    return [
      s[y1 * w + x1]! - s[y0 * w + x1]! - s[y1 * w + x0]! + s[y0 * w + x0]!,
      (x1 - x0) * (y1 - y0),
    ];
  };
}

/**
 * The band's first choice of green and, when there is one, its second: the best-scoring tile at
 * least `green.apart` tiles from the first. A tile scores its dry share, less its rise over
 * `green.rise` metres a step, less how far fresh water lies beyond `green.water` tiles (in units
 * of `green.water`), plus a little for wood and stone past what the band needs; ties go to the
 * tile nearer the middle, then the earlier tile. Only tiles at least `green.edge` from the map's
 * edge with enough land, wood and stone within reach can be chosen; if none has, `findStart`'s
 * tile (nearest the middle that has enough, else the best worst share, `met` false) and no second.
 */
export function findGreens(
  content: EngineContent,
  tiles: readonly number[],
  features: ArrayLike<number>,
  elevation: ArrayLike<number>,
  width: number,
  height: number,
): GreenChoice[] {
  const need = content.terrain.generator.start;
  const dials = need.green;
  const around = countsAround(content, tiles, features, width, height, need.radius);
  const reach = reachableAround(content, tiles, features, width, height, need.radius);
  const { buildable } = tileUses(content, tiles, features);
  const water = waterSteps(content, tiles, width);
  // Dry ground is ground that could be built on once cleared: trees and boulders do not count.
  const dry = table((i) => (content.terrain.kinds[tiles[i]!]!.buildable ? 1 : 0), width, height);
  const step = (i: number, j: number) => Math.abs(elevation[i]! - elevation[j]!);
  const rough = table(
    (i) =>
      (i % width < width - 1 ? step(i, i + 1) : 0) +
      (i + width < tiles.length ? step(i, i + width) : 0),
    width,
    height,
  );
  const [cx, cy] = [(width - 1) / 2, (height - 1) / 2];
  const middle = (i: number) => {
    const [dx, dy] = [(i % width) - cx, Math.floor(i / width) - cy];
    return dx * dx + dy * dy;
  };
  const land = (i: number) => {
    const [x, y] = [i % width, Math.floor(i / width)];
    const [built, area] = dry(x, y, dials.near);
    const [rise] = rough(x, y, dials.near);
    return { dry: built / area, rise: rise / (2 * area), water: water[i]! };
  };
  const scored: { i: number; score: number }[] = [];
  for (let i = 0; i < tiles.length; i += 1) {
    if (!buildable[i]) continue;
    const [x, y] = [i % width, Math.floor(i / width)];
    if (Math.min(x, y, width - 1 - x, height - 1 - y) < dials.edge) continue;
    const c = around(x, y);
    if (c.buildable < need.buildable || c.wood < need.wood || c.stone < need.stone) continue;
    const l = land(i);
    const spare = (n: number, of: number) => Math.min(n / of - 1, 2) / 2;
    const score =
      l.dry -
      l.rise / dials.rise -
      Math.max(0, l.water - dials.water) / dials.water -
      // Right on the bank floods and stays wet: two steps back is better.
      Math.max(0, 2 - l.water) / 2 +
      dials.spare * (spare(c.wood, need.wood) + spare(c.stone, need.stone));
    scored.push({ i, score });
  }
  scored.sort((a, b) => b.score - a.score || middle(a.i) - middle(b.i) || a.i - b.i);
  const choice = (i: number, met: boolean, near: StartCounts): GreenChoice => ({
    x: i % width,
    y: Math.floor(i / width),
    met,
    ...land(i),
    near,
  });
  const out: GreenChoice[] = [];
  for (const { i } of scored.slice(0, MOST_FILLS)) {
    const [x, y] = [i % width, Math.floor(i / width)];
    const first = out[0];
    if (first && Math.max(Math.abs(x - first.x), Math.abs(y - first.y)) < dials.apart) continue;
    const r = reach(x, y);
    if (r.buildable < need.buildable || r.wood < need.wood || r.stone < need.stone) continue;
    out.push(choice(i, true, r));
    if (out.length === 2) break;
  }
  if (!out.length) {
    // Nothing scored can reach enough: the old rule, nearest the middle (or best worst share).
    const s = findStart(content, tiles, features, width, height);
    out.push(choice(s.y * width + s.x, s.met, reach(s.x, s.y)));
  }
  return out;
}

/** The compass word for a step of (dx, dy), y growing south: a side when one leg is more than
 * twice the other, else a corner. Whole numbers only (V-006). */
function compass(dx: number, dy: number): string {
  const [ax, ay] = [Math.abs(dx), Math.abs(dy)];
  const ns = dy < 0 ? 'north' : 'south';
  const ew = dx < 0 ? 'west' : 'east';
  return ax > 2 * ay ? ew : ay > 2 * ax ? ns : `${ns}-${ew}`;
}

/** The `map.green` line's words for `at` (and, for a second look, how far it lies from `first`). */
export function greenWords(
  content: EngineContent,
  at: GreenChoice,
  first: GreenChoice,
): Record<string, string | number> {
  const dials = content.terrain.generator.start.green;
  const lie =
    at.rise < dials.rise / 2
      ? 'level'
      : at.rise < dials.rise
        ? 'gently sloping'
        : at.rise < 2 * dials.rise
          ? 'sloping'
          : 'steep';
  const wet = at.dry >= 0.95 ? 'dry' : at.dry >= 0.8 ? 'mostly dry' : 'damp';
  const water =
    at.water <= 1
      ? 'at the water’s edge'
      : at.water <= dials.water
        ? `${at.water} steps from fresh water`
        : `${at.water} steps from the nearest fresh water`;
  const [dx, dy] = [at.x - first.x, at.y - first.y];
  const dir = compass(dx, dy);
  return {
    ground: `${lie}, ${wet}`,
    water,
    wood: at.near.wood,
    stone: at.near.stone,
    tiles: Math.max(Math.abs(dx), Math.abs(dy)),
    dir,
  };
}

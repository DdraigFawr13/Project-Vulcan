// The pasture's row and shape (P5.4b, Phase 5 Bundle 3): a rectangle in wattle hurdles with a
// fold in one inside corner and a hay meadow beside it, all chosen by the colony (pasture.ts).
// The flock's life in it is src/engine/flock; this file is only where things are.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const PASTURE_TABLES: Schemas = {
  /** A pasture. `x`, `y`, `w`, `h`: the rectangle, hurdles included. `corner` (`nw` `ne` `sw`
   * `se`) is the inside corner that holds the `fold` by `fold` fold, walled from the rest by
   * hurdles on its two inner sides; `gate` and `foldGate` are the two gates' tile indices (the
   * outer one on a side, the fold's on its inner side). `mx`, `my`, `mw`, `mh`: the hay meadow
   * beside it; `rick` the tile the hay is stacked on, beside the fold outside the hurdles.
   * `state`: `plan` (hurdles planned), `built`, or `sent` (sent back; its ground is never
   * chosen again). `line` sited it, `last` is its latest line, `why` its reason, `sent` 1 for a
   * plan that replaced one sent back, `at` the tile its lines name. */
  pasture: {
    x: 'int',
    y: 'int',
    w: 'count',
    h: 'count',
    corner: 'text',
    fold: 'count',
    gate: 'int',
    foldGate: 'int',
    mx: 'int',
    my: 'int',
    mw: 'count',
    mh: 'count',
    rick: 'int',
    state: 'text',
    line: 'event',
    last: 'event',
    why: 'text',
    sent: 'count',
    at: 'int',
  },
};

export const pasturesOf = (world: WorldState): EntityRow[] => world.entities['pasture'] ?? [];

/** Pastures that stand or are planned (not sent back). */
export const livePastures = (world: WorldState): EntityRow[] =>
  pasturesOf(world).filter((p) => p['state'] !== 'sent');

const n = (p: EntityRow, k: string): number => p[k] as number;

/** The fold's inside tiles as [x, y] (`fold` by `fold`, one tile in from the corner). */
export function foldRect(p: EntityRow): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h, f] = [n(p, 'x'), n(p, 'y'), n(p, 'w'), n(p, 'h'), n(p, 'fold')];
  const corner = p['corner'] as string;
  const fx = corner.endsWith('w') ? x + 1 : x + w - 1 - f;
  const fy = corner.startsWith('n') ? y + 1 : y + h - 1 - f;
  return { x: fx, y: fy, w: f, h: f };
}

const within = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** Whether (x, y) is a tile of the fold's inner hurdles (the row and column beside the fold,
 * corner tile included). */
export function foldWall(p: EntityRow, x: number, y: number): boolean {
  const f = foldRect(p);
  const corner = p['corner'] as string;
  const wx = corner.endsWith('w') ? f.x + f.w : f.x - 1;
  const wy = corner.startsWith('n') ? f.y + f.h : f.y - 1;
  const xs = corner.endsWith('w') ? [f.x, wx] : [wx, f.x + f.w - 1];
  const ys = corner.startsWith('n') ? [f.y, wy] : [wy, f.y + f.h - 1];
  return (x === wx && y >= ys[0]! && y <= ys[1]!) || (y === wy && x >= xs[0]! && x <= xs[1]!);
}

/** Every hurdle tile with its part id: the rectangle's edge and the fold's inner sides; the
 * two gate tiles take `flock.pasture.gate`. */
export function hurdleTiles(
  content: EngineContent,
  width: number,
  p: EntityRow,
): { i: number; part: string }[] {
  const [x, y, w, h] = [n(p, 'x'), n(p, 'y'), n(p, 'w'), n(p, 'h')];
  const { hurdle, gate } = content.flock.pasture;
  const gates = new Set([n(p, 'gate'), n(p, 'foldGate')]);
  const out: { i: number; part: string }[] = [];
  for (let ty = y; ty < y + h; ty += 1)
    for (let tx = x; tx < x + w; tx += 1) {
      const edge = tx === x || ty === y || tx === x + w - 1 || ty === y + h - 1;
      if (!edge && !foldWall(p, tx, ty)) continue;
      const i = ty * width + tx;
      out.push({ i, part: gates.has(i) ? gate : hurdle });
    }
  return out;
}

/** The fold's tiles (map indices). */
export function foldTiles(width: number, p: EntityRow): number[] {
  const f = foldRect(p);
  const out: number[] = [];
  for (let ty = f.y; ty < f.y + f.h; ty += 1)
    for (let tx = f.x; tx < f.x + f.w; tx += 1) out.push(ty * width + tx);
  return out;
}

/** The tiles the flock grazes: inside the hurdles, neither fold nor fold hurdle. */
export function grazingTiles(width: number, p: EntityRow): number[] {
  const [x, y, w, h] = [n(p, 'x'), n(p, 'y'), n(p, 'w'), n(p, 'h')];
  const f = foldRect(p);
  const out: number[] = [];
  for (let ty = y + 1; ty < y + h - 1; ty += 1)
    for (let tx = x + 1; tx < x + w - 1; tx += 1)
      if (!within(f, tx, ty) && !foldWall(p, tx, ty)) out.push(ty * width + tx);
  return out;
}

/** The hay meadow's tiles (map indices). */
export function meadowTiles(width: number, p: EntityRow): number[] {
  const out: number[] = [];
  for (let ty = n(p, 'my'); ty < n(p, 'my') + n(p, 'mh'); ty += 1)
    for (let tx = n(p, 'mx'); tx < n(p, 'mx') + n(p, 'mw'); tx += 1) out.push(ty * width + tx);
  return out;
}

/** Whether (x, y) lies on the pasture's rectangle, its meadow or its rick: ground no other
 * building, field or path plan may take. */
export function onPastureGround(p: EntityRow, width: number, x: number, y: number): boolean {
  return (
    within({ x: n(p, 'x'), y: n(p, 'y'), w: n(p, 'w'), h: n(p, 'h') }, x, y) ||
    within({ x: n(p, 'mx'), y: n(p, 'my'), w: n(p, 'mw'), h: n(p, 'mh') }, x, y) ||
    y * width + x === n(p, 'rick')
  );
}

/** Every tile (map index) of the pasture's rectangle, meadow and rick. */
export function pastureTiles(p: EntityRow, width: number): number[] {
  const out: number[] = [];
  const [x, y, w, h] = [n(p, 'x'), n(p, 'y'), n(p, 'w'), n(p, 'h')];
  for (let ty = y; ty < y + h; ty += 1)
    for (let tx = x; tx < x + w; tx += 1) out.push(ty * width + tx);
  return [...out, ...meadowTiles(width, p), n(p, 'rick')];
}

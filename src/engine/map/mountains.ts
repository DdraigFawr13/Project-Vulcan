// Mountains: a handful of massifs of different sizes, most on the valley's rims and a few standing
// inside it, each of one rock. Dials in terrain.json `generator.layouts`, the
// one named by `generator.layout`: `valley` keeps them on the rims, `highlands` also inside.
import type { RngStream, TerrainDef } from '../core/index.ts';
import { AXES, bake, fractalNoise } from './noise.ts';

interface Massif {
  x: number;
  y: number;
  /** Radius squared, in tiles. */
  r2: number;
  /** Its long axis, and how many times longer than wide it is. */
  ux: number;
  uy: number;
  s2: number;
  height: number;
  rock: string;
}

export interface Mountains {
  /** Metres each tile is raised. */
  lift: number[];
  /** The rock kind id of the massif a tile belongs to, or '' outside every massif. */
  rock: string[];
  count: number;
}

/**
 * Places `count` massifs: a `rimShare` of them across the axis at `rim` (a share of the half
 * map) on either side, the rest within the valley, anywhere along it. Each is a dome of its
 * drawn radius (its width) and height, stretched up to `stretch` times along one of 16 axes
 * into a range, `(1 - q)²` with q its squared distance over radius squared (no square roots),
 * bent by a warp field and roughened by the ridged field so its slopes have spurs; a tile belongs to the massif it is deepest inside.
 */
export function raiseMountains(
  rng: RngStream,
  gen: TerrainDef['generator'],
  width: number,
  height: number,
  axis: readonly [number, number],
  ridged: readonly number[],
): Mountains {
  const m = gen.layouts[gen.layout];
  if (!m) throw new Error(`Mountain layout "${gen.layout}" is not in terrain.json.`);
  const [ax, ay] = axis;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const half = Math.min(width, height) / 2;
  const count = rng.between(m.count[0]!, m.count[1]!);
  const massifs: Massif[] = [];
  for (let k = 0; k < count; k += 1) {
    const along = rng.between(-100, 100) / 100;
    const onRim = rng.chance(m.rimShare);
    const side = rng.chance(0.5) ? 1 : -1;
    const across = onRim
      ? side * (rng.between(Math.round(m.rim[0]! * 100), Math.round(m.rim[1]! * 100)) / 100)
      : rng.between(-m.inside * 100, m.inside * 100) / 100;
    const radius = rng.between(m.radius[0]!, m.radius[1]!);
    const [ux, uy] = m.align > 0 && rng.chance(m.align) ? axis : rng.pick(AXES);
    const stretch = rng.between(m.stretch[0]! * 10, m.stretch[1]! * 10) / 10;
    massifs.push({
      x: cx + (along * ax + across * ay) * half,
      y: cy + (along * ay - across * ax) * half,
      r2: radius * radius,
      ux,
      uy,
      s2: stretch * stretch,
      height: rng.between(m.height[0]!, m.height[1]!),
      rock: rng.weighted(gen.rocks.map((r) => [r.kind, Math.round(r.weight * 10)] as const)),
    });
  }
  // A warp field bends every outline, so no massif is a clean oval.
  const warp = bake(fractalNoise(rng, width, height, m.warpCell, 2), width, height);
  const lift = new Array<number>(width * height).fill(0);
  const rock = new Array<string>(width * height).fill('');
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      let deepest = 1;
      for (const massif of massifs) {
        const dx = x - massif.x;
        const dy = y - massif.y;
        const along = dx * massif.ux + dy * massif.uy;
        const across = dx * massif.uy - dy * massif.ux;
        const q =
          ((along * along) / massif.s2 + across * across) /
          massif.r2 /
          (1 - m.warp / 2 + m.warp * warp[i]!);
        if (q >= 1) continue;
        const dome = (1 - q) * (1 - q);
        lift[i] = Math.max(
          lift[i]!,
          massif.height * dome * (m.rough[0]! + m.rough[1]! * ridged[i]!),
        );
        if (q < deepest) {
          deepest = q;
          rock[i] = massif.rock;
        }
      }
    }
  return { lift, rock, count };
}

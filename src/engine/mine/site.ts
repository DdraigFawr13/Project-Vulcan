// Siting a shaft (V-087): by the nearest stain of the metal past the town ring (within
// `work.mine.near` tiles of it), on dry, level, open ground the band can walk to from the green.
import { dirFrom, greenOf, planAt, ringOf } from '../build/index.ts';
import type { EngineContent, WorldState } from '../core/index.ts';
import { reachFrom, walkAt } from '../paths/index.ts';
import { shaftsOf } from './shafts.ts';

/** How far from a plan sent back (tiles) the next one must lie. */
export const AVOID = 6;

export interface ShaftSite {
  x: number;
  y: number;
  /** Tiles from the green (the larger of the two offsets). */
  far: number;
  dir: string;
}

/** Ground whose walking multiplier is the plain one: not water, marsh, scree or snow. */
const plain = (content: EngineContent, world: WorldState, i: number): boolean =>
  walkAt(content, world.map, 0, i) === 1;

/** The tile for a shaft after `metal`'s stain, or undefined when none qualifies. Tiles within
 * `AVOID` tiles of a shaft plan sent back are left out. Ties go to the lower tile index. */
export function siteShaft(
  world: WorldState,
  content: EngineContent,
  metal: string,
): ShaftSite | undefined {
  const map = world.map;
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  if (!f) return undefined;
  const green = greenOf(world);
  const ring = ringOf(world, content);
  const reach = reachFrom(content, map, green);
  const sent = shaftsOf(world).filter((s) => s['state'] === 'sent' && s['metal'] === metal);
  const shaft = content.terrain.kinds.findIndex(
    (k) => k.id === content.terrain.generator.underground.shaft,
  );
  let best: ShaftSite | undefined;
  let score = Infinity;
  const near = content.work.mine.near;
  const stained = (x: number, y: number): boolean => {
    for (let dy = -near; dy <= near; dy += 1)
      for (let dx = -near; dx <= near; dx += 1) {
        const [sx, sy] = [x + dx, y + dy];
        if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) continue;
        if (map.stains[sy * map.width + sx] === f) return true;
      }
    return false;
  };
  for (let i = 0; i < map.stains.length; i += 1) {
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    const far = Math.max(Math.abs(x - green.x), Math.abs(y - green.y));
    const s = far * 1000000 + i;
    if (far <= ring || s >= score || !stained(x, y)) continue;
    if (
      sent.some(
        (o) =>
          Math.max(Math.abs((o['x'] as number) - x), Math.abs((o['y'] as number) - y)) <= AVOID,
      )
    )
      continue;
    if (!plain(content, world, i) || map.tiles[i] === shaft) continue;
    if (map.features[i] || map.built[i] || planAt(world, x, y)) continue;
    if (shaftsOf(world).some((o) => o['x'] === x && o['y'] === y && o['state'] !== 'sent'))
      continue;
    if (!reach({ x, y, z: 0 })) continue;
    [best, score] = [{ x, y, far, dir: dirFrom(green, { x, y, w: 1, h: 1 }) }, s];
  }
  return best;
}

/** Whether a reached level holds a known vein tile of `metal` that someone standing on the
 * surface at the green could get beside. */
export function openVein(world: WorldState, content: EngineContent, metal: string): boolean {
  const map = world.map;
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  const level = content.features[f - 1]?.vein?.level ?? 0;
  const layer = map.levels[level - 1];
  if (!f || !layer) return false;
  const reach = reachFrom(content, map, greenOf(world));
  for (let i = 0; i < layer.features.length; i += 1) {
    if (layer.features[i] !== f || !layer.known[i]) continue;
    const [x, y] = [i % map.width, Math.floor(i / map.width)];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const [sx, sy] = [x + dx, y + dy];
      if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) continue;
      if (walkAt(content, map, level, sy * map.width + sx) && reach({ x: sx, y: sy, z: level }))
        return true;
    }
  }
  return false;
}

// Siting a shaft (V-087): by the nearest stain of the metal past the town ring (within
// `work.mine.near` tiles of it), on dry, level, open ground the band can walk to from the green.
import { dirFrom, greenOf, planAt, ringOf } from '../build/index.ts';
import type { EngineContent, WorldState } from '../core/index.ts';
import { besideReachable, reachFrom, walkAt } from '../paths/index.ts';
import { GONE, shaftsOf } from './shafts.ts';

export interface ShaftSite {
  x: number;
  y: number;
  /** Tiles from the green (the larger of the two offsets). */
  far: number;
  dir: string;
}

/** Ground that can be walked at no more than `work.mine.walk` times the plain pace: not water,
 * marsh, scree or snow. */
const plain = (content: EngineContent, world: WorldState, i: number): boolean => {
  const walk = walkAt(content, world.map, 0, i);
  return walk > 0 && walk <= content.work.mine.walk;
};

/** The tile for a shaft after `metal`'s stain, or undefined when none qualifies. Tiles within
 * `work.mine.avoid` tiles of a shaft plan sent back or a shaft spent are left out. Ties go to the
 * lower tile index. */
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
  const gone = shaftsOf(world).filter(
    (s) => GONE.includes(s['state'] as string) && s['metal'] === metal,
  );
  const shaft = content.terrain.kinds.findIndex(
    (k) => k.id === content.terrain.generator.underground.shaft,
  );
  let best: ShaftSite | undefined;
  let score = Infinity;
  const { near, avoid } = content.work.mine;
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
      gone.some(
        (o) =>
          Math.max(Math.abs((o['x'] as number) - x), Math.abs((o['y'] as number) - y)) <= avoid,
      )
    )
      continue;
    if (!plain(content, world, i) || map.tiles[i] === shaft) continue;
    if (map.features[i] || map.built[i] || planAt(world, x, y)) continue;
    if (
      shaftsOf(world).some(
        (o) => o['x'] === x && o['y'] === y && !GONE.includes(o['state'] as string),
      )
    )
      continue;
    if (!reach({ x, y, z: 0 })) continue;
    [best, score] = [{ x, y, far, dir: dirFrom(green, { x, y, w: 1, h: 1 }) }, s];
  }
  return best;
}

/** Whether a tile of the vein level is a tile of the vein `f` (a feature index) that someone who
 * can reach what `reach` says can get beside. The one rule for an open vein that can feed a
 * metal (V-087): veins glint through the fog once their level is reached (V-030, V-094), so the
 * tile need not be known. */
export function veinOpen(
  world: WorldState,
  content: EngineContent,
  reach: (to: { x: number; y: number; z: number }) => boolean,
  f: number,
  i: number,
): boolean {
  const z = content.features[f - 1]?.vein?.level ?? 0;
  const layer = world.map.levels[z - 1];
  return !!layer && layer.features[i] === f && besideReachable(world, content, reach, i, z);
}

/** Whether a reached level holds a vein tile of `metal` that someone standing on the surface at
 * the green could get beside. */
export function openVein(world: WorldState, content: EngineContent, metal: string): boolean {
  const map = world.map;
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  const layer = map.levels[(content.features[f - 1]?.vein?.level ?? 0) - 1];
  if (!f || !layer) return false;
  const reach = reachFrom(content, map, greenOf(world));
  for (let i = 0; i < layer.features.length; i += 1)
    if (veinOpen(world, content, reach, f, i)) return true;
  return false;
}

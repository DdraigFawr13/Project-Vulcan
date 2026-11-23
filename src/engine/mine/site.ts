// Siting a shaft (V-215, amends V-087): beside a seam someone has found in a rock face, within
// `work.mine.near` tiles of it, on dry, level, open ground the band can walk to from the green.
// Nothing marks the ground: with no seam of the metal found, no shaft is planned.
import { dirFrom, greenOf, planAt } from '../build/index.ts';
import type { EngineContent, Place, WorldState } from '../core/index.ts';
import { besideReachable, reachFrom, walkAt } from '../paths/index.ts';
import { GONE, shaftsOf } from './shafts.ts';

export interface ShaftSite {
  x: number;
  y: number;
  /** Tiles from the green (the larger of the two offsets). */
  far: number;
  dir: string;
  /** The found seam it is sited by. */
  seam: Place;
}

/** Tiles apart, the larger of the two offsets. */
export const cheb = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** The seams of `metal` someone has found (places with its feature id and a line). */
export const seamsOf = (world: WorldState, metal: string): Place[] =>
  world.map.places.filter((p) => p.what === metal && p.line > 0);

/** Ground that can be walked at no more than `work.mine.walk` times the plain pace: not water,
 * marsh, scree or snow. */
const plain = (content: EngineContent, world: WorldState, i: number): boolean => {
  const walk = walkAt(content, world.map, 0, i);
  return walk > 0 && walk <= content.work.mine.walk;
};

/** The found seams of `metal` still to be worked: none within `work.mine.avoid` tiles of a plan
 * sent back or a shaft spent; nearest the green first, then the earlier found. */
export function liveSeams(world: WorldState, content: EngineContent, metal: string): Place[] {
  const gone = shaftsOf(world).filter(
    (s) => GONE.includes(s['state'] as string) && s['metal'] === metal,
  );
  const g = greenOf(world);
  return seamsOf(world, metal)
    .filter(
      (p) =>
        !gone.some(
          (o) => cheb(o['x'] as number, o['y'] as number, p.x, p.y) <= content.work.mine.avoid,
        ),
    )
    .sort((a, b) => cheb(a.x, a.y, g.x, g.y) - cheb(b.x, b.y, g.x, g.y) || a.tick - b.tick);
}

/** The tile for a shaft by a found seam of `metal`, or undefined when none qualifies: the
 * nearest seam first. */
export function siteShaft(
  world: WorldState,
  content: EngineContent,
  metal: string,
): ShaftSite | undefined {
  for (const seam of liveSeams(world, content, metal)) {
    const site = siteBy(world, content, seam);
    if (site) return site;
  }
  return undefined;
}

/** The free tile nearest `seam`'s face within `work.mine.near` (ties to the lower tile): plain,
 * dry ground with nothing on it, reachable from the green. */
export function siteBy(
  world: WorldState,
  content: EngineContent,
  seam: Place,
): ShaftSite | undefined {
  const map = world.map;
  const green = greenOf(world);
  const reach = reachFrom(content, map, green);
  const shaft = content.terrain.kinds.findIndex(
    (k) => k.id === content.terrain.generator.underground.shaft,
  );
  const live = shaftsOf(world).filter((o) => !GONE.includes(o['state'] as string));
  const free = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const i = y * map.width + x;
    if (!plain(content, world, i) || map.tiles[i] === shaft) return false;
    if (map.features[i] || map.built[i] || planAt(world, x, y)) return false;
    if (live.some((o) => o['x'] === x && o['y'] === y)) return false;
    return reach({ x, y, z: 0 });
  };
  for (let r = 1; r <= content.work.mine.near; r += 1)
    for (let y = seam.y - r; y <= seam.y + r; y += 1)
      for (let x = seam.x - r; x <= seam.x + r; x += 1) {
        if (cheb(x, y, seam.x, seam.y) !== r || !free(x, y)) continue;
        const far = cheb(x, y, green.x, green.y);
        return { x, y, far, dir: dirFrom(green, { x, y, w: 1, h: 1 }), seam };
      }
  return undefined;
}

/** Whether a tile of the vein level is a known tile of the vein `f` (a feature index) that
 * someone who can reach what `reach` says can get beside. The one rule for an open vein that can
 * feed a metal (V-087): a vein stays dark until a tunnel passes beside it (V-215). */
export function veinOpen(
  world: WorldState,
  content: EngineContent,
  reach: (to: { x: number; y: number; z: number }) => boolean,
  f: number,
  i: number,
): boolean {
  const z = content.features[f - 1]?.vein?.level ?? 0;
  const layer = world.map.levels[z - 1];
  return (
    !!layer &&
    layer.features[i] === f &&
    layer.known[i] === 1 &&
    besideReachable(world, content, reach, i, z)
  );
}

/** Whether a reached level holds a known vein tile of `metal` that someone standing on the
 * surface at the green could get beside. */
export function openVein(world: WorldState, content: EngineContent, metal: string): boolean {
  const map = world.map;
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  const layer = map.levels[(content.features[f - 1]?.vein?.level ?? 0) - 1];
  if (!f || !layer) return false;
  const reach = reachFrom(content, map, greenOf(world));
  for (let i = 0; i < layer.features.length; i += 1)
    if (layer.features[i] === f && layer.known[i] === 1 && veinOpen(world, content, reach, f, i))
      return true;
  return false;
}

/** The vein tiles of `metal` the colony knows lie behind its found seams (within a tile of each
 * seam's face, on the vein's level): what a tunnel from a seam's shaft makes for. */
export function seamTiles(world: WorldState, content: EngineContent, metal: string): Set<number> {
  const map = world.map;
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  const layer = map.levels[(content.features[f - 1]?.vein?.level ?? 0) - 1];
  const out = new Set<number>();
  if (!f || !layer) return out;
  for (const seam of liveSeams(world, content, metal))
    for (let dy = -1; dy <= 1; dy += 1)
      for (let dx = -1; dx <= 1; dx += 1) {
        const [x, y] = [seam.x + dx, seam.y + dy];
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (layer.features[y * map.width + x] === f) out.add(y * map.width + x);
      }
  return out;
}

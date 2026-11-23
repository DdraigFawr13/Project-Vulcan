// Planting a found seam (tests and debug only): the nearest face over a seam of `metal` that the
// band can get beside and a shaft can be sited by, marked found as if someone had spotted it, its line `line`. Faces within
// `work.mine.avoid` of a seam already found are passed over, so a second call plants another.
import type { EngineContent, Place, WorldState } from '../core/index.ts';
import { greenOf } from '../build/index.ts';
import { reachFrom, walkAt } from '../paths/index.ts';
import { seamsOf, siteBy } from './site.ts';

const cheb = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export function plantSeam(
  world: WorldState,
  content: EngineContent,
  metal: string,
  line = world.begunEvent,
): Place | undefined {
  const map = world.map;
  const f = content.features.findIndex((d) => d.id === metal) + 1;
  const g = greenOf(world);
  const reach = reachFrom(content, map, g);
  const found = seamsOf(world, metal);
  const faces: number[] = [];
  map.faces.forEach((v, i) => (v & 127) === 1 + f && faces.push(i));
  const at = (i: number): [number, number] => [i % map.width, Math.floor(i / map.width)];
  faces.sort((a, b) => cheb(...at(a), g.x, g.y) - cheb(...at(b), g.x, g.y) || a - b);
  for (const i of faces) {
    const [x, y] = at(i);
    if (found.some((s) => cheb(s.x, s.y, x, y) <= content.work.mine.avoid)) continue;
    const side = [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ].some(([dx, dy]) => {
      const j = (y + dy!) * map.width + x + dx!;
      return walkAt(content, map, 0, j) > 0 && reach({ x: x + dx!, y: y + dy!, z: 0 });
    });
    if (!side) continue;
    const place: Place = { kind: 'seam', x, y, by: 0, line, tick: world.tick, what: metal };
    map.places.push(place);
    // One a shaft can be sited by: on dry, level ground beside it.
    if (siteBy(world, content, place)) return place;
    map.places.pop();
  }
  return undefined;
}

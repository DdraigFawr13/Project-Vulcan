// Ground and words the wild system shares: where an animal may stand, and how a place, a count of
// game and a name read in a line.
import type { EngineContent, MapState, WorldState } from '../core/index.ts';
import { dirFrom, greenOf } from '../build/index.ts';
import { walkAt } from '../paths/index.ts';
import { valleyOf } from '../region/index.ts';
import { animalsOf, herdsOf } from './wild.ts';

/** Open ground an animal may stand on: walkable, and never water (frozen or not). */
export const openAt = (content: EngineContent, map: MapState, i: number): boolean =>
  walkAt(content, map, 0, i) > 0 && !content.terrain.kinds[map.tiles[i]!]!.water;

/** The larger of the two axes' distances: the tile distance everything here uses. */
export const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** The first tile within `r` of (x, y), nearest ring first, that is open and passes `ok`. */
export function openNear(
  content: EngineContent,
  map: MapState,
  x: number,
  y: number,
  r: number,
  ok: (i: number) => boolean = () => true,
): number | undefined {
  for (let ring = 0; ring <= r; ring += 1)
    for (let dy = -ring; dy <= ring; dy += 1)
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const [tx, ty] = [x + dx, y + dy];
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        const i = ty * map.width + tx;
        if (openAt(content, map, i) && ok(i)) return i;
      }
  return undefined;
}

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const listOf = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** The valley's name, or "the valley" on a plain seed. */
export const valleyName = (world: WorldState, content: EngineContent): string =>
  valleyOf(world.seed, content)?.valley.name ?? 'the valley';

/** Where a tile is, in words: its ground and the way from the green ("in the woods to the north"). */
export function whereWords(
  world: WorldState,
  content: EngineContent,
  x: number,
  y: number,
): string {
  const biome = content.biomes.biomes[world.map.biomes[y * world.map.width + x]!]!.id;
  const ground = content.wild.where[biome] ?? content.wild.where['default']!;
  return `${ground} to the ${dirFrom(greenOf(world), { x, y, w: 1, h: 1 })}`;
}

/** Live animals of each game species, by species id. */
export function gameCounts(world: WorldState): Map<string, number> {
  const species = new Map(herdsOf(world).map((h) => [h.id, h['species'] as string]));
  const counts = new Map<string, number>();
  for (const a of animalsOf(world)) {
    const s = species.get(a['herd'] as number);
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return counts;
}

/** The game in words: "4 deer and 9 hares" (species in content order; none gives ''). */
export function gameWords(world: WorldState, content: EngineContent): string {
  const counts = gameCounts(world);
  return listOf(
    content.wild.species.flatMap((s) => {
      const n = counts.get(s.id) ?? 0;
      return n ? [`${n} ${n === 1 ? s.name : s.plural}`] : [];
    }),
  );
}

/** The valley's game in the pack's units: each species' animals over its `perGame`. */
export function valleyGame(world: WorldState, content: EngineContent): number {
  const counts = gameCounts(world);
  return content.wild.species.reduce((sum, s) => sum + (counts.get(s.id) ?? 0) / s.perGame, 0);
}

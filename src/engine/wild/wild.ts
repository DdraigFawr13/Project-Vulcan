// The wild valley's tables and what others may ask of them (P5.4a, V-110, V-111, V-122): game
// herds, the one predator pack, and the animals of both as rows. Nothing here targets an animal:
// people meet them only by sight (flight) and through the hunting the Food plate pulls (V-041).
import type { EngineContent, EntityRow, SpeciesDef, WorldState } from '../core/index.ts';
import { entityOf, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const WILD_TABLES: Schemas = {
  /** A herd of game on a home range: `x`, `y` and `radius` are the range's centre and reach; `start`
   * its starting size; `line` its latest line (the cause of the next one about it); `taken` what
   * people took this year, `lost` what the pack and the snow took (`byPack` and `bySnow` split it);
   * `low` the `wild.herdLow` line while the herd is below `wild.low` per cent of its start. */
  herd: {
    species: 'text',
    x: 'int',
    y: 'int',
    radius: 'count',
    start: 'count',
    line: 'event',
    taken: 'count',
    lost: 'count',
    byPack: 'count',
    bySnow: 'count',
    low: 'event',
  },
  /** One animal. `herd` is its herd (0 for the pack's), `pack` the pack's id (0 for game); `kind`
   * the art kind; `path` the tiles it will step to (map indices); `stride` 0 or 1, flipped each
   * step; `facing` `e` or `w`; `state` `''` or `flee`, until tick `until`. */
  animal: {
    herd: 'entity',
    pack: 'entity',
    kind: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    path: 'ints',
    stride: 'count',
    facing: 'text',
    state: 'text',
    until: 'int',
  },
  /** The valley's one pack (`size` 0 once it has left). `hunger` is days since its last meal,
   * `lastKill` the tick of it, `line` its latest line, `attacked` the line of its last attack on a
   * person (0 for none) and `attacks` how many; `visits` the nights at the town's edge, `visitAt`
   * the tick the last began, `visiting` 1 until dawn, `shown` 1 once the edge line is written, and
   * `hungryLine` the latest `wild.packHungry`. */
  pack: {
    species: 'text',
    name: 'text',
    size: 'count',
    denX: 'int',
    denY: 'int',
    hunger: 'count',
    lastKill: 'int',
    line: 'event',
    attacked: 'event',
    attacks: 'count',
    visits: 'count',
    visitAt: 'int',
    visiting: 'count',
    shown: 'count',
    hungryLine: 'event',
  },
};

export const herdsOf = (world: WorldState): EntityRow[] => world.entities['herd'] ?? [];
export const animalsOf = (world: WorldState): EntityRow[] => world.entities['animal'] ?? [];
export const herdOf = (world: WorldState, id: number): EntityRow | undefined =>
  entityOf(world, 'herd', id);

/** The valley's pack while it is there (size above 0), else undefined. */
export function packOf(world: WorldState): EntityRow | undefined {
  const pack = world.entities['pack']?.[0];
  return pack && pack['size'] ? pack : undefined;
}

/** The pack's row even when it has left (it keeps its history). */
export const packRow = (world: WorldState): EntityRow | undefined => world.entities['pack']?.[0];

/** The wolf and bear rows within `r` tiles (the larger of the two axes' distance) of (x, y). */
export const predatorsNear = (world: WorldState, x: number, y: number, r: number): EntityRow[] =>
  animalsOf(world).filter(
    (a) =>
      a['pack'] !== 0 &&
      Math.max(Math.abs((a['x'] as number) - x), Math.abs((a['y'] as number) - y)) <= r,
  );

/** The animals of a herd, by id. */
export const membersOf = (world: WorldState, herd: number): EntityRow[] =>
  animalsOf(world).filter((a) => a['herd'] === herd);

export const speciesOf = (content: EngineContent, id: string): SpeciesDef =>
  content.wild.species.find((s) => s.id === id)!;

/** Hunters leave each herd this many (content `wild.spare`). */
export const spareCount = (content: EngineContent): number => content.wild.spare;

/** Herds with more animals than hunters spare, the largest first (ties by id). */
export function huntable(world: WorldState, content: EngineContent): EntityRow[] {
  const size = new Map<number, number>();
  for (const a of animalsOf(world))
    size.set(a['herd'] as number, (size.get(a['herd'] as number) ?? 0) + 1);
  return herdsOf(world)
    .filter((h) => (size.get(h.id) ?? 0) > spareCount(content))
    .sort((a, b) => (size.get(b.id) ?? 0) - (size.get(a.id) ?? 0) || a.id - b.id);
}

/** The pack attacked someone: `line` is the attack's line, kept for the pack's later lines. */
export function markAttack(ctx: SystemContext, line: number): void {
  const pack = packRow(ctx.world);
  if (!pack) return;
  pack['attacked'] = line;
  pack['attacks'] = (pack['attacks'] as number) + 1;
  pack['line'] = line;
}

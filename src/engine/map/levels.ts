// Reaching the levels below (DECISIONS V-014): a level is made the first time stairs or a shaft
// reach it, under a ledger line citing what reached it. Until colonists can dig (stairs in
// Phase 3, mining in Phase 4), two test levers cut stairs and sink shafts at once; later
// milestones keep these orders and give the digging to colonists.
import type { Command, EngineContent, LevelState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { chunksAcross, chunksDown, layerOf, setTile } from './tiles.ts';
import { makeLevel } from './underground.ts';

const levelName = (z: number): string => (z === 0 ? 'the surface' : `level ${z}`);

/** Makes level `z` if nobody has reached it yet, under a `map.levelReached` line citing `cause`. */
export function reachLevel(ctx: SystemContext, z: number, cause: number): void {
  const map = ctx.world.map;
  if (map.levels[z - 1]) return;
  const made = makeLevel(ctx.world.seed, ctx.content, map, z);
  const reached = ctx.emit('map.levelReached', {
    causes: [cause],
    data: { level: z, contents: contentsOf(ctx.content, made, z) },
  });
  const level: LevelState = {
    tiles: made.tiles,
    features: made.features,
    tileCauses: new Int32Array(map.width * map.height).fill(reached),
    chunkVersions: new Array<number>(chunksAcross(map) * chunksDown(map)).fill(1),
  };
  map.levels[z - 1] = level;
}

/** The new level in a few words for its ledger line: its main rocks and what lies in them. */
function contentsOf(
  content: EngineContent,
  made: { tiles: Uint8Array; features: Uint8Array },
  z: number,
): string {
  const { kinds } = content.terrain;
  const counts = new Map<number, number>();
  for (const t of made.tiles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([t]) => kinds[t]!);
  const rocks = ranked.filter((k) => k.stone).slice(0, 3);
  const ground = ranked.filter(
    (k) => !k.stone && k.id !== content.terrain.generator.underground.caves.kind,
  );
  const ores = content.features.filter((f) => f.vein?.level === z).map((f) => f.id);
  const list = (names: readonly string[]): string =>
    names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const parts = [`${list(rocks.map((k) => k.name))} bedrock`];
  if (ground.length) parts.push(list(ground.map((k) => k.name)));
  if (ores.length) parts.push(`${list(ores)} in the rock`);
  return parts.join('; ');
}

/** The test levers' orders, handled by the map system. A refused order leaves a line saying why. */
export const digCommands: Readonly<
  Record<string, (ctx: SystemContext, command: Command, cause: number) => void>
> = {
  cutStairs(ctx, command, cause) {
    const at = placeOf(ctx, command, 'stairs', cause);
    if (!at) return;
    const { x, y, z } = at;
    const dials = ctx.content.terrain.generator.underground;
    const kind = (id: string): number => ctx.content.terrain.kinds.findIndex((k) => k.id === id);
    const cut = ctx.emit('map.stairsCut', {
      causes: [cause],
      data: { x, y, from: levelName(z), to: levelName(z + 1) },
    });
    reachLevel(ctx, z + 1, cut);
    const map = ctx.world.map;
    const i = y * map.width + x;
    // Stairs that meet stairs already there join them into one flight.
    const top =
      layerOf(map, z)!.tiles[i] === kind(dials.stairsUp) ? dials.stairs : dials.stairsDown;
    const under = ctx.content.terrain.kinds[layerOf(map, z + 1)!.tiles[i]!]!.id;
    const landing =
      under === dials.shaft
        ? dials.shaft
        : under === dials.stairsDown || under === dials.stairs
          ? dials.stairs
          : dials.stairsUp;
    setTile(ctx, x, y, kind(top), cut, z);
    setTile(ctx, x, y, kind(landing), cut, z + 1);
  },
  sinkShaft(ctx, command, cause) {
    const at = placeOf(ctx, command, 'shaft', cause);
    if (!at) return;
    const { x, y, z } = at;
    const depth = ctx.content.terrain.generator.underground.depth;
    const to = Number(command.data['to'] ?? z + 1);
    if (!Number.isInteger(to) || to <= z || to > depth) {
      refuse(ctx, cause, 'shaft', x, y, `it can reach levels ${z + 1} to ${depth}`);
      return;
    }
    const shaft = ctx.content.terrain.kinds.findIndex(
      (k) => k.id === ctx.content.terrain.generator.underground.shaft,
    );
    const sunk = ctx.emit('map.shaftSunk', {
      causes: [cause],
      data: { x, y, from: levelName(z), to: levelName(to) },
    });
    for (let level = z + 1; level <= to; level += 1) reachLevel(ctx, level, sunk);
    for (let level = z; level <= to; level += 1) setTile(ctx, x, y, shaft, sunk, level);
  },
};

/** The tile an order names, or undefined after a refusal line when it cannot be dug there. */
function placeOf(
  ctx: SystemContext,
  command: Command,
  work: string,
  cause: number,
): { x: number; y: number; z: number } | undefined {
  const map = ctx.world.map;
  const { x, y, z = 0 } = command.data as { x?: number; y?: number; z?: number };
  const depth = ctx.content.terrain.generator.underground.depth;
  if (
    ![x, y, z].every(Number.isInteger) ||
    x! < 0 ||
    y! < 0 ||
    x! >= map.width ||
    y! >= map.height
  ) {
    refuse(ctx, cause, work, x ?? -1, y ?? -1, 'that is not a tile of the map');
    return undefined;
  }
  const layer = z! >= 0 && z! < depth ? layerOf(map, z!) : undefined;
  if (!layer) {
    refuse(
      ctx,
      cause,
      work,
      x!,
      y!,
      `nothing can be dug down from ${z! >= depth ? 'the deepest level' : 'a level not yet reached'}`,
    );
    return undefined;
  }
  const i = y! * map.width + x!;
  const dials = ctx.content.terrain.generator.underground;
  const here = ctx.content.terrain.kinds[layer.tiles[i]!]!;
  if (here.water) return refuse(ctx, cause, work, x!, y!, 'the tile is under water');
  if ([dials.stairsDown, dials.stairs, dials.shaft].includes(here.id))
    return refuse(ctx, cause, work, x!, y!, 'a way down is already there');
  const feature = layer.features[i]! > 0 ? ctx.content.features[layer.features[i]! - 1] : undefined;
  if (z === 0 && feature?.blocks)
    return refuse(ctx, cause, work, x!, y!, `${feature.name} stands there`);
  return { x: x!, y: y!, z: z! };
}

function refuse(
  ctx: SystemContext,
  cause: number,
  work: string,
  x: number,
  y: number,
  reason: string,
): undefined {
  ctx.emit('map.digRefused', { causes: [cause], data: { work, x, y, reason } });
  return undefined;
}

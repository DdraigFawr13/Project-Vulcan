// Reaching the levels below (DECISIONS V-014): a level is made the first time stairs or a shaft
// reach it, under a ledger line citing what reached it. Until colonists can dig (stairs in
// Phase 3, mining in Phase 4), two test levers cut stairs and sink shafts at once; later
// milestones keep these orders and give the digging to colonists.
import type { Command, EngineContent, LevelState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import {
  CHUNK,
  chunksAcross,
  chunksDown,
  diggable,
  layerOf,
  raiseChunk,
  setTile,
} from './tiles.ts';
import { placesOf } from './aura.ts';
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
    known: new Uint8Array(map.width * map.height),
    tileCauses: new Int32Array(map.width * map.height).fill(reached),
    chunkVersions: new Array<number>(chunksAcross(map) * chunksDown(map)).fill(1),
  };
  map.levels[z - 1] = level;
  if (made.spot) {
    map.auraSpots.push(made.spot);
    ctx.emit('map.auraDeep', {
      causes: [reached],
      data: { level: z, places: placesOf(ctx.content, [made.spot]) },
    });
  }
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

/** Cuts stairs down from (x, y) on level `z`, reaching the level below if nobody has, under a
 * `map.stairsCut` line citing `cause`: the test order, or since P3.2 the stair a colonist built. */
export function cutStairsAt(
  ctx: SystemContext,
  x: number,
  y: number,
  z: number,
  cause: number,
): void {
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
  const top = layerOf(map, z)!.tiles[i] === kind(dials.stairsUp) ? dials.stairs : dials.stairsDown;
  const under = ctx.content.terrain.kinds[layerOf(map, z + 1)!.tiles[i]!]!.id;
  const landing =
    under === dials.shaft
      ? dials.shaft
      : under === dials.stairsDown || under === dials.stairs
        ? dials.stairs
        : dials.stairsUp;
  setTile(ctx, x, y, kind(top), cut, z);
  setTile(ctx, x, y, kind(landing), cut, z + 1);
  openAround(ctx, x, y, z + 1, cut);
}

/** The test levers' orders, handled by the map system. A refused order leaves a line saying why. */
export const digCommands: Readonly<
  Record<string, (ctx: SystemContext, command: Command, cause: number) => void>
> = {
  cutStairs(ctx, command, cause) {
    const at = placeOf(ctx, command, 'stairs', cause);
    if (at) cutStairsAt(ctx, at.x, at.y, at.z, cause);
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
    sinkShaftAt(ctx, x, y, z, to, cause);
  },
};

/** Sinks a shaft at (x, y) from level `z` down to level `to`, reaching the levels on the way,
 * under a `map.shaftSunk` line citing `cause`, which it returns. The foot on each level opens
 * the ground around it (`openAround`). */
export function sinkShaftAt(
  ctx: SystemContext,
  x: number,
  y: number,
  z: number,
  to: number,
  cause: number,
): number {
  const shaft = ctx.content.terrain.kinds.findIndex(
    (k) => k.id === ctx.content.terrain.generator.underground.shaft,
  );
  const sunk = ctx.emit('map.shaftSunk', {
    causes: [cause],
    data: { x, y, from: levelName(z), to: levelName(to) },
  });
  for (let level = z + 1; level <= to; level += 1) reachLevel(ctx, level, sunk);
  for (let level = z; level <= to; level += 1) setTile(ctx, x, y, shaft, sunk, level);
  for (let level = z + 1; level <= to; level += 1) openAround(ctx, x, y, level, sunk);
  return sunk;
}

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const NEIGHBOURS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

/** Digging at (x, y) on level `z` shows what lies next to it (V-030): the tile and its 8
 * neighbours become known, and each newly known open tile (cave floor, groundwater) floods its
 * 4-connected open region, up to `underground.reveal` tiles, known with the rim around it. A
 * region holding cave floor or water writes one `map.opened` line citing `cause`, whose id is
 * returned. The surface (z = 0) is always known. */
export function openAround(
  ctx: SystemContext,
  x: number,
  y: number,
  z: number,
  cause: number,
): number | undefined {
  const map = ctx.world.map;
  const layer = z === 0 ? undefined : map.levels[z - 1];
  if (!layer) return undefined;
  const r = revealOn(ctx, layer);
  const found = floodOpen(r, markAround(r, x, y));
  for (const c of r.changed) {
    const across = chunksAcross(map);
    raiseChunk(map, (c % across) * CHUNK, Math.floor(c / across) * CHUNK, z);
  }
  if (!found.cave && !found.water) return undefined;
  const { cave, water, tiles } = found;
  const what = cave && water ? 'a cave and groundwater' : cave ? 'a cave' : 'groundwater';
  return ctx.emit('map.opened', { causes: [cause], data: { level: z, what, tiles } });
}

/** One reveal on one level: which tiles are open, and the chunks whose fog changed. */
interface Reveal {
  layer: LevelState;
  kinds: EngineContent['terrain']['kinds'];
  under: EngineContent['terrain']['generator']['underground'];
  W: number;
  H: number;
  across: number;
  changed: Set<number>;
}

function revealOn(ctx: SystemContext, layer: LevelState): Reveal {
  const map = ctx.world.map;
  const { kinds, generator } = ctx.content.terrain;
  const [W, H] = [map.width, map.height];
  return {
    layer,
    kinds,
    under: generator.underground,
    W,
    H,
    across: chunksAcross(map),
    changed: new Set(),
  };
}

const openAt = (r: Reveal, i: number): boolean => !diggable(r.kinds[r.layer.tiles[i]!]!);
const onMap = (r: Reveal, x: number, y: number): boolean => x >= 0 && y >= 0 && x < r.W && y < r.H;

/** Marks a tile known; true when it was not known before. */
function mark(r: Reveal, i: number): boolean {
  if (r.layer.known[i]) return false;
  r.layer.known[i] = 1;
  r.changed.add(Math.floor(i / r.W / CHUNK) * r.across + Math.floor((i % r.W) / CHUNK));
  return true;
}

/** Marks the tile and its 8 neighbours known; returns the newly known open ones. */
function markAround(r: Reveal, x: number, y: number): number[] {
  const fresh: number[] = [];
  for (const [dx, dy] of [[0, 0], ...NEIGHBOURS] as const) {
    if (!onMap(r, x + dx, y + dy)) continue;
    const i = (y + dy) * r.W + x + dx;
    if (mark(r, i) && openAt(r, i)) fresh.push(i);
  }
  return fresh;
}

/** Floods each fresh open tile's region and marks it known with its rim; what it found. */
function floodOpen(
  r: Reveal,
  fresh: readonly number[],
): { cave: boolean; water: boolean; tiles: number } {
  const seen = new Set<number>();
  const found = { cave: false, water: false, tiles: 0 };
  for (const start of fresh) {
    if (seen.has(start)) continue;
    const region = regionFrom(r, start, seen);
    if (markRegion(r, region, found)) found.tiles += region.length;
  }
  return found;
}

/** The 4-connected open region from `start`, up to `underground.reveal` tiles. */
function regionFrom(r: Reveal, start: number, seen: Set<number>): number[] {
  const region = [start];
  seen.add(start);
  for (let k = 0; k < region.length; k += 1) {
    const ix = region[k]! % r.W;
    const iy = (region[k]! - ix) / r.W;
    for (const [dx, dy] of SIDES) {
      const j = (iy + dy) * r.W + ix + dx;
      if (!onMap(r, ix + dx, iy + dy) || seen.has(j) || !openAt(r, j)) continue;
      if (region.length >= r.under.reveal) break;
      seen.add(j);
      region.push(j);
    }
  }
  return region;
}

/** Marks a region and its rim known, noting cave floor and water; true when it held either. */
function markRegion(
  r: Reveal,
  region: readonly number[],
  found: { cave: boolean; water: boolean },
): boolean {
  let here = false;
  for (const i of region) {
    const kind = r.kinds[r.layer.tiles[i]!]!;
    if (kind.id === r.under.caves.kind) found.cave = here = true;
    else if (kind.water) found.water = here = true;
    const ix = i % r.W;
    const iy = (i - ix) / r.W;
    mark(r, i);
    for (const [dx, dy] of NEIGHBOURS)
      if (onMap(r, ix + dx, iy + dy)) mark(r, (iy + dy) * r.W + ix + dx);
  }
  return here;
}

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

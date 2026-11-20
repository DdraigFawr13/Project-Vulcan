// Heat from fires (P3.6, V-043; 6B room air): a fire in a closed room gives every tile of it the
// room's air heat (air.ts), lit or not, until the air has cooled. A lit fire in the open gives its
// fuel's `heat` degrees at its own tile and `fire.fall` fewer for each tile of distance, out to
// `fire.radius` tiles; banked, the fuel's `banked.heat`. A tile takes the most any one fire gives
// it (no adding). The map of the whole surface is worked out when asked and kept while its rows
// stand (a cache that is never saved and always rebuilt from the same rows, so a replay and a
// loaded save agree).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { roomAt } from '../build/index.ts';
import { airOf } from './air.ts';
import { firesOf, fuelOf, pieceOfFire, reachOf } from './fire.ts';

const cache = new WeakMap<WorldState, { key: string; heat: ReadonlyMap<number, number> }>();
const NONE: ReadonlyMap<number, number> = new Map();

/** A lit fire in the open: its heat less `fall` a tile, over its `reachOf` tiles. */
function openHeat(
  world: WorldState,
  content: EngineContent,
  f: EntityRow,
  piece: EntityRow,
  give: (i: number, n: number) => void,
): void {
  const fuel = fuelOf(content, f['kind'] as string);
  if (!fuel) return;
  const width = world.map.width;
  const [hx, hy] = [piece['x'] as number, piece['y'] as number];
  const top = f['banked'] ? fuel.banked.heat : fuel.heat;
  for (const i of reachOf(world, content, piece)) {
    const d = Math.max(Math.abs((i % width) - hx), Math.abs(Math.floor(i / width) - hy));
    give(i, top - content.work.fire.fall * d);
  }
}

/** Whole degrees a lit fire adds at each surface tile that has any. */
export function heatMap(world: WorldState, content: EngineContent): ReadonlyMap<number, number> {
  const warm = firesOf(world).filter((f) => f['lit'] || f['air']);
  if (!warm.length) return NONE;
  // What a fire reaches changes only with the surface tiles (a wall or door built raises its
  // chunk's version, and versions only rise), so their sum, which fires are lit, banked and
  // burning what, and each room's air are the whole key.
  let tiles = 0;
  for (const v of world.map.chunkVersions) tiles += v;
  const key = `${tiles}:${warm.map((f) => `${f.id}.${f['lit']}.${f['banked']}.${f['kind']}.${f['air']}`).join()}`;
  const hit = cache.get(world);
  if (hit?.key === key) return hit.heat;
  const heat = new Map<number, number>();
  const give = (i: number, n: number) => {
    if (n > (heat.get(i) ?? 0)) heat.set(i, n);
  };
  for (const f of warm) {
    const piece = pieceOfFire(world, f);
    const room = roomAt(world, content, piece['x'] as number, piece['y'] as number);
    if (room) {
      const air = airOf(f);
      if (air > 0) for (const i of room.tiles) give(i, air);
    } else if (f['lit']) openHeat(world, content, f, piece, give);
  }
  cache.set(world, { key, heat });
  return heat;
}

/** Whole degrees the lit fires add at surface tile `i`. */
export const heatAt = (world: WorldState, content: EngineContent, i: number): number =>
  heatMap(world, content).get(i) ?? 0;

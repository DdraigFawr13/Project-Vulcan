// The granary (P4.7 review): a harvest no longer floods the store. Hauling carries food into the
// store only while stored food is under its Food plate (`storedEnough`); the rest goes to a
// granary the band lays out beside the field (build/granary.ts), a table of tiles of its own so
// they never count as the home store. One stack a tile, food and seed only; it grows onto the
// ground beside it when full, up to `buildings.granary.most`. While the store is under its
// plate, haulers carry food back from the granary to it.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { itemsOf, stackSize } from './stacks.ts';
import { freeTile, inStore, slotAmong, wantOf } from './store.ts';

export const GRANARY_TABLES: Schemas = {
  /** A tile of a granary, the field it stands by (a `field` row id) and the line that laid it out
   * or grew it. */
  granary: { x: 'int', y: 'int', z: 'int', field: 'int', made: 'event' },
};

export const granaryOf = (world: WorldState): EntityRow[] => world.entities['granary'] ?? [];

export const inGranary = (world: WorldState, x: number, y: number, z: number): boolean =>
  granaryOf(world).some((g) => g['x'] === x && g['y'] === y && g['z'] === z);

/** Whether the field already has a granary. */
export const granaryFor = (world: WorldState, field: number): boolean =>
  granaryOf(world).some((g) => g['field'] === field);

/** Whether a granary keeps this kind: food (items.json `good`) and the seed. */
export const keepable = (content: EngineContent, kind: string): boolean =>
  kind === content.buildings.field.seed ||
  content.items.find((d) => d.id === kind)?.good === 'food';

/** The Stock plate a kind counts towards: its own, else its good's. */
function plateOf(content: EngineContent, kind: string): string | undefined {
  if (content.work.stock.some((s) => s.good === kind)) return kind;
  const g = content.items.find((d) => d.id === kind)?.good;
  return g && content.work.stock.some((s) => s.good === g) ? g : undefined;
}

/** Lays out a granary on `tiles` beside `field`, each citing `made`. */
export function addGranary(
  world: WorldState,
  field: number,
  tiles: readonly (readonly [number, number])[],
  made: number,
): void {
  for (const [x, y] of tiles) addEntity(world, 'granary', { x, y, z: 0, field, made });
}

/** Where `count` of `kind` can go in a granary, nearest `from`; undefined when they are all full. */
export const granarySlot = (
  world: WorldState,
  content: EngineContent,
  kind: string,
  count: number,
  from: Spot,
): Spot | undefined => slotAmong(world, content, granaryOf(world), kind, count, from);

/** The free tile beside the granary nearest `from` that it would grow onto next (the one beside
 * its first tile, as the store does); undefined when none can grow. */
export function granaryGrowSpot(
  world: WorldState,
  content: EngineContent,
  from: Spot,
): { spot: Spot; field: number } | undefined {
  const all = granaryOf(world);
  const most = content.buildings.granary.most;
  const near = (r: EntityRow) =>
    Math.max(Math.abs((r['x'] as number) - from.x), Math.abs((r['y'] as number) - from.y));
  // Granaries in order of how near their nearest tile is, then by field.
  const fields = [...new Set(all.map((g) => g['field'] as number))].sort(
    (a, b) =>
      Math.min(...all.filter((g) => g['field'] === a).map(near)) -
        Math.min(...all.filter((g) => g['field'] === b).map(near)) || a - b,
  );
  for (const field of fields) {
    const tiles = all.filter((g) => g['field'] === field);
    if (tiles.length >= most) continue;
    const [ox, oy] = [tiles[0]!['x'] as number, tiles[0]!['y'] as number];
    let best: [number, number] | undefined;
    let far = Infinity;
    for (const s of tiles)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const [x, y] = [(s['x'] as number) + dx, (s['y'] as number) + dy];
        const d = Math.max(Math.abs(x - ox), Math.abs(y - oy)) * 1000 + y * 150 + x;
        if (d < far && freeTile(world, content, x, y)) [best, far] = [[x, y], d];
      }
    if (best) return { spot: { x: best[0], y: best[1], z: 0 }, field };
  }
  return undefined;
}

/** Grows the granary nearest `from` by a tile (`goods.granaryGrew`); the tile, if any. */
export function growGranary(ctx: SystemContext, from: Spot, cause: number): Spot | undefined {
  const { world, content } = ctx;
  const grown = granaryGrowSpot(world, content, from);
  if (!grown) return undefined;
  const made = ctx.emit('goods.granaryGrew', {
    causes: [cause],
    data: { tiles: granaryOf(world).filter((g) => g['field'] === grown.field).length + 1 },
  });
  addEntity(world, 'granary', { ...grown.spot, field: grown.field, made });
  return grown.spot;
}

/** Whether the home store already holds what a Stock plate asks of this item's kind (at least a
 * stack): then the rest stays where it lies, or goes to a granary if it is food or seed. Builders
 * fetch from where it lies. A kind counts towards its own plate, else its good's (grain and
 * turnips are food: a harvest of 3,000 grain filled the store 225 days a year on every seed, the
 * Phase 4 review). Kinds with no plate of either are always carried. Granary tiles are not the
 * store, so their food does not count. */
export function storedEnough(world: WorldState, content: EngineContent): (i: EntityRow) => boolean {
  const stored = new Map<string, number>();
  for (const i of itemsOf(world)) {
    if (i['holder'] || !inStore(world, i['x'] as number, i['y'] as number, i['z'] as number))
      continue;
    const plate = plateOf(content, i['kind'] as string);
    if (plate) stored.set(plate, (stored.get(plate) ?? 0) + (i['count'] as number));
  }
  return (i) => {
    const kind = i['kind'] as string;
    const plate = plateOf(content, kind);
    if (!plate) return false;
    const keep = Math.max(wantOf(world, content, plate), stackSize(content, kind));
    return (stored.get(plate) ?? 0) >= keep;
  };
}

// Items as stacks on tiles (P2.2): a kind, a count, a quality, where it lies (or who carries
// it) and the ledger line that made or brought it. One stack of a kind and quality a tile, up to
// the kind's stack size (life.json `stacks`); an item used up is removed (entity MODULE.md).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';

export const GOODS_TABLES: Schemas = {
  item: {
    /** An items.json id. */
    kind: 'text',
    count: 'count',
    /** `plain` for raw things; made things get a grade once crafting arrives. */
    quality: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    /** The person carrying it (0 when it lies on the ground), or whose it is, for a bedroll. */
    holder: 'entity',
    owner: 'entity',
    /** `laid` for a bedroll laid out to sleep on, else ''. */
    state: 'text',
    /** The line that made or brought it, for "why?". */
    made: 'event',
  },
};

export const itemsOf = (world: WorldState): EntityRow[] => world.entities['item'] ?? [];

export const stackSize = (content: EngineContent, kind: string): number =>
  content.life.stacks[kind] ?? content.life.stacks['default'] ?? 25;

/** The stacks lying on a tile (not carried). */
export const itemsAt = (world: WorldState, x: number, y: number, z: number): EntityRow[] =>
  itemsOf(world).filter((i) => i['x'] === x && i['y'] === y && i['z'] === z && !i['holder']);

/** Lays `count` of a kind on a tile as one new stack. */
export function layItem(
  world: WorldState,
  fields: { kind: string; count: number; x: number; y: number; z: number; made: number },
  extra: { owner?: number; state?: string } = {},
): number {
  return addEntity(world, 'item', {
    ...fields,
    quality: 'plain',
    holder: 0,
    owner: extra.owner ?? 0,
    state: extra.state ?? '',
  });
}

/** Takes up to `count` from a stack; the stack goes when emptied. Returns how many were taken. */
export function takeFrom(world: WorldState, item: EntityRow, count: number): number {
  const took = Math.min(count, item['count'] as number);
  item['count'] = (item['count'] as number) - took;
  if (item['count'] === 0) removeEntity(world, 'item', item.id);
  return took;
}

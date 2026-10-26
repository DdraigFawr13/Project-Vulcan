// Items as stacks on tiles (P2.2): a kind, a count, a quality, where it lies (or who carries
// it) and the ledger line that made or brought it. One stack of a kind and quality a tile, up to
// the kind's stack size (life.json `stacks`); an item used up is removed (entity MODULE.md).
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { noteUse } from './trips.ts';

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
    /** `laid` for a bedroll laid out to sleep on, `worn` for clothes on their owner, else ''. */
    state: 'text',
    /** Hours of wear left in a garment (clothes.json), else 0. */
    wear: 'count',
    /** The line that made or brought it, for "why?". */
    made: 'event',
    /** Where it came from (Bundle 3, P4.6): a compact JSON list of steps, '' for none. */
    trail: 'text',
    /** A tool in use (Bundle 3, V-088): `owner` has it, `state` `held`, it lies on no tile (x, y
     * -1); `wear` is the work minutes left in it and `worked` the minutes it has been used. */
    worked: 'count',
    /** The `tool.worn` line once a held tool is worn and asks for a better one (P4.9), else 0. */
    worn: 'event',
    /** Food's spoiling carried over to tomorrow, in millionths of one (keep spoil.ts, P5.12). */
    rot: 'count',
  },
};

export const itemsOf = (world: WorldState): EntityRow[] => world.entities['item'] ?? [];

/** A tool never stacks: each has its own wear, quality and trail. */
export const stackSize = (content: EngineContent, kind: string): number =>
  content.items.find((i) => i.id === kind)?.tool
    ? 1
    : (content.life.stacks[kind] ?? content.life.stacks['default'] ?? 25);

/** The stacks lying on a tile (not carried). */
export const itemsAt = (world: WorldState, x: number, y: number, z: number): EntityRow[] =>
  itemsOf(world).filter((i) => i['x'] === x && i['y'] === y && i['z'] === z && !i['holder']);

/** Lays `count` of a kind on a tile as one new stack. */
export function layItem(
  world: WorldState,
  fields: { kind: string; count: number; x: number; y: number; z: number; made: number },
  extra: {
    owner?: number;
    state?: string;
    wear?: number;
    quality?: string;
    trail?: string;
  } = {},
): number {
  return addEntity(world, 'item', {
    ...fields,
    quality: extra.quality ?? 'plain',
    holder: 0,
    owner: extra.owner ?? 0,
    state: extra.state ?? '',
    wear: extra.wear ?? 0,
    trail: extra.trail ?? '',
    worked: 0,
    worn: 0,
    rot: 0,
  });
}

/** What `person` is carrying to put down somewhere: the item they hold, not the clothes they wear. */
export const loadOf = (world: WorldState, person: number): EntityRow | undefined =>
  itemsOf(world).find((i) => i['holder'] === person && i['state'] !== 'worn');

/** Takes up to `count` from a stack; the stack goes when emptied. Returns how many were taken. A
 * carried load used up by someone not hauling it is a trip's end (trips.ts). */
export function takeFrom(world: WorldState, item: EntityRow, count: number): number {
  const took = Math.min(count, item['count'] as number);
  if (took > 0 && item['holder']) noteUse(world, item);
  item['count'] = (item['count'] as number) - took;
  if (item['count'] === 0) removeEntity(world, 'item', item.id);
  return took;
}

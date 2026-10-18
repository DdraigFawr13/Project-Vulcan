// Things lying about as the page shows them (P2.4): items, the store's tiles and test-mode marks
// for the map, the stock lever for its sheet, and a tile's goods for the inspector. Pure reads
// of the world, like views.ts.
import { content } from '../content/index.ts';
import {
  freeTile,
  haveOf,
  inStore,
  isTree,
  itemsAt,
  itemsOf,
  marksOf,
  recordOf,
  stockOf,
  storeOf,
  wantOf,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import type { GoodsView, LedgerLine, StockView, TileView } from './protocol.ts';

const nameOf = (kind: string): string => content.items.find((i) => i.id === kind)?.name ?? kind;

/** Art frame for an item kind: the cart has its own, a laid bedroll its laid frame. */
const frameOf = (kind: string, state: string): string =>
  kind === content.life.cart.kind ? kind : `item.${kind}${state === 'laid' ? '.laid' : ''}`;

/** What the map draws: items on the ground, the store's tiles and marked trees. */
export function goodsOf(world: WorldState): GoodsView {
  const at = (r: { [k: string]: unknown }) => ({
    x: r['x'] as number,
    y: r['y'] as number,
    z: r['z'] as number,
  });
  return {
    items: itemsOf(world)
      .filter((i) => !i['holder'])
      .map((i) => ({ ...at(i), frame: frameOf(i['kind'] as string, i['state'] as string) })),
    store: storeOf(world).map(at),
    marks: marksOf(world).map((m) => ({ x: m['x'] as number, y: m['y'] as number, z: 0 })),
  };
}

/** The stock lever, one row per good in work.json. */
export const stockView = (world: WorldState): StockView[] =>
  content.work.stock.map((def) => ({
    good: def.good,
    name: def.name,
    have: haveOf(world, content, def.good),
    want: wantOf(world, content, def.good),
    level: (stockOf(world, def.good)?.['level'] as string) ?? def.start,
    levels: def.levels.map((l) => ({ id: l.id, word: l.word, count: l.count })),
  }));

/** The inspector's goods rows for tile (x, y, z), each with the line that made or brought it. */
export function tileGoods(
  world: WorldState,
  x: number,
  y: number,
  z: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): Partial<TileView> {
  const line = (id: unknown) => {
    const e = recordOf(world, id as number);
    return e && lineOf(e);
  };
  const goods = itemsAt(world, x, y, z).map((i) => {
    const count = i['count'] as number;
    const kind = i['kind'] as string;
    const made = line(i['made']);
    return {
      text: `${nameOf(kind)}${count > 1 ? ` × ${count}` : ''}${i['state'] === 'laid' ? ', laid out' : ''}`,
      ...(made && { made }),
    };
  });
  const tile = storeOf(world).find((s) => s['x'] === x && s['y'] === y && s['z'] === z);
  const store = tile && line(tile['made']);
  const surface = z === 0;
  const i = y * world.map.width + x;
  return {
    ...(goods.length && { goods }),
    ...(tile && { store: { ...(store && { made: store }) } }),
    ...(surface && marksOf(world).some((m) => m['x'] === x && m['y'] === y) && { marked: true }),
    ...(surface && isTree(world, content, i) && { tree: true }),
    ...(surface && !inStore(world, x, y, 0) && freeTile(world, content, x, y) && { open: true }),
  };
}

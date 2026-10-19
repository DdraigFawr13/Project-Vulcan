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
  loadOf,
  marksOf,
  nextNeed,
  partOf,
  planAt,
  plansOf,
  recordOf,
  stockOf,
  storeOf,
  wantOf,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { fieldFrames } from './fields.ts';
import { fireGoods, workBars } from './fires.ts';
import { shaftPlans, stockNote } from './mine.ts';
import { furnitureGoods, tilePiece } from './furniture.ts';
import type { GoodsView, LedgerLine, StockView, TileView } from './protocol.ts';
import type { PlanView } from './protocol-build.ts';
import { stationGoods, tileWorks } from './works.ts';

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
      .filter((i) => !i['holder'] && i['state'] !== 'held')
      .map((i) => ({ ...at(i), frame: frameOf(i['kind'] as string, i['state'] as string) })),
    store: storeOf(world).map(at),
    marks: marksOf(world).map((m) => ({ x: m['x'] as number, y: m['y'] as number, z: 0 })),
    plans: plansOf(world)
      .filter((p) => p['state'] !== 'built')
      .map((p) => ({
        ...at(p),
        part: p['part'] as string,
        state: p['state'] as string,
        house: p['house'] as number,
      })),
    furniture: [...furnitureGoods(world), ...stationGoods(world)],
    fires: fireGoods(world),
    work: workBars(world),
    fields: fieldFrames(world),
    shafts: shaftPlans(world),
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
    ...(def.note && { note: stockNote(world, def.good, def.note) }),
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
    const def = content.items.find((d) => d.id === kind);
    return {
      text: `${nameOf(kind)}${count > 1 ? ` × ${count}` : ''}${i['state'] === 'laid' ? ', laid out' : ''}`,
      ...(made && { made }),
      // A tool or an ingot has a page of its own: where it came from (P4.6).
      ...((def?.tool || def?.good === 'metal') && { item: i.id }),
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
    ...(surface && planOf(world, x, y, line)),
    ...(surface && tilePiece(world, x, y, lineOf)),
    ...(surface && tileWorks(world, x, y, lineOf)),
  };
}

/** The tile's plan for the inspector (P3.1): the part, its material and its builder. */
function planOf(
  world: WorldState,
  x: number,
  y: number,
  line: (id: unknown) => LedgerLine | undefined,
): { plan: PlanView } | undefined {
  const row = planAt(world, x, y);
  const part = row && partOf(content, row['part'] as string);
  if (!row || !part) return undefined;
  const builder = (world.entities['person'] ?? []).find(
    (p) => p['job'] === 'build' && p['plan'] === row.id,
  );
  const placed = line(row['line']);
  const built = row['done'] ? line(row['done']) : undefined;
  const waits = row['state'] === 'plan' && row['shut'] ? row['shut'] : row['waited'];
  const waiting = waits ? line(waits) : undefined;
  const carrying = builder && loadOf(world, builder.id);
  const state = row['state'] as string;
  const doing =
    state === 'down'
      ? 'taking it down'
      : carrying
        ? `bringing ${carrying['count'] as number} ${nameOf(part.material)}`
        : nextNeed(content, row)
          ? `fetching ${nameOf(nextNeed(content, row)!.material)}`
          : 'building';
  return {
    plan: {
      part: part.id,
      name: part.name,
      state,
      have: state === 'built' ? part.cost : (row['have'] as number),
      cost: part.cost,
      good: nameOf(part.material),
      ...(builder && { builder: builder['name'] as string, doing }),
      ...(placed && { placed }),
      ...(built && { built }),
      ...(waiting && { waiting }),
    },
  };
}

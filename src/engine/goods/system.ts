// The goods system (P2.2): owns the item table. When a world begins, right after the band
// arrives, the cart is unloaded beside the camp: the cart itself, its goods in stacks on the
// open tiles nearest it, and a bedroll laid out for each person. One ledger line says so. Then
// (P2.4) the band sets up its store beside the cart and the colony's stock levels start.
import type { EngineContent, WorldState } from '../core/index.ts';
import { canReach } from '../paths/index.ts';
import type { System } from '../sim/index.ts';
import { GOODS_TABLES, itemsOf, layItem, stackSize } from './stacks.ts';
import { layTool, restOf } from './tools.ts';
import { putOn } from './clothes.ts';
import { markCommands, MARK_TABLES } from './marks.ts';
import { DEPOT_TABLES } from './depots.ts';
import { rollTrips, TRIP_TABLES } from './trips.ts';
import { dryAt, setStock, setUpStock, setUpStore, STORE_TABLES } from './store.ts';

/** Open tiles joined to the camp, nearest first in rings, that hold no item yet. */
function freeTilesNear(world: WorldState, content: EngineContent, count: number): number[][] {
  const map = world.map;
  const start = { x: map.startX, y: map.startY, z: 0 };
  const taken = new Set(itemsOf(world).map((i) => `${i['x']},${i['y']}`));
  const out: number[][] = [];
  for (let r = 1; out.length < count && r <= 20; r += 1)
    for (let dy = -r; dy <= r && out.length < count; dy += 1)
      for (let dx = -r; dx <= r && out.length < count; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = start.x + dx;
        const y = start.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (taken.has(`${x},${y}`) || !dryAt(content, map, y * map.width + x)) continue;
        if (!canReach(content, map, start, { x, y, z: 0 })) continue;
        taken.add(`${x},${y}`);
        out.push([x, y]);
      }
  return out;
}

const nameOf = (content: EngineContent, kind: string): string =>
  content.items.find((i) => i.id === kind)?.name ?? kind;

export const goodsSystem: System = {
  id: 'goods',
  // Stacks change through the people who move them; each day the oldest day of trips is dropped.
  every: 'day',
  emits: [
    'goods.unloaded',
    'goods.storeSet',
    'goods.storeGrew',
    'goods.stockSet',
    'goods.stockRaised',
    'goods.storeMarked',
    'goods.foodGone',
  ],
  // The line where the last food was eaten (food.ts), which hunger cites.
  initialState: { foodGone: 0 },
  refs: ['foodGone'],
  tables: { ...GOODS_TABLES, ...STORE_TABLES, ...DEPOT_TABLES, ...TRIP_TABLES, ...MARK_TABLES },
  commands: {
    setStock: (ctx, command, cause) => setStock(ctx, command.data, cause),
    markFell: (ctx, command, cause) => markCommands.markFell(ctx, command.data, cause),
    markStore: (ctx, command, cause) => markCommands.markStore(ctx, command.data, cause),
  },
  run(ctx) {
    rollTrips(ctx.world);
  },
  init(ctx) {
    const { world, content } = ctx;
    const people = world.entities['person'] ?? [];
    const arrived = people[0]?.['arrived'] as number | undefined;
    if (!people.length || !arrived) return;
    const { cart } = content.life;
    const stacks = cart.goods.flatMap((g) => {
      const size = stackSize(content, g.kind);
      return Array.from({ length: Math.ceil(g.count / size) }, (_, k) => ({
        kind: g.kind,
        count: Math.min(size, g.count - k * size),
      }));
    });
    const used = 1 + stacks.length + people.length;
    const tiles = freeTilesNear(
      world,
      content,
      used + content.tools.kinds.reduce((n, k) => n + (k.cart ?? content.tools.cart), 0),
    );
    if (tiles.length < used) return;
    const made = ctx.emit('goods.unloaded', {
      causes: [arrived],
      data: {
        goods: cart.goods.map((g) => `${g.count} ${nameOf(content, g.kind)}`).join(', '),
        beds: people.length,
      },
    });
    const at = (k: number) => ({ x: tiles[k]![0]!, y: tiles[k]![1]!, z: 0, made });
    layItem(world, { kind: cart.kind, count: 1, ...at(0) });
    stacks.forEach((s, k) => layItem(world, { ...s, ...at(1 + k) }));
    people.forEach((p, k) =>
      layItem(
        world,
        { kind: cart.bedroll, count: 1, ...at(1 + stacks.length + k) },
        { owner: p.id, state: 'laid' },
      ),
    );
    // Each settler arrives dressed (V-092, P5.5): clothes are held and worn, so they lie on no tile.
    for (const p of people)
      for (const kind of content.clothes.cart) putOn(world, content, p, kind, made);
    setUpStore(ctx, made);
    setUpStock(ctx, made);
    // The cart's stone tools (tools.json `cart` of each kind) are kept with the cart.
    const stone = content.tools.cartMaterial;
    for (const kind of content.tools.kinds)
      for (let n = 0; n < (kind.cart ?? content.tools.cart); n += 1)
        layTool(world, content, restOf(world, content), {
          ...{ kind: kind.id, material: stone, quality: 'plain', made },
        });
    // The band's candles (P5.13) are kept with the cart too, burned from there till they are gone.
    const candles = content.lamp.cart;
    if (candles.count)
      layItem(
        world,
        { kind: candles.item, count: candles.count, ...restOf(world, content), made },
        { state: 'kept' },
      );
  },
};

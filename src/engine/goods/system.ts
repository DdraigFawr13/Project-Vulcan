// The goods system (P2.2): owns the item table. When a world begins, right after the band
// arrives, the cart is unloaded beside the camp: the cart itself, its goods in stacks on the
// open tiles nearest it, and a bedroll laid out for each person. One ledger line says so. Then
// (P2.4) the band sets up its store beside the cart and the colony's stock levels start.
import type { EngineContent, WorldState } from '../core/index.ts';
import { canReach } from '../paths/index.ts';
import type { System } from '../sim/index.ts';
import { GOODS_TABLES, itemsOf, layItem, stackSize } from './stacks.ts';
import { markCommands, MARK_TABLES } from './marks.ts';
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
  every: 'day', // a cadence is required; stacks change through the people who move them
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
  tables: { ...GOODS_TABLES, ...STORE_TABLES, ...MARK_TABLES },
  commands: {
    setStock: (ctx, command, cause) => setStock(ctx, command.data, cause),
    markFell: (ctx, command, cause) => markCommands.markFell(ctx, command.data, cause),
    markStore: (ctx, command, cause) => markCommands.markStore(ctx, command.data, cause),
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
    const tiles = freeTilesNear(world, content, 1 + stacks.length + people.length);
    if (tiles.length < 1 + stacks.length + people.length) return;
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
    // Each settler arrives wearing a wool cloak (V-092): held and worn, so it lies on no tile.
    for (const p of people) {
      const at = {
        kind: cart.cloak,
        count: 1,
        x: p['x'] as number,
        y: p['y'] as number,
        z: 0,
        made,
      };
      const id = layItem(world, at, { owner: p.id, state: 'worn', wear: content.life.cloak.last });
      itemsOf(world).find((i) => i.id === id)!['holder'] = p.id;
    }
    setUpStore(ctx, made);
    setUpStock(ctx, made);
  },
};

# goods

Items as stacks on tiles, and the band's handcart.

- **Public API:** `index.ts`: `goodsSystem`, `GOODS_TABLES`, `itemsOf(world)`, `itemsAt(world, x, y, z)` (stacks lying on a tile, not carried), `layItem(world, fields, {owner, state})` (a new stack), `takeFrom(world, item, count)` (the stack goes when emptied), `stackSize(content, kind)` (life.json `stacks`, else `default`).
- **Arrival:** in `init`, after the people, the cart is unloaded on the open tiles joined to the camp nearest the start, ring by ring: the cart itself, its goods (life.json `cart.goods`) in stacks of at most the stack size, and one bedroll a person, laid out (`state: 'laid'`) and owned by them. Nothing is drawn from a stream.
- **Events:** emits `goods.unloaded` (goods, beds), citing the `people.arrived` line. Every item cites it as `made`.
- **State owned:** table `item` (kind, count, quality (`plain` for now), x, y, z, holder (who carries it, or 0), owner (whose it is, or 0), state, made). No system state; `every: day` with no `run`, since stacks change through the people who use them.
- **Invariants:** one stack of a kind a tile from the unloading; counts never above the stack size; a used-up item is removed (entity MODULE.md).
- **Tests:** `src/engine/needs/needs.test.ts` (the cart unloads once, a bedroll each, the rations go down as the band eats).

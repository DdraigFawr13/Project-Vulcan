// The store and the stock lever (P2.4). The band sets up its store by the cart when it arrives:
// a block of open tiles, one stack a tile, that grows onto open ground beside it when a carried
// load finds no room. The player's lever is how much of each good the colony wants kept (V-015);
// it is a row per good, and every change is a ledger line that later work cites.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { canReach, reachFrom, walkAt, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { depotAt, depotsFor, depotsOf, depotTiles, onDepot } from './depots.ts';
import { itemsAt, itemsOf, stackSize } from './stacks.ts';

export const STORE_TABLES: Schemas = {
  /** A tile of the store, and the line that set it up or grew it. */
  store: { x: 'int', y: 'int', z: 'int', made: 'event' },
  /** How much of a good the colony wants kept: a work.json level id, and the line that set it. */
  stock: { good: 'text', level: 'text', line: 'event' },
};

const rows = (world: WorldState, kind: string): EntityRow[] => world.entities[kind] ?? [];

export const storeOf = (world: WorldState): EntityRow[] => rows(world, 'store');

/** Whether the tile is the home store's. */
export const inHomeStore = (world: WorldState, x: number, y: number, z: number): boolean =>
  storeOf(world).some((s) => s['x'] === x && s['y'] === y && s['z'] === z);

/** Whether the tile is a store tile: the home store's, or inside a built store of a kind. */
export const inStore = (world: WorldState, x: number, y: number, z: number): boolean =>
  inHomeStore(world, x, y, z) || !!depotAt(world, x, y, z);

/** Dry ground a person can stand on: no rock, no blocking feature and no water, deep or shallow. */
export const dryAt = (content: EngineContent, map: WorldState['map'], i: number): boolean =>
  walkAt(content, map, 0, i) > 0 && !content.terrain.kinds[map.tiles[i]!]!.water;

/** Open ground joined to the camp with nothing lying on it (but what `lying` lets) and no store
 * on it. */
export function freeTile(
  world: WorldState,
  content: EngineContent,
  x: number,
  y: number,
  lying: (i: EntityRow) => boolean = () => false,
): boolean {
  const map = world.map;
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (!dryAt(content, map, y * map.width + x)) return false;
  if (itemsAt(world, x, y, 0).some((i) => !lying(i)) || inStore(world, x, y, 0)) return false;
  // Nor on a store of a kind, planned or built (depots.ts).
  if (depotsOf(world).some((d) => onDepot(d, x, y))) return false;
  // Not where a part is planned or built (the build system's `plan` table, P3.1).
  if ((world.entities['plan'] ?? []).some((p) => p['x'] === x && p['y'] === y && p['z'] === 0))
    return false;
  // Nor on a station (the smelter or the charcoal clamp's spot, Bundle 3).
  if (
    (world.entities['station'] ?? []).some(
      (s) =>
        s['z'] === 0 &&
        x >= (s['x'] as number) &&
        x < (s['x'] as number) + (s['w'] as number) &&
        y >= (s['y'] as number) &&
        y < (s['y'] as number) + (s['h'] as number),
    )
  )
    return false;
  // Nor in a burial ground (build/burial.ts, P5.8).
  if (
    (world.entities['burial'] ?? []).some(
      (b) =>
        b['state'] === 'laid' &&
        x >= (b['x'] as number) &&
        x < (b['x'] as number) + (b['w'] as number) &&
        y >= (b['y'] as number) &&
        y < (b['y'] as number) + (b['h'] as number),
    )
  )
    return false;
  // Nor where a hearth or other furniture piece stands (P3.6).
  if ((world.entities['furniture'] ?? []).some((f) => f['x'] === x && f['y'] === y && f['z'] === 0))
    return false;
  return canReach(content, map, { x: map.startX, y: map.startY, z: 0 }, { x, y, z: 0 });
}

/** The first block of free tiles nearest the cart, tried in rings around it. */
export function setUpStore(ctx: SystemContext, cause: number): void {
  const { world, content } = ctx;
  const cart = itemsOf(world).find((i) => i['kind'] === content.life.cart.kind);
  const cx = (cart?.['x'] as number) ?? world.map.startX;
  const cy = (cart?.['y'] as number) ?? world.map.startY;
  const { width: w, height: h } = content.work.store;
  for (let r = 1; r <= 12; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tiles: [number, number][] = [];
        for (let j = 0; j < h; j += 1)
          for (let k = 0; k < w; k += 1) tiles.push([cx + dx + k, cy + dy + j]);
        if (!tiles.every(([x, y]) => freeTile(world, content, x, y))) continue;
        const made = ctx.emit('goods.storeSet', { causes: [cause], data: { width: w, height: h } });
        for (const [x, y] of tiles) addEntity(world, 'store', { x, y, z: 0, made });
        return;
      }
}

/** The free open tile beside the store, nearest its first tile, that it would grow onto next;
 * undefined when it cannot grow. */
export function growSpot(world: WorldState, content: EngineContent): Spot | undefined {
  const tiles = storeOf(world);
  if (!tiles.length || tiles.length >= content.work.store.most) return undefined;
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
  return best && { x: best[0], y: best[1], z: 0 };
}

/** Grows the store by that tile; the tile, if any. */
export function growStore(ctx: SystemContext, cause: number): Spot | undefined {
  const { world, content } = ctx;
  const best = growSpot(world, content);
  if (!best) return undefined;
  const made = ctx.emit('goods.storeGrew', {
    causes: [cause],
    data: { tiles: storeOf(world).length + 1 },
  });
  addEntity(world, 'store', { ...best, made });
  return best;
}

/** Where `count` of `kind` can go among `tiles` (the home store's, or a store of a kind's): a matching stack
 * with room, else an empty tile, nearest `from`; undefined when they are full for this load. */
export function slotAmong(
  world: WorldState,
  content: EngineContent,
  tiles: readonly EntityRow[],
  kind: string,
  count: number,
  from: Spot,
  quality = 'plain',
): Spot | undefined {
  const size = stackSize(content, kind);
  // The stacks on each of `tiles`, in one pass over the items (this is hot: every load asks).
  const key = (x: number, y: number, z: number) => (z * world.map.height + y) * world.map.width + x;
  const on = new Map<number, EntityRow[]>();
  for (const s of tiles) on.set(key(s['x'] as number, s['y'] as number, s['z'] as number), []);
  for (const i of itemsOf(world))
    if (!i['holder'] && (i['x'] as number) >= 0)
      on.get(key(i['x'] as number, i['y'] as number, i['z'] as number))?.push(i);
  let best: Spot | undefined;
  let far = Infinity;
  for (const s of tiles) {
    const spot = { x: s['x'] as number, y: s['y'] as number, z: s['z'] as number };
    const here = on.get(key(spot.x, spot.y, spot.z))!;
    const fits = here.length
      ? here.length === 1 &&
        here[0]!['kind'] === kind &&
        // Meals of another grade (P5.3) keep their own stack.
        (here[0]!['quality'] ?? 'plain') === quality &&
        (here[0]!['count'] as number) + count <= size
      : true;
    if (!fits) continue;
    // A matching stack before an empty tile, then the nearest.
    const d =
      (here.length ? 0 : 100000) + Math.max(Math.abs(spot.x - from.x), Math.abs(spot.y - from.y));
    if (d < far) [best, far] = [spot, d];
  }
  return best;
}

/** Where `count` of `kind` can go in a store of its kind, nearest `from`; undefined when there is
 * none or they are full for this load. */
export const depotSlot = (
  world: WorldState,
  content: EngineContent,
  kind: string,
  count: number,
  from: Spot,
  quality = 'plain',
): Spot | undefined => {
  // The nearest store of the kind first: a matching stack in a far one does not draw the load.
  const near = (d: EntityRow) =>
    Math.max(
      Math.abs((d['x'] as number) + ((d['w'] as number) >> 1) - from.x),
      Math.abs((d['y'] as number) + ((d['h'] as number) >> 1) - from.y),
    );
  const depots = [...depotsFor(world, content, kind)].sort((a, b) => near(a) - near(b));
  for (const d of depots) {
    const slot = slotAmong(world, content, depotTiles(d), kind, count, from, quality);
    if (slot) return slot;
  }
  return undefined;
};

/** Where `count` of `kind` can go: the nearest store of its kind with room, else the home store;
 * undefined when the home store is full for this load. */
export const slotFor = (
  world: WorldState,
  content: EngineContent,
  kind: string,
  count: number,
  from: Spot,
  quality = 'plain',
): Spot | undefined =>
  depotSlot(world, content, kind, count, from, quality) ??
  slotAmong(world, content, storeOf(world), kind, count, from, quality);

/** Each item kind's `good` (items.json), worked out once per content: `haveOf` is hot. */
const goodCache = new WeakMap<EngineContent, Map<string, string | undefined>>();
function goodsOf(content: EngineContent): Map<string, string | undefined> {
  let m = goodCache.get(content);
  if (!m) goodCache.set(content, (m = new Map(content.items.map((d) => [d.id, d.good]))));
  return m;
}

/** How much of a good the colony has: in the store, lying about where someone can get to it, or
 * being carried. A good is an item kind (logs) or the `good` an item belongs to in items.json
 * (food: preserved, berries...). Logs shut in by trees and a new wall are not had (P4.9: on anvil
 * 94 of them stopped all felling for a year, and the fires went out in Lastsnow). */
export function haveOf(world: WorldState, content: EngineContent, good: string): number {
  const map = world.map;
  const goods = goodsOf(content);
  let reach: ((to: Spot) => boolean) | undefined;
  let n = 0;
  for (const i of itemsOf(world)) {
    if (i['kind'] !== good && goods.get(i['kind'] as string) !== good) continue;
    // Off the map (x -1) is an owned tool between uses, kept as carried.
    if (!i['holder'] && (i['x'] as number) >= 0) {
      reach ??= reachFrom(content, map, { x: map.startX, y: map.startY, z: 0 });
      if (!reach({ x: i['x'] as number, y: i['y'] as number, z: i['z'] as number })) continue;
    }
    n += i['count'] as number;
  }
  return n;
}

export const stockOf = (world: WorldState, good: string): EntityRow | undefined =>
  rows(world, 'stock').find((s) => s['good'] === good);

/** How much of a good the colony wants now. */
export function wantOf(world: WorldState, content: EngineContent, good: string): number {
  const def = content.work.stock.find((s) => s.good === good);
  const level = stockOf(world, good)?.['level'];
  return def?.levels.find((l) => l.id === level)?.count ?? 0;
}

/** Each good's starting level, one line each, citing the unloading. */
export function setUpStock(ctx: SystemContext, cause: number): void {
  for (const def of ctx.content.work.stock) {
    const level = def.levels.find((l) => l.id === def.start) ?? def.levels[0]!;
    const line = ctx.emit('goods.stockSet', {
      causes: [cause],
      data: { word: level.word, good: def.name },
    });
    addEntity(ctx.world, 'stock', { good: def.good, level: level.id, line });
  }
}

/** The `setStock` lever: `{ good, level }`. Refused with a reason when either is unknown. */
export function setStock(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
): void {
  const def = ctx.content.work.stock.find((s) => s.good === data['good']);
  const level = def?.levels.find((l) => l.id === data['level']);
  const row = def && stockOf(ctx.world, def.good);
  if (!def || !level || !row) {
    ctx.emit('command.refused', {
      causes: [cause],
      data: { kind: 'setStock', reason: 'no such good or level' },
    });
    return;
  }
  if (row['level'] === level.id) return;
  row['level'] = level.id;
  row['line'] = ctx.emit('goods.stockSet', {
    causes: [cause],
    data: { word: level.word, good: def.name },
  });
}

/** A plan needs a good the colony keeps none of (P3.1): its level goes up to the first that keeps
 * some, with a line citing the plan. The player can set it back. */
export function raiseStock(ctx: SystemContext, good: string, part: string, cause: number): void {
  const def = ctx.content.work.stock.find((s) => s.good === good);
  const row = stockOf(ctx.world, good);
  if (!def || !row || wantOf(ctx.world, ctx.content, good) > 0) return;
  const level = def.levels.find((l) => l.count > 0);
  if (!level) return;
  row['level'] = level.id;
  row['line'] = ctx.emit('goods.stockRaised', {
    causes: [cause],
    data: { part, word: level.word, good: def.name },
  });
}

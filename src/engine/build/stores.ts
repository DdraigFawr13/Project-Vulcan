// Stores by kind (5B Bundle 1, V-129): nobody orders a store. Once a day the colony looks at the
// last days' carrying (goods/trips.ts) for each store kind: where its goods were picked up and
// where they were used, food being eaten at the home store. A kind gets a store at the spot that
// would most shorten those walks, when that saves `stores.save` tiles of walking a day, or at once
// when the home store is full and holds its goods; a second of a kind only `apart` tiles from the
// first. The store's edge (walls by the house wall rule, hurdles or drystone) and floor are plans
// builders take up; once all stand the store takes its goods (goods/depots.ts). No Send back.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type PartDef,
  type StoreKindDef,
} from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import {
  depotsOf,
  growSpot,
  itemsAt,
  raiseStock,
  storeKindOf,
  storeOf,
  tripsFor,
} from '../goods/index.ts';
import { withBuiltAll } from '../map/index.ts';
import { reachFrom, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dirFrom, homeless } from './houses.ts';
import { partOf, plansOf } from './plans.ts';
import {
  doorOf,
  groundOf,
  housesOf,
  onEdge,
  outsideOf,
  scoreRect,
  withinReach,
  type Rect,
} from './site.ts';
import { inRect, isTreeAt, wayFrom, wayTo } from './way.ts';

type Point = { x: number; y: number; n: number };
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const centreOf = (d: EntityRow) => ({
  x: (d['x'] as number) + ((d['w'] as number) >> 1),
  y: (d['y'] as number) + ((d['h'] as number) >> 1),
});

/** Tiles walked carrying, over the points, with loads going to and from the nearest of `stores`. */
function walkOf(points: readonly Point[], stores: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (const p of points) {
    let near = Infinity;
    for (const s of stores) near = Math.min(near, cheb(p, s));
    sum += p.n * near;
  }
  return sum;
}

/** The tick a store was built (a planned one: never). */
const builtAt = (d: EntityRow): number =>
  d['state'] === 'built' ? (d['builtTick'] as number) : Infinity;

/** Whether the home store is at its most and has no empty tile. */
function homeFull(ctx: SystemContext): boolean {
  const { world, content } = ctx;
  if (growSpot(world, content)) return false;
  return storeOf(world).every(
    (s) => itemsAt(world, s['x'] as number, s['y'] as number, s['z'] as number).length > 0,
  );
}

/** Home store tiles holding a store kind's goods. */
const homeTilesOf = (ctx: SystemContext, store: string): number =>
  storeOf(ctx.world).filter((s) =>
    itemsAt(ctx.world, s['x'] as number, s['y'] as number, s['z'] as number).some(
      (i) => storeKindOf(ctx.content, i['kind'] as string)?.id === store,
    ),
  ).length;

/** The edge of a store with no wall part of its own: the house wall rule (the most plentiful). */
function wallOf(content: EngineContent, ctx: SystemContext): PartDef {
  const walls = content.buildings.house.walls.map((id) => partOf(content, id)!);
  const have = (w: PartDef) =>
    Math.min(
      withinReach(ctx.world, content, w.material, true),
      ...(w.also ? [withinReach(ctx.world, content, w.also.material, true)] : []),
    );
  return walls.reduce((best, w) => (have(w) > have(best) ? w : best));
}

/** The best fitting footprint for a store kind among the spots within `near` tiles of the green,
 * lowest walk first (ties in tile order), or undefined. */
function siteStore(
  ctx: SystemContext,
  green: Spot,
  near: number,
  w: number,
  h: number,
  score: (c: { x: number; y: number }) => number,
  away: readonly { x: number; y: number }[],
  enough: (walk: number) => boolean,
): { rect: Rect; door: Spot; trees: number[]; walk: number } | undefined {
  const { world, content } = ctx;
  const def = content.buildings.stores;
  const map = world.map;
  const spots: { x: number; y: number; walk: number }[] = [];
  for (let y = green.y - near; y <= green.y + near; y += 1)
    for (let x = green.x - near; x <= green.x + near; x += 1) {
      if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
      if (away.some((a) => cheb(a, { x, y }) < def.apart)) continue;
      spots.push({ x, y, walk: score({ x, y }) });
    }
  spots.sort((a, b) => a.walk - b.walk || a.y - b.y || a.x - b.x);
  // Not worth it even at the best spot: no ground is looked at.
  if (!spots.length || !enough(spots[0]!.walk)) return undefined;
  const ground = groundOf(world);
  const way = wayFrom(world, content, green);
  for (const s of spots.slice(0, def.tries)) {
    if (!enough(s.walk)) return undefined;
    const rect = { x: s.x - (w >> 1), y: s.y - (h >> 1), w, h };
    // Not on the green nor right beside it: the green stays open.
    if (cheb(green, s) < Math.max(w, h)) continue;
    const fit = scoreRect(world, content, rect, undefined, ground);
    if (!fit) continue;
    const door = doorOf(rect, green);
    const out = outsideOf(rect, door);
    if (way.trees[out.y * map.width + out.x]! < 0) continue;
    if (shutsOff(ctx, rect, door, green)) continue;
    // The way in must not cross the site; trees on it are felled with the site's own.
    const tiles = wayTo(way, out.y * map.width + out.x);
    if (tiles.some((i) => inRect(rect, i % map.width, Math.floor(i / map.width)))) continue;
    const extra = tiles.filter((i) => isTreeAt(world, content, i) && !fit.trees.includes(i));
    return { rect, door, trees: [...fit.trees, ...extra], walk: s.walk };
  }
  return undefined;
}

/** Whether the store's edge would cut the green off from ground beside it that it reaches now: a
 * narrow gap between the edge and another fence or a boulder (ledger: a wood yard sealed the
 * pasture's only gate, and the flock was never folded again). */
export function shutsOff(ctx: SystemContext, rect: Rect, door: Spot, green: Spot): boolean {
  const { world, content } = ctx;
  const map = world.map;
  const ring = { x: rect.x - 1, y: rect.y - 1, w: rect.w + 2, h: rect.h + 2 };
  const edge: number[] = [];
  const beside: Spot[] = [];
  for (let y = ring.y; y < ring.y + ring.h; y += 1)
    for (let x = ring.x; x < ring.x + ring.w; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (inRect(rect, x, y)) {
        if (onEdge(rect, x, y) && !(x === door.x && y === door.y)) edge.push(y * map.width + x);
      } else beside.push({ x, y, z: 0 });
    }
  const now = reachFrom(content, map, green);
  const reached = beside.filter(now);
  if (!reached.length) return false;
  const wall = content.buildings.parts.findIndex((p) => p.kind === 'wall') + 1;
  return withBuiltAll(map, edge, wall, () => {
    const after = reachFrom(content, map, green);
    return reached.some((s) => !after(s));
  });
}

/** Once a day: the first store kind whose store would save enough walking, or whose goods fill a
 * full home store, gets one sited (`build.storeSited`), its edge planned. */
export function planStores(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  const def = content.buildings.stores;
  const home = storeOf(world)[0];
  if (!home) return;
  state['storeFrom'] ||= world.tick;
  if (world.tick < (state['storeTried'] ?? 0) + TICKS_PER_DAY) return;
  state['storeTried'] = world.tick;
  // A full count of days of carrying first.
  if (world.tick < state['storeFrom']! + def.days * TICKS_PER_DAY) return;
  // Homes first: no store is sited while anyone sleeps out or a house is still going up (smoke:
  // five stores in the first sixty days held the second house back to day 120).
  if (homeless(world, content).length) return;
  if (housesOf(world).some((h) => h['state'] !== 'built' && h['state'] !== 'sent')) return;
  const at = { x: home['x'] as number, y: home['y'] as number };
  const full = homeFull(ctx);
  const kinds = [...def.kinds]
    .map((kind) => ({ kind, tiles: full ? homeTilesOf(ctx, kind.id) : 0 }))
    .sort((a, b) => b.tiles - a.tiles);
  for (const { kind, tiles } of kinds) {
    const mine = depotsOf(world).filter((d) => d['store'] === kind.id);
    if (mine.length >= def.most || mine.some((d) => d['state'] === 'plan')) continue;
    // A second only once the first has stood for a full count of days, so the carrying it is
    // weighed on already goes to the first.
    if (mine.some((d) => world.tick < builtAt(d) + def.days * TICKS_PER_DAY)) continue;
    const { gathered, used } = tripsFor(world, content, kind.goods);
    if (kind.eaten && gathered.length)
      used.push({ ...at, n: gathered.reduce((s, p) => s + p.n, 0) });
    const points = [...gathered, ...used];
    if (!points.length) continue;
    const stores = [at, ...mine.map(centreOf)];
    const now = walkOf(points, stores);
    const fills = !mine.length && tiles > 0;
    const site = siteStore(
      ctx,
      green,
      kind.eaten ? def.eatenNear : def.near,
      kind.w,
      kind.h,
      (c) => walkOf(points, [...stores, c]),
      mine.map(centreOf),
      (walk) => fills || (now - walk) / def.days >= def.save,
    );
    if (!site) continue;
    const before = Math.round(now / def.days);
    const after = Math.round(site.walk / def.days);
    const why = fills
      ? `the home store has no room left, and ${tiles} of its tiles hold ${kind.words}`
      : `the colony walked about ${before} tiles a day carrying ${kind.words} to and from the stores; from here, about ${after}`;
    const line = ctx.emit('build.storeSited', {
      causes: [home['made'] as number].filter((l) => l > 0),
      data: { store: kind.name, dir: dirFrom(green, site.rect), from: kind.from, to: kind.to, why },
    });
    const id = addEntity(world, 'depot', {
      ...{ store: kind.id, ...site.rect, z: 0, state: 'plan', line, built: 0, builtTick: 0 },
    });
    placeEdge(ctx, kind, site.rect, site.door, id, line);
    const width = world.map.width;
    for (const i of site.trees)
      addEntity(world, 'mark', { x: i % width, y: Math.floor(i / width), line, house: id });
    return;
  }
}

/** The store's parts as plans: its edge, the door (or a gap), the floor inside. */
export function placeEdge(
  ctx: SystemContext,
  kind: Pick<StoreKindDef, 'name' | 'wall' | 'door' | 'floor'>,
  rect: Rect,
  door: Spot,
  id: number,
  line: number,
): void {
  const { world, content } = ctx;
  const wall = kind.wall ? partOf(content, kind.wall)! : wallOf(content, ctx);
  const doorPart = kind.door ? partOf(content, kind.door) : undefined;
  const floor = kind.floor ? partOf(content, kind.floor) : undefined;
  const used = new Set<string>();
  for (let y = rect.y; y < rect.y + rect.h; y += 1)
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const atDoor = x === door.x && y === door.y;
      const part = atDoor ? doorPart : onEdge(rect, x, y) ? wall : floor;
      if (!part) continue;
      used.add(part.material);
      addEntity(world, 'plan', {
        ...{ part: part.id, x, y, z: 0, have: 0, also: 0, work: -1, state: 'plan', house: id },
        ...{ line, done: 0, waited: 0, shut: 0, held: 0 },
      });
    }
  for (const good of used) raiseStock(ctx, good, kind.name, line);
}

/** A planned store whose parts all stand is built (`build.storeBuilt`): its goods go there now. */
export function finishStores(ctx: SystemContext): void {
  const { world, content } = ctx;
  for (const d of depotsOf(world).filter((r) => r['state'] === 'plan')) {
    const plans = plansOf(world).filter((p) => p['house'] === d.id);
    if (plans.some((p) => p['state'] !== 'built')) continue;
    const kind = content.buildings.stores.kinds.find((k) => k.id === d['store'])!;
    d['state'] = 'built';
    d['builtTick'] = world.tick;
    d['built'] = ctx.emit('build.storeBuilt', {
      causes: [d['line'] as number, Math.max(0, ...plans.map((p) => p['done'] as number))].filter(
        (n) => n > 0,
      ),
      data: { store: kind.name, goods: kind.words },
    });
  }
}

// The smithy (Bundle 3, V-041, V-049, V-061): once the first ingot is in the store, the colony
// plans a smithy on the house of its best smith, on that house's outer side nearest water, 3 deep
// by 4 along the wall it shares, open-sided (no walls): a stone floor under a forge, an anvil block
// and a quench tub (furniture kinds that builders make, people/hearth.ts). Nobody places it; the
// Build sheet's Smithy level is the colony's want, and the plan can be sent back once. When its
// floors and pieces stand it is built and smiths work at the forge.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { inStore, itemsOf, layItem, raiseStock } from '../goods/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bedOwnedBy, furnitureOf } from './furniture.ts';
import { homeOf, mainOf, rowsOf, wantOf } from './houses.ts';
import { partOf, planPart, plansOf } from './plans.ts';
import { groundOf, housesOf, inRect, rectOf, type Rect } from './site.ts';
import { isTreeAt } from './way.ts';

export const SMITHY = 'smithy';

export const SMITHY_TABLES: Schemas = {
  /** The smithy: its footprint, the house it shares a wall with, `side` of that house, `state`
   * (`plan`, `built` or `sent`), the line that planned it and the reason it gives, `sent` 1 for a
   * replacement (it cannot be sent back), and the line saying it was built. */
  smithy: {
    ...{ x: 'int', y: 'int', w: 'count', h: 'count', house: 'entity', side: 'text' },
    ...{ state: 'text', line: 'event', why: 'text', sent: 'count', built: 'event' },
  },
};

export const smithiesOf = (world: WorldState): EntityRow[] => world.entities['smithy'] ?? [];

const SIDES = ['east', 'west', 'south', 'north'] as const;
type Side = (typeof SIDES)[number];

/** The smithing level of a person (the skill of the smith job, tools.json `job`). */
const levelOf = (world: WorldState, content: EngineContent, id: number): number => {
  const skill = content.jobs.find((j) => j.id === content.tools.job)?.skill;
  return (
    ((world.entities['skill'] ?? []).find((s) => s['person'] === id && s['skill'] === skill)?.[
      'level'
    ] as number) ?? 0
  );
};

/** The house (main row) `person` sleeps in, once built: their bed's, else their laid bedroll's. */
function houseOfPerson(world: WorldState, content: EngineContent, id: number) {
  const bed = bedOwnedBy(world, id);
  const roll = itemsOf(world).find(
    (i) => i['owner'] === id && i['kind'] === content.life.cart.bedroll && i['state'] === 'laid',
  );
  const h = bed
    ? housesOf(world).find(
        (r) => r['state'] === 'built' && inRect(rectOf(r), bed['x'] as number, bed['y'] as number),
      )
    : roll && homeOf(world, content, roll);
  return h ? mainOf(world, h) : undefined;
}

/** The footprint on one side of a house, sharing its wall, `off` tiles along it. */
function footprint(r: Rect, side: Side, off: number, depth: number, length: number): Rect {
  if (side === 'east') return { x: r.x + r.w - 1, y: r.y + off, w: depth, h: length };
  if (side === 'west') return { x: r.x - depth + 1, y: r.y + off, w: depth, h: length };
  if (side === 'south') return { x: r.x + off, y: r.y + r.h - 1, w: length, h: depth };
  return { x: r.x + off, y: r.y - depth + 1, w: length, h: depth };
}

/** The tiles of a footprint outside the house it shares a wall with, far side last. */
function outside(f: Rect, house: Rect, side: Side): [number, number][] {
  const tiles: [number, number][] = [];
  for (let y = f.y; y < f.y + f.h; y += 1)
    for (let x = f.x; x < f.x + f.w; x += 1) if (!inRect(house, x, y)) tiles.push([x, y]);
  const far = (t: [number, number]) =>
    side === 'east' ? t[0] : side === 'west' ? -t[0] : side === 'south' ? t[1] : -t[1];
  return tiles.sort((a, b) => far(a) - far(b) || a[1] - b[1] || a[0] - b[0]);
}

/** Tiles to the nearest water from a footprint's middle, within `near`; `near + 1` when none. */
function waterDist(world: WorldState, content: EngineContent, f: Rect, near: number) {
  const map = world.map;
  const [cx, cy] = [f.x + Math.floor(f.w / 2), f.y + Math.floor(f.h / 2)];
  for (let r = 1; r <= near; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const [x, y] = [cx + dx, cy + dy];
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (content.terrain.kinds[map.tiles[y * map.width + x]!]!.water) return r;
      }
  return near + 1;
}

/** Whether a smithy can stand on these tiles: dry buildable ground, nothing built, planned,
 * stored or lying there, no tree, off every house and reachable from the green. */
/** The trees to fell first if the tiles are free for a smithy (none when `trees` is false), or
 * undefined when they are not. A tree tile is cleared as a house's site is (P4.9: in forest every
 * side of a house can stand in trees); the other tiles must be open and reachable from the green. */
function free(
  ctx: SystemContext,
  tiles: [number, number][],
  green: { x: number; y: number },
  trees: boolean,
): number[] | undefined {
  const { world, content } = ctx;
  const map = world.map;
  const ground = groundOf(world);
  const fell: number[] = [];
  let open = false;
  for (const [x, y] of tiles) {
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) return undefined;
    const i = y * map.width + x;
    const kind = content.terrain.kinds[map.tiles[i]!]!;
    if (!kind.buildable || kind.water || kind.solid) return undefined;
    if (ground.taken.has(i) || ground.items.has(i) || inStore(world, x, y, 0)) return undefined;
    if (housesOf(world).some((h) => inRect(rectOf(h), x, y))) return undefined;
    // A smithy sent back is never chosen again.
    if (smithiesOf(world).some((s) => s['state'] === 'sent' && inRect(rectOf(s), x, y)))
      return undefined;
    if (isTreeAt(world, content, i)) {
      if (!trees) return undefined;
      fell.push(i);
      continue;
    }
    const f = map.features[i]! ? content.features[map.features[i]! - 1]! : undefined;
    if (f && f.kind !== 'bush' && f.kind !== 'herb') return undefined;
    if (!canReach(content, map, { ...green, z: 0 }, { x, y, z: 0 })) return undefined;
    open = true;
  }
  return open ? fell : undefined;
}

/** Whether an ingot lies in the store: the smithy is wanted from then (tools.json materials, and
 * any item that names the ore it is smelted from). */
export function ingotInStore(world: WorldState, content: EngineContent): EntityRow | undefined {
  const ingots = new Set([
    ...content.items.filter((i) => i.ore).map((i) => i.id),
    ...content.tools.materials.flatMap((m) => (m.ingot ? [m.ingot] : [])),
  ]);
  return itemsOf(world).find(
    (i) =>
      ingots.has(i['kind'] as string) &&
      !i['holder'] &&
      inStore(world, i['x'] as number, i['y'] as number, i['z'] as number),
  );
}

/** Hourly: finishes a smithy whose parts stand, or sites one for the best smith's house. */
/** The side of `house` (or of a room added to it) with free ground for a smithy, nearest water,
 * ties north, east, south, west. Every outer side shares a wall with the house. */
function sideBeside(ctx: SystemContext, house: EntityRow, green: { x: number; y: number }) {
  const { world, content } = ctx;
  const def = content.buildings.smithy;
  // Open ground first; only when no side has it, ground with trees to fell (fewest first).
  for (const trees of [false, true]) {
    let best: Beside | undefined;
    for (const row of rowsOf(world, house).filter((h) => h['state'] === 'built')) {
      const r = rectOf(row);
      SIDES.forEach((side, k) => {
        const vertical = side === 'east' || side === 'west';
        const span = (vertical ? r.h : r.w) - def.length;
        for (let off = 0; off <= Math.max(0, span); off += 1) {
          const f = footprint(r, side, off, def.depth, def.length);
          const fell = free(ctx, outside(f, r, side), green, trees);
          if (!fell) continue;
          const w = waterDist(world, content, f, def.near);
          const d = w + fell.length * 100;
          if (!best || d < best.d || (d === best.d && k < best.k))
            best = { f, side, d, w, k, r, fell };
        }
      });
    }
    if (best) return best;
  }
  return undefined;
}

type Beside = { f: Rect; side: Side; d: number; w: number; k: number; r: Rect; fell: number[] };

export function planSmithy(ctx: SystemContext, green: { x: number; y: number }, sent = 0): void {
  const { world, content, state } = ctx;
  const def = content.buildings.smithy;
  const live = smithiesOf(world).find((s) => s['state'] !== 'sent');
  if (live) return finishSmithy(ctx, live);
  const ingot = ingotInStore(world, content);
  if (!ingot) return;
  // The best smith: highest smithing level, ties by id, with a built house of their own. When no
  // side of their house has free ground, the next best smith's house is tried (P4.9: on anvil the
  // best smith's cottage stands in trees on every side).
  const smiths = (world.entities['person'] ?? [])
    .filter((p) => p['status'] === 'alive')
    .sort((a, b) => levelOf(world, content, b.id) - levelOf(world, content, a.id) || a.id - b.id);
  const first = smiths[0];
  if (!first || !houseOfPerson(world, content, first.id)) return;
  // With no ground found, look again once a day, not every hour.
  if (state['smithyNoGround'] && !sent && world.tick < (state['smithyTried'] ?? 0) + 1440) return;
  state['smithyTried'] = world.tick;
  let smith = first;
  let house = houseOfPerson(world, content, first.id)!;
  let best: Beside | undefined;
  const tried = new Set<number>();
  for (const p of smiths) {
    const home = houseOfPerson(world, content, p.id);
    if (!home || tried.has(home.id)) continue;
    tried.add(home.id);
    best = sideBeside(ctx, home, green);
    if (best) {
      [smith, house] = [p, home];
      break;
    }
  }
  if (!best) {
    state['smithyNoGround'] ||= ctx.emit('smithy.noGround', {
      causes: [ingot['made'] as number].filter((l) => l > 0),
      actors: [first.id],
      data: { name: first['name'] as string },
    });
    return;
  }
  state['smithyNoGround'] = 0;
  const water =
    best.w > def.near
      ? `no water lies within ${def.near} tiles`
      : `the water is ${best.w} tile${best.w > 1 ? 's' : ''} off`;
  const n = best.fell.length;
  const trees = n ? `; ${n} tree${n > 1 ? 's' : ''} to fell first` : '';
  const who =
    smith === first
      ? 'is the best smith'
      : `is the next best smith with free ground by their house`;
  const why = `${smith['name'] as string} ${who} (smithing ${levelOf(world, content, smith.id)}), and ${water}${trees}`;
  const want = wantOf(world, content, SMITHY);
  const line = ctx.emit('smithy.sited', {
    causes: [ingot['made'] as number, want.line ?? 0, house['built'] as number].filter(
      (l) => l > 0,
    ),
    actors: [smith.id],
    data: {
      dir: best.side,
      house: content.buildings.house.sizes.find((s) => s.id === house['size'])?.name ?? 'house',
      why,
    },
  });
  place(ctx, best, house, line, why, sent);
}

/** Lays the smithy out as plans: a floor under each piece, and the pieces (forge first). */
function place(
  ctx: SystemContext,
  { f, side, r, fell }: Beside,
  house: EntityRow,
  line: number,
  why: string,
  sent: number,
) {
  const { world, content } = ctx;
  const def = content.buildings.smithy;
  const id = addEntity(world, SMITHY, {
    ...{ x: f.x, y: f.y, w: f.w, h: f.h, house: house.id, side, state: 'plan' },
    ...{ line, why, sent, built: 0 },
  });
  // Trees on the site are felled first, as on a house's site.
  for (const i of fell)
    addEntity(world, 'mark', {
      x: i % world.map.width,
      y: Math.floor(i / world.map.width),
      line,
      house: id,
    });
  const floor = partOf(content, def.floor)!;
  // The far side of the footprint, from the house, holds the pieces.
  const spots = outside(f, r, side).slice(-def.length);
  def.pieces.forEach((kind, k) => {
    const [x, y] = spots[k]!;
    addEntity(world, 'plan', {
      ...{ part: floor.id, x, y, z: 0, have: 0, work: -1, state: 'plan', house: id },
      ...{ line, done: 0, waited: 0, shut: 0, held: 0 },
    });
    const piece = content.buildings.furniture.kinds.find((q) => q.id === kind)!;
    addEntity(world, 'furniture', {
      ...{ kind, x, y, z: 0, facing: 's', quality: 0, maker: 0, owner: 0, made: 0, line },
      ...{ state: 'plan', have: 0, work: -1, waited: 0 },
    });
    raiseStock(ctx, piece.material ?? content.buildings.furniture.material, piece.name, line);
  });
  raiseStock(ctx, floor.material, content.buildings.smithy.name, line);
}

/** The smithy is built once its floors are laid and its pieces made. */
function finishSmithy(ctx: SystemContext, s: EntityRow): void {
  const { world, content } = ctx;
  if (s['state'] !== 'plan') return;
  const plans = plansOf(world).filter((p) => p['house'] === s.id);
  const pieces = furnitureOf(world).filter(
    (f) =>
      inRect(rectOf(s), f['x'] as number, f['y'] as number) &&
      (content.buildings.smithy.pieces as readonly string[]).includes(f['kind'] as string),
  );
  if (!plans.length || plans.some((p) => p['state'] !== 'built')) return;
  if (
    pieces.length < content.buildings.smithy.pieces.length ||
    pieces.some((f) => f['state'] !== 'built')
  )
    return;
  const last = Math.max(
    ...plans.map((p) => p['done'] as number),
    ...pieces.map((f) => f['made'] as number),
  );
  s['state'] = 'built';
  s['built'] = ctx.emit('smithy.built', { causes: [last] });
}

/** The pieces laid with this smithy's plan. */
const piecesIn = (world: WorldState, s: EntityRow): EntityRow[] =>
  furnitureOf(world).filter(
    (f) => inRect(rectOf(s), f['x'] as number, f['y'] as number) && f['line'] === s['line'],
  );

/** Why a smithy cannot be sent back (the Build sheet shows no button then), else undefined. */
export function sendBackBlock(world: WorldState, s: EntityRow): string | undefined {
  if (s['state'] !== 'plan') return 'no such plan';
  if (s['sent']) return 'it was sent back once already';
  const begun =
    plansOf(world).some((p) => p['house'] === s.id && (p['done'] as number) > 0) ||
    piecesIn(world, s).some(
      (f) => f['state'] === 'built' || (f['have'] as number) > 0 || (f['work'] as number) >= 0,
    );
  return begun ? 'building has begun' : undefined;
}

/** The `sendBack {smithy}` lever: a smithy still planned, nothing built or made, not itself a
 * replacement, is dropped; what was brought is laid back, the site is never chosen again and the
 * colony chooses again at once. */
export function sendBackSmithy(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
  green: { x: number; y: number },
): void {
  const { world, content } = ctx;
  const s = smithiesOf(world).find((r) => r.id === data['smithy']);
  const why = s ? sendBackBlock(world, s) : 'no such plan';
  const plans = s ? plansOf(world).filter((p) => p['house'] === s.id) : [];
  const pieces = s ? piecesIn(world, s) : [];
  if (why) {
    ctx.emit('command.refused', { causes: [cause], data: { kind: 'sendBack', reason: why } });
    return;
  }
  const line = ctx.emit('smithy.sentBack', { causes: [cause, s!['line'] as number] });
  for (const p of plans) {
    const have = p['have'] as number;
    if (have > 0)
      layItem(world, {
        kind: planPart(content, p).material,
        count: have,
        ...{ x: p['x'] as number, y: p['y'] as number, z: 0, made: line },
      });
    removeEntity(world, 'plan', p.id);
  }
  for (const f of pieces) {
    const kind = content.buildings.furniture.kinds.find((q) => q.id === f['kind'])!;
    if ((f['have'] as number) > 0)
      layItem(world, {
        kind: kind.material ?? content.buildings.furniture.material,
        count: f['have'] as number,
        ...{ x: f['x'] as number, y: f['y'] as number, z: 0, made: line },
      });
    removeEntity(world, 'furniture', f.id);
  }
  s!['state'] = 'sent';
  planSmithy(ctx, green, 1);
}

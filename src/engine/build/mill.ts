// The quern, the mill and the oven (5B Bundle 4, P5.11, V-133): nobody orders any of them. Once
// grain is in store a quern is planned by the hall's hearth (else the first house's). Each day
// the colony reads the last `mill.days` days of grinding (table `grind`, people/mill.ts): when the
// quern took more than `mill.want` minutes a day, a mill is sited on the running water nearest the
// granary (`build.millNeeded`), its walls by the house wall rule, its millstones inside and its
// wheel in the water. Its wheel stands while that water is frozen (V-150): `mill.stood`, then
// `mill.turns`. Once flour has stood at its plate on `bake.oven.days` days since the mill was
// built (the mill grinds more than the hearth bakes), an oven is planned beside the mill's door (`build.ovenPlanned`). The mill can be sent back once.
import { TICKS_PER_DAY, WATER, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import {
  depotsOf,
  haveOf,
  itemsOf,
  layItem,
  marksOf,
  raiseStock,
  storeOf,
  wantOf,
} from '../goods/index.ts';
import { canReach, type Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isFrozen } from '../weather/index.ts';
import { furnitureOf } from './furniture.ts';
import { openGround } from './hearths.ts';
import { hallOf } from './homes.ts';
import { dirFrom } from './houses.ts';
import { planPart, plansOf } from './plans.ts';
import { doorOf, groundOf, outsideOf, scoreRect, type Rect } from './site.ts';
import { shutsOff } from './site.ts';
import { placeEdge } from './stores.ts';
import { roomsOf, siteFor } from './wants.ts';
import { inRect, isTreeAt, wayFrom, wayTo } from './way.ts';

export const MILL_TABLES: Schemas = {
  /** The mill: its footprint, the water tile its wheel turns in, `plan`, `built` or `sent`, the
   * lines that sited and built it, why it was wanted, `sent` 1 for a replacement (it cannot be sent
   * back), the millstones piece, and the line its wheel last stood on (0 while it turns). */
  mill: {
    ...{ x: 'int', y: 'int', w: 'count', h: 'count', wheel: 'int', state: 'text' },
    ...{ line: 'event', built: 'event', why: 'text', sent: 'count', stones: 'entity' },
    stood: 'event',
  },
  /** Minutes of grinding on one day (1 + its index): at the quern and at the mill. */
  grind: { day: 'int', quern: 'count', mill: 'count' },
};

export const millsOf = (world: WorldState): EntityRow[] => world.entities['mill'] ?? [];

/** The colony's mill, planned or built (not one sent back). */
export const millOf = (world: WorldState): EntityRow | undefined =>
  millsOf(world).find((m) => m['state'] !== 'sent');

/** Whether the mill stands and its wheel turns (its water is not frozen). */
export const turning = (world: WorldState, m: EntityRow | undefined): boolean =>
  !!m && m['state'] === 'built' && !isFrozen(world.map, m['wheel'] as number);

const today = (world: WorldState): number => Math.floor(world.tick / TICKS_PER_DAY) + 1;

/** Notes a minute of grinding today, at the quern or the mill. */
export function noteGrind(world: WorldState, where: 'quern' | 'mill'): void {
  const day = today(world);
  const rows = world.entities['grind'] ?? [];
  const row = rows.find((r) => r['day'] === day);
  if (row) row[where] = (row[where] as number) + 1;
  else addEntity(world, 'grind', { day, quern: +(where === 'quern'), mill: +(where === 'mill') });
}

/** Minutes ground at the quern today (each quern grinds at most `quern.most` a day). */
export const quernToday = (world: WorldState): number =>
  ((world.entities['grind'] ?? []).find((r) => r['day'] === today(world))?.['quern'] as number) ??
  0;

/** Grain is in store and no quern is planned or built: plan one by the hall's hearth. */
function planQuern(ctx: SystemContext): void {
  const { world, content } = ctx;
  const def = content.buildings.mill;
  if (furnitureOf(world).some((f) => f['kind'] === def.quern.kind)) return;
  const grain = itemsOf(world).find((i) => def.from.includes(i['kind'] as string));
  if (!grain) return;
  // The hall's room first, then the other rooms in the order their houses were built.
  const hall = hallOf(world);
  const rooms = roomsOf(world, content).sort(
    (a, b) => +(b.h.id === hall?.id) - +(a.h.id === hall?.id),
  );
  let rr: (typeof rooms)[number] | undefined;
  let at: ReturnType<typeof siteFor>;
  for (const r of rooms)
    if ((at = siteFor(world, content, r, def.quern.kind))) {
      rr = r;
      break;
    }
  if (!rr || !at) return;
  const kind = content.buildings.furniture.kinds.find((k) => k.id === def.quern.kind)!;
  const where = hall && rr.h.id === hall.id ? 'in the hall' : 'in a house by the green';
  const line = ctx.emit('build.quernPlanned', {
    causes: [grain['made'] as number].filter((l) => l > 0),
    data: { where },
  });
  addEntity(world, 'furniture', {
    ...{ kind: kind.id, x: at.x, y: at.y, z: 0, facing: at.facing, quality: 0, maker: 0 },
    ...{ owner: 0, made: 0, line, state: 'plan', have: 0, work: -1, waited: 0 },
  });
  raiseStock(ctx, kind.material ?? content.buildings.furniture.material, kind.name, line);
}

const RUNNING = new Set([WATER.indexOf('stream'), WATER.indexOf('river')]);
const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Where the grain is: the granary's middle, else the home store's first tile, else the green. */
function grainAt(world: WorldState, green: Spot): { x: number; y: number } {
  const g = depotsOf(world).find((d) => d['store'] === 'granary' && d['state'] === 'built');
  if (g)
    return {
      x: (g['x'] as number) + ((g['w'] as number) >> 1),
      y: (g['y'] as number) + ((g['h'] as number) >> 1),
    };
  const s = storeOf(world)[0];
  return s ? { x: s['x'] as number, y: s['y'] as number } : green;
}

/** The footprints touching running water within `mill.near` of the green, each with its wheel
 * tile (outside the middle of one side), nearest the grain first (ties in tile order). */
function footprints(ctx: SystemContext, green: Spot): { rect: Rect; wheel: number; d: number }[] {
  const { world, content } = ctx;
  const { w, h, near } = content.buildings.mill;
  const map = world.map;
  const grain = grainAt(world, green);
  const out: { rect: Rect; wheel: number; d: number }[] = [];
  for (let y = green.y - near; y <= green.y + near; y += 1)
    for (let x = green.x - near; x <= green.x + near; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const i = y * map.width + x;
      if (!RUNNING.has(map.water[i]!)) continue;
      // The water is outside one side's middle: west, east, north, south of the footprint.
      for (const rect of [
        { x: x + 1, y: y - (h >> 1), w, h },
        { x: x - w, y: y - (h >> 1), w, h },
        { x: x - (w >> 1), y: y + 1, w, h },
        { x: x - (w >> 1), y: y - h, w, h },
      ]) {
        const d = cheb(grain, { x: rect.x + (w >> 1), y: rect.y + (h >> 1) });
        out.push({ rect, wheel: i, d });
      }
    }
  return out.sort((a, b) => a.d - b.d || a.wheel - b.wheel);
}

/** The best mill site: buildable, kept clear, its door (facing the green) reachable, shutting
 * nobody off, and not one sent back before; undefined if none. */
function siteMill(ctx: SystemContext, green: Spot) {
  const { world, content } = ctx;
  const map = world.map;
  const sent = millsOf(world).filter((m) => m['state'] === 'sent');
  const ground = groundOf(world);
  const way = wayFrom(world, content, green);
  let tried = 0;
  for (const f of footprints(ctx, green)) {
    if (sent.some((m) => m['x'] === f.rect.x && m['y'] === f.rect.y)) continue;
    const fit = scoreRect(world, content, f.rect, undefined, ground);
    if (!fit) continue;
    if ((tried += 1) > content.buildings.mill.tries) return undefined;
    const door = doorOf(f.rect, green);
    const out = outsideOf(f.rect, door);
    if (way.trees[out.y * map.width + out.x]! < 0) continue;
    if (shutsOff(world, content, f.rect, door, green)) continue;
    const tiles = wayTo(way, out.y * map.width + out.x);
    if (tiles.some((i) => inRect(f.rect, i % map.width, Math.floor(i / map.width)))) continue;
    // Trees on the way in are felled with the site's own.
    const extra = tiles.filter((i) => isTreeAt(world, content, i) && !fit.trees.includes(i));
    return { ...f, door, trees: [...fit.trees, ...extra] };
  }
  return undefined;
}

/** Hours of grinding at the quern over the last days, or undefined while it is not enough. */
function quernHours(ctx: SystemContext): number | undefined {
  const { world, content } = ctx;
  const def = content.buildings.mill;
  const day = today(world);
  if (day <= def.days) return undefined;
  const rows = (world.entities['grind'] ?? []).filter(
    (r) => (r['day'] as number) < day && (r['day'] as number) >= day - def.days,
  );
  const minutes = rows.reduce((n, r) => n + (r['quern'] as number), 0) / def.days;
  return minutes > def.want ? minutes / 60 : undefined;
}

/** Sites the mill: its edge and floor as plans, its millstones in the middle away from the door. */
function planMill(ctx: SystemContext, green: Spot, sent = 0, causes: number[] = []): boolean {
  const { world, content } = ctx;
  const def = content.buildings.mill;
  const hours = quernHours(ctx);
  if (hours === undefined && !sent) return false;
  const site = siteMill(ctx, green);
  if (!site) return false;
  const why = sent
    ? 'the first site was sent back'
    : `grinding at the quern took ${Math.round(hours! * 2) / 2} hours a day for ${def.days} days`;
  const quern = furnitureOf(world).find((f) => f['kind'] === def.quern.kind);
  const line = ctx.emit('build.millNeeded', {
    causes: [...causes, quern?.['made'] as number].filter((l) => l > 0),
    data: { why, dir: dirFrom(green, site.rect) },
  });
  const id = addEntity(world, 'mill', {
    ...{ ...site.rect, wheel: site.wheel, state: 'plan', line, built: 0, why, sent, stood: 0 },
    stones: 0,
  });
  placeEdge(
    ctx,
    { name: 'mill', door: def.door, floor: def.floor },
    site.rect,
    site.door,
    id,
    line,
  );
  // The millstones stand on the inside tile farthest from the door.
  const inside: Spot[] = [];
  for (let y = site.rect.y + 1; y < site.rect.y + site.rect.h - 1; y += 1)
    for (let x = site.rect.x + 1; x < site.rect.x + site.rect.w - 1; x += 1)
      inside.push({ x, y, z: 0 });
  const at = inside.sort((a, b) => cheb(b, site.door) - cheb(a, site.door))[0]!;
  const kind = content.buildings.furniture.kinds.find((k) => k.id === def.stones)!;
  const mill = millsOf(world).find((m) => m.id === id)!;
  mill['stones'] = addEntity(world, 'furniture', {
    ...{ kind: kind.id, x: at.x, y: at.y, z: 0, facing: 's', quality: 0, maker: 0 },
    ...{ owner: 0, made: 0, line, state: 'plan', have: 0, work: -1, waited: 0 },
  });
  raiseStock(ctx, kind.material ?? content.buildings.furniture.material, kind.name, line);
  const width = world.map.width;
  for (const i of site.trees)
    addEntity(world, 'mark', { x: i % width, y: Math.floor(i / width), line, house: id });
  return true;
}

/** The mill stands once its parts and millstones do (`build.millBuilt`); after that its wheel
 * stops and turns with its water's ice. */
function watchMill(ctx: SystemContext): void {
  const { world } = ctx;
  const m = millOf(world);
  if (!m) return;
  if (m['state'] === 'plan') {
    const plans = plansOf(world).filter((p) => p['house'] === m.id);
    const stones = furnitureOf(world).find((f) => f.id === m['stones']);
    if (plans.some((p) => p['state'] !== 'built') || stones?.['state'] !== 'built') return;
    m['state'] = 'built';
    m['built'] = ctx.emit('build.millBuilt', {
      causes: [m['line'] as number, stones['made'] as number].filter((l) => l > 0),
      data: {},
    });
  }
  const frozen = isFrozen(world.map, m['wheel'] as number);
  if (frozen && !m['stood'])
    m['stood'] = ctx.emit('mill.stood', {
      causes: [world.map.tileCauses[m['wheel'] as number]!, m['built'] as number].filter(
        (l) => l > 0,
      ),
      data: {},
    });
  else if (!frozen && m['stood']) {
    ctx.emit('mill.turns', {
      causes: [world.map.tileCauses[m['wheel'] as number]!, m['stood'] as number].filter(
        (l) => l > 0,
      ),
      data: {},
    });
    m['stood'] = 0;
  }
}

/** Flour at its plate on `oven.days` days since the mill was built, and no oven: plan one beside
 * the mill's door. The days need not run together: bakers draw flour under its plate each day. */
function planOven(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  const def = content.buildings.mill;
  const m = millOf(world);
  if (!m || m['state'] !== 'built') return;
  if (furnitureOf(world).some((f) => f['kind'] === def.bake.oven.kind)) return;
  const flour = haveOf(world, content, def.flour);
  const want = wantOf(world, content, def.flour);
  if (want > 0 && flour >= want) state['flourOver'] = (state['flourOver'] ?? 0) + 1;
  if ((state['flourOver'] ?? 0) < def.bake.oven.days) return;
  const door = doorOf(
    { x: m['x'] as number, y: m['y'] as number, w: m['w'] as number, h: m['h'] as number },
    green,
  );
  const spots: Spot[] = [];
  for (let r = 2; r <= 4; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r)
          spots.push({ x: door.x + dx, y: door.y + dy, z: 0 });
  const at = spots.find(
    (s) => openGround(world, content, s.x, s.y) && canReach(content, world.map, green, s),
  );
  if (!at) return;
  const kind = content.buildings.furniture.kinds.find((k) => k.id === def.bake.oven.kind)!;
  const line = ctx.emit('build.ovenPlanned', {
    causes: [m['built'] as number].filter((l) => l > 0),
    data: { days: def.bake.oven.days },
  });
  addEntity(world, 'furniture', {
    ...{ kind: kind.id, x: at.x, y: at.y, z: 0, facing: 's', quality: 0, maker: 0 },
    ...{ owner: 0, made: 0, line, state: 'plan', have: 0, work: -1, waited: 0 },
  });
  raiseStock(ctx, kind.material ?? content.buildings.furniture.material, kind.name, line);
}

/** Hourly: the quern, the mill's wheel; once a day the grinding read and the mill and oven
 * planned from need. */
export function planMilling(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  planQuern(ctx);
  watchMill(ctx);
  const day = today(world);
  if (state['millDay'] === day) return;
  state['millDay'] = day;
  for (const r of (world.entities['grind'] ?? []).filter(
    (x) => (x['day'] as number) < day - content.buildings.mill.days,
  ))
    removeEntity(world, 'grind', r.id);
  if (!millOf(world)) planMill(ctx, green);
  planOven(ctx, green);
}

/** The mill's `sendBack {mill}` lever: once, before anything is built on it, the site is dropped
 * (material brought laid back, trees unmarked) and another chosen at once. */
export function sendBackMill(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
  green: Spot,
): void {
  const { world, content } = ctx;
  const m = millsOf(world).find((r) => r.id === data['mill']);
  const plans = m ? plansOf(world).filter((p) => p['house'] === m.id) : [];
  const stones = m ? furnitureOf(world).find((f) => f.id === m['stones']) : undefined;
  const why = !m
    ? 'no such plan'
    : m['state'] !== 'plan'
      ? 'it is built'
      : m['sent']
        ? 'it was sent back once already'
        : plans.some((p) => p['state'] === 'built') || stones?.['state'] === 'built'
          ? 'building has begun on it'
          : '';
  if (why) {
    ctx.emit('command.refused', { causes: [cause], data: { kind: 'sendBack', reason: why } });
    return;
  }
  const line = ctx.emit('build.millSentBack', { causes: [cause, m!['line'] as number] });
  const lay = (kind: string, count: number, r: EntityRow) =>
    count > 0 &&
    layItem(world, { kind, count, x: r['x'] as number, y: r['y'] as number, z: 0, made: line });
  for (const p of plans) {
    lay(planPart(content, p).material, p['have'] as number, p);
    removeEntity(world, 'plan', p.id);
  }
  if (stones) {
    const kind = content.buildings.furniture.kinds.find((q) => q.id === stones['kind'])!;
    lay(kind.material ?? content.buildings.furniture.material, stones['have'] as number, stones);
    removeEntity(world, 'furniture', stones.id);
  }
  for (const k of marksOf(world).filter((x) => x['house'] === m!.id))
    removeEntity(world, 'mark', k.id);
  m!['state'] = 'sent';
  planMill(ctx, green, 1, [line]);
}

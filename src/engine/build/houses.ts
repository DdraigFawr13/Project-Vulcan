// Houses (P3.7, V-049 to V-051): the Build sheet says how much the colony wants houses, 1 first
// to 4 last; nobody is told where to build. While people sleep under the open sky and no house
// has room for them, the colony sites one near the green (site.ts) and lays out its parts as
// plans, which builders take up like any other. A plan may be sent back once. Once every part
// stands the house is built, and at dusk the homeless carry their bedrolls in.
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type PartDef,
  type SizeDef,
  type WorldState,
} from '../core/index.ts';
import { addEntity, removeEntity, type Schemas } from '../entity/index.ts';
import { itemsOf, layItem, marksOf, raiseStock } from '../goods/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { bedOwnedBy, furnitureOf, piecesOf } from './furniture.ts';
import { planPart, plansOf } from './plans.ts';
import { widenRing } from './ring.ts';
import { roomAt } from './rooms.ts';
import {
  chooseHouse,
  housesOf,
  inRect,
  onEdge,
  partsOf,
  rectOf,
  type Rect,
  type Site,
} from './site.ts';

export const HOUSE_TABLES: Schemas = {
  /** A house, or a room added to one (`of`, the house; 0 for the house itself). `state`: `plan`,
   * `built`, or `sent` (sent back: the site is never chosen again). `door` is its tile index;
   * `line` the line that planned it and `why` the reason it gives; `sent` is 1 for a plan that
   * replaced one sent back (it cannot be sent back); `built` the line it was finished under;
   * `moved` the last line of someone carrying their bedroll in; `tried` the tick a built house
   * last looked for where to add a room, and `full` 1 when no side of it had ground for one;
   * `cold` the line saying a cold room of it had no floor free for a hearth (phase review). */
  house: {
    size: 'text',
    x: 'int',
    y: 'int',
    w: 'count',
    h: 'count',
    door: 'int',
    of: 'entity',
    state: 'text',
    line: 'event',
    why: 'text',
    sent: 'count',
    built: 'event',
    moved: 'event',
    tried: 'int',
    full: 'count',
    cold: 'event',
  },
  /** The Build sheet's level for a kind of building (1 first to 4 last) and its order. */
  want: { kind: 'text', level: 'count', line: 'event' },
};

export const HOUSE_KIND = 'house';
export const FIELD_KIND = 'field';

/** The size (or added room) a house row is. */
export const sizeOf = (content: EngineContent, h: EntityRow): SizeDef =>
  h['of']
    ? content.buildings.house.stage
    : content.buildings.house.sizes.find((s) => s.id === h['size'])!;

/** The name of the house a row (by id) is or belongs to, e.g. "cottage". */
export function houseName(world: WorldState, content: EngineContent, id: number): string {
  const h = housesOf(world).find((r) => r.id === id);
  if (h) return sizeOf(content, mainOf(world, h)).name;
  // Trees on a field's site are cleared the same way (P4.7).
  return (world.entities['field'] ?? []).some((f) => f.id === id) ? 'field' : '';
}

/** The house a row belongs to: itself, or the house a room was added to. */
export const mainOf = (world: WorldState, h: EntityRow): EntityRow =>
  h['of'] ? (housesOf(world).find((o) => o.id === h['of']) ?? h) : h;

/** The rows of a house: the house and the rooms added to it. */
export const rowsOf = (world: WorldState, main: EntityRow): EntityRow[] =>
  housesOf(world).filter((h) => (h.id === main.id || h['of'] === main.id) && h['state'] !== 'sent');

/** The house row whose inside (within its walls) holds tile (x, y), standing or planned. */
export function houseAt(world: WorldState, x: number, y: number): EntityRow | undefined {
  return housesOf(world).find(
    (h) => h['state'] !== 'sent' && inRect(rectOf(h), x, y) && !onEdge(rectOf(h), x, y),
  );
}

/** The Build sheet's level for a kind of building (houses, or fields, P4.7), and the order that
 * set it if the player did. */
export function wantOf(
  world: WorldState,
  content: EngineContent,
  kind: string = HOUSE_KIND,
): { level: number; line?: number } {
  const row = (world.entities['want'] ?? []).find((r) => r['kind'] === kind);
  return row
    ? { level: row['level'] as number, line: row['line'] as number }
    : { level: content.buildings[kind === FIELD_KIND ? 'field' : 'house'].start };
}

/** The `setBuild {kind, level}` lever (V-049): how much the colony wants a kind of building. */
export function setBuild(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
) {
  const { world, content } = ctx;
  const level = data['level'] as number;
  const levels = content.work.priority.words.length;
  const kind = data['kind'];
  if (
    (kind !== HOUSE_KIND && kind !== FIELD_KIND) ||
    !Number.isSafeInteger(level) ||
    level < 1 ||
    level > levels
  ) {
    ctx.emit('command.refused', {
      causes: [cause],
      data: { kind: 'setBuild', reason: 'no such kind of building or level' },
    });
    return;
  }
  if (wantOf(world, content, kind).level === level) return;
  const name = kind === FIELD_KIND ? content.buildings.field.name : content.buildings.house.name;
  const line = ctx.emit('build.wantSet', {
    causes: [cause],
    data: { kind: name, word: content.work.priority.words[level - 1]! },
  });
  const row = (world.entities['want'] ?? []).find((r) => r['kind'] === kind);
  if (row) Object.assign(row, { level, line });
  else addEntity(world, 'want', { kind, level, line });
}

const isBed = (content: EngineContent, i: EntityRow): boolean =>
  i['kind'] === content.life.cart.bedroll && i['state'] === 'laid' && !i['holder'];

/** The built house whose inside holds this laid bedroll, if any. */
export function homeOf(world: WorldState, content: EngineContent, bed: EntityRow) {
  if (!isBed(content, bed) || bed['z'] !== 0) return undefined;
  const h = houseAt(world, bed['x'] as number, bed['y'] as number);
  return h && h['state'] === 'built' ? mainOf(world, h) : undefined;
}

/** The built house a bed piece stands in, if any. */
function bedHome(world: WorldState, bed: EntityRow): EntityRow | undefined {
  const h = houseAt(world, bed['x'] as number, bed['y'] as number);
  return h && h['state'] === 'built' ? mainOf(world, h) : undefined;
}

/** The people of house `main` who sleep in a bed of theirs there and feel crowded: their
 * privacy need is under its line (P3.5), with the line that said so. */
export function crowdedIn(world: WorldState, main: EntityRow): { p: EntityRow; line: number }[] {
  const out: { p: EntityRow; line: number }[] = [];
  for (const b of piecesOf(world, 'bed')) {
    if (!b['owner'] || bedHome(world, b)?.id !== main.id) continue;
    const row = (world.entities['need'] ?? []).find(
      (n) => n['person'] === b['owner'] && n['need'] === 'privacy',
    );
    const p = (world.entities['person'] ?? []).find((q) => q.id === b['owner']);
    if (row?.['low'] && p?.['status'] === 'alive') out.push({ p, line: row['line'] as number });
  }
  return out.sort((a, b) => a.p.id - b.p.id);
}

/** The people asleep under the open sky: alive, and neither their bedroll nor their bed (P3.5)
 * in a built house. */
export function homeless(world: WorldState, content: EngineContent): EntityRow[] {
  const beds = itemsOf(world).filter((i) => isBed(content, i));
  return (world.entities['person'] ?? []).filter((p) => {
    if (p['status'] !== 'alive') return false;
    const bed = beds.find((b) => b['owner'] === p.id);
    const own = bedOwnedBy(world, p.id);
    return (!bed || !homeOf(world, content, bed)) && !(own && bedHome(world, own));
  });
}

/** Bedrolls laid in a house's rooms (with those of the colony's homeless, for its first house:
 * a house grows before another is built), and how many it has room for. */
export function bedsOf(world: WorldState, content: EngineContent, main: EntityRow) {
  const rows = rowsOf(world, main).filter((h) => h['state'] === 'built');
  const first = housesOf(world).find((h) => !h['of'] && h['state'] === 'built');
  const sleepers =
    itemsOf(world).filter((i) => isBed(content, i) && homeOf(world, content, i)?.id === main.id)
      .length +
    piecesOf(world, 'bed').filter((b) => b['owner'] && bedHome(world, b)?.id === main.id).length +
    (first?.id === main.id ? homeless(world, content).length : 0);
  return { sleepers, room: rows.reduce((n, h) => n + sizeOf(content, h).sleeps, 0) };
}

/** A free tile to lay a bedroll on inside a built house: a built floor with nothing on it, in
 * house and tile order. For a bedroll `leaving` a crowded room of a house (rooms.ts), only a
 * tile in another room of that house where one more bed would not crowd it. `reserved` tiles
 * (index) are where others are carrying their bedrolls, and count as laid. */
export function bedSpot(
  world: WorldState,
  content: EngineContent,
  leaving?: { x: number; y: number },
  reserved: readonly number[] = [],
): Spot | undefined {
  const map = world.map;
  const taken = new Set([
    ...itemsOf(world)
      .filter((i) => !i['holder'] && i['z'] === 0)
      .map((i) => (i['y'] as number) * map.width + (i['x'] as number)),
    ...furnitureOf(world)
      .filter((f) => f['z'] === 0)
      .map((f) => (f['y'] as number) * map.width + (f['x'] as number)),
    ...reserved,
  ]);
  const from = leaving && houseAt(world, leaving.x, leaving.y);
  const home = from && from['state'] === 'built' ? mainOf(world, from) : undefined;
  const old = home && roomAt(world, content, leaving!.x, leaving!.y);
  const crowd = content.buildings.rooms.crowd.tiles;
  for (const h of home ? rowsOf(world, home) : housesOf(world)) {
    if (h['state'] !== 'built') continue;
    const r = rectOf(h);
    const room = roomAt(world, content, r.x + 1, r.y + 1);
    if (home && (!room || room.tiles.includes(old?.tiles[0] ?? -1))) continue;
    // Bedrolls laid in it, and those on their way there.
    const coming = room ? reserved.filter((i) => room.tiles.includes(i)).length : 0;
    if (room && (room.beds + coming + 1) * crowd > room.tiles.length) continue;
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 1)
      for (let x = r.x + 1; x < r.x + r.w - 1; x += 1) {
        const part = content.buildings.parts[map.built[y * map.width + x]! - 1];
        if (part?.kind === 'floor' && !taken.has(y * map.width + x)) return { x, y, z: 0 };
      }
  }
  return undefined;
}

/** Lays out a sited house (or added room) as plans: the house row, a plan a tile, trees in the
 * footprint marked to fell first, and stock raised for its materials. */
export function placeHouse(
  ctx: SystemContext,
  site: Site,
  size: SizeDef,
  wall: PartDef,
  line: number,
  extra: { why: string; of?: number; sent?: number; skip?: (x: number, y: number) => boolean },
): number {
  const { world, content } = ctx;
  const map = world.map;
  const id = addEntity(world, 'house', {
    ...{ size: size.id, x: site.x, y: site.y, w: site.w, h: site.h },
    ...{ door: site.door.y * map.width + site.door.x, of: extra.of ?? 0, state: 'plan' },
    ...{
      line,
      why: extra.why,
      sent: extra.sent ?? 0,
      built: 0,
      moved: 0,
      tried: -TICKS_PER_DAY,
      full: 0,
      cold: 0,
    },
  });
  const parts = partsOf(content, site, site.door, wall, extra.skip);
  for (const { x, y, part } of parts)
    addEntity(world, 'plan', {
      ...{ part: part.id, x, y, z: 0, have: 0, work: -1, state: 'plan', house: id },
      ...{ line, done: 0, waited: 0, shut: 0, held: 0 },
    });
  for (const i of site.trees)
    addEntity(world, 'mark', { x: i % map.width, y: Math.floor(i / map.width), line, house: id });
  for (const good of new Set(parts.map((p) => p.part.material)))
    raiseStock(ctx, good, size.name, line);
  return id;
}

/** "first", "second", ... for the nth room of a house, the house itself the first. */
export const nthOf = (n: number): string =>
  ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'][n] ?? 'another';

/** Words for where a footprint lies from the green. */
export function dirFrom(green: Spot, site: Rect): string {
  const [dx, dy] = [2 * site.x + site.w - 1 - 2 * green.x, 2 * site.y + site.h - 1 - 2 * green.y];
  const ns = dy < 0 ? 'north' : 'south';
  const ew = dx < 0 ? 'west' : 'east';
  if (Math.abs(dx) > 2 * Math.abs(dy)) return ew;
  if (Math.abs(dy) > 2 * Math.abs(dx)) return ns;
  return `${ns}-${ew}`;
}

const reasonOf = (s: Site): string =>
  `the flattest dry ground near the green: ${s.rise} m of rise, ${s.far} tiles out, ` +
  (s.trees.length
    ? `${s.trees.length} tree${s.trees.length > 1 ? 's' : ''} to fell`
    : 'nothing to fell');

/** Sites a house for the homeless, if one is wanted: said with the need first, then the plan, or
 * one alert while no ground near the green fits. `sent` marks a plan replacing one sent back. */
export function planHouse(ctx: SystemContext, green: Spot, causes: number[], sent = 0): void {
  const { world, content, state } = ctx;
  if (housesOf(world).some((h) => h['state'] === 'plan' && !h['of'])) return;
  const open = homeless(world, content);
  if (!open.length) {
    state['need'] = 0;
    return;
  }
  if (bedSpot(world, content)) return;
  const want = wantOf(world, content);
  if (!state['need'])
    state['need'] = ctx.emit('build.needed', {
      causes: [
        ...(want.line ? [want.line] : []),
        ...[open[0]!['arrived'] as number].filter((l) => l > 0),
      ],
      data: { people: `${open.length} ${open.length > 1 ? 'people' : 'person'}` },
    });
  // With no ground found, the colony looks again once a day, not every hour.
  if (state['noGround'] && !sent && world.tick < (state['tried'] ?? 0) + TICKS_PER_DAY) return;
  state['tried'] = world.tick;
  let pick = chooseHouse(world, content, green, open.length);
  if (!pick) {
    if (!state['noGround'])
      state['noGround'] = ctx.emit('build.noGround', { causes: [state['need']!] });
    // The town ring widens (P4.7) and the colony looks again.
    if (widenRing(ctx, state['noGround']!)) pick = chooseHouse(world, content, green, open.length);
  }
  if (!pick) return;
  state['noGround'] = 0;
  const line = ctx.emit('build.sited', {
    causes: [state['need']!, ...causes],
    data: {
      size: pick.size.name,
      dir: dirFrom(green, pick.site),
      beds: pick.size.sleeps,
      why: pick.why,
    },
  });
  placeHouse(ctx, pick.site, pick.size, pick.wall, line, { why: reasonOf(pick.site), sent });
}

/** The `sendBack {house}` lever (V-049): a house or room still planned, with nothing yet built
 * and not itself a replacement, is dropped; what was brought for it is laid back where it
 * was, its site is never chosen again, and the colony chooses again at once. */
export function sendBack(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
  again: (h: EntityRow, line: number) => void,
): void {
  const { world, content } = ctx;
  const h = housesOf(world).find((r) => r.id === data['house']);
  const plans = h ? plansOf(world).filter((p) => p['house'] === h.id) : [];
  const why =
    !h || h['state'] !== 'plan'
      ? 'no such plan'
      : h['sent']
        ? 'it was sent back once already'
        : plans.some((p) => (p['done'] as number) > 0)
          ? 'building has begun'
          : undefined;
  if (why) {
    ctx.emit('command.refused', { causes: [cause], data: { kind: 'sendBack', reason: why } });
    return;
  }
  const main = mainOf(world, h!);
  const line = ctx.emit('build.sentBack', {
    causes: [cause, h!['line'] as number],
    data: { size: sizeOf(content, main).name, room: h!['of'] ? ' room' : '' },
  });
  for (const p of plans) {
    const have = p['have'] as number;
    if (have > 0) {
      const at = { x: p['x'] as number, y: p['y'] as number, z: 0 };
      layItem(world, { kind: planPart(content, p).material, count: have, ...at, made: line });
    }
    removeEntity(world, 'plan', p.id);
  }
  for (const m of marksOf(world).filter((m) => m['house'] === h!.id))
    removeEntity(world, 'mark', m.id);
  h!['state'] = 'sent';
  again(h!, line);
}

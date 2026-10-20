// What rooms lack and where it goes (P3.4, V-049's rule for furniture: colonists choose). A room
// with a role (it has beds) lacks what its role's `wants` list says: a bed for each sleeper, then
// a table, a chair each, a chest and a shelf. Beds always come first, in the room with the most
// sleepers lacking one. The bench comes before any of it. A piece is sited by its kind's `place`
// hint, away from the door and its way in, which always stays clear; it blocks no one's way.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity } from '../entity/index.ts';
import { itemsOf, raiseStock } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { anyBench, bedOwnedBy, furnitureOf } from './furniture.ts';
import { HEARTH } from './hearths.ts';
import { crowdedIn, mainOf, nthOf, rowsOf, sizeOf } from './houses.ts';
import { roomAt, type Room } from './rooms.ts';
import { housesOf, rectOf } from './site.ts';

export interface RoomRow {
  h: EntityRow;
  room: Room;
}

/** A piece a room lacks, and where it would go. */
export interface Want {
  kind: string;
  rr: RoomRow;
  at: { x: number; y: number; facing: string };
  /** How many of the kind it has, and how many it should. */
  have: number;
  need: number;
}

/** Every built house room that is closed off, in house order. */
export function roomsOf(world: WorldState, content: EngineContent): RoomRow[] {
  return housesOf(world)
    .filter((h) => h['state'] === 'built')
    .flatMap((h) => {
      const r = rectOf(h);
      const room = roomAt(world, content, r.x + 1, r.y + 1);
      return room ? [{ h, room }] : [];
    });
}

/** "cottage", or "cottage's second room" for a room added to it. */
export function roomName(world: WorldState, content: EngineContent, h: EntityRow): string {
  if (h['sick']) return 'sickroom';
  const main = mainOf(world, h);
  const name = sizeOf(content, main).name;
  return h['of']
    ? `${name}'s ${nthOf(rowsOf(world, main).findIndex((o) => o.id === h.id))} room`
    : name;
}

const DIRS = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
] as const;
const dirOf = (dx: number, dy: number): string =>
  Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'n' : 's') : dx > 0 ? 'e' : 'w';

/** Where a piece of `kind` would go in the room, or undefined when it has no free tile. */
export function siteFor(
  world: WorldState,
  content: EngineContent,
  rr: RoomRow,
  kind: string,
): { x: number; y: number; facing: string } | undefined {
  const { room } = rr;
  const width = world.map.width;
  const place = content.buildings.furniture.kinds.find((k) => k.id === kind)!.place;
  const xy = (i: number) => ({ x: i % width, y: Math.floor(i / width) });
  const cheb = (a: number, b: number) =>
    Math.max(Math.abs(xy(a).x - xy(b).x), Math.abs(xy(a).y - xy(b).y));
  const inside = new Set(room.tiles);
  // The tile just inside each door stays clear: it is the way in.
  const wayIn = new Set(
    room.doorTiles
      .flatMap((d) => [d - 1, d + 1, d - width, d + width])
      .filter((i) => inside.has(i)),
  );
  const isWall = (i: number) => content.buildings.parts[world.map.built[i]! - 1]?.kind === 'wall';
  const pieces = furnitureOf(world).filter(
    (f) => f['z'] === 0 && inside.has((f['y'] as number) * width + (f['x'] as number)),
  );
  const idx = (f: EntityRow) => (f['y'] as number) * width + (f['x'] as number);
  // What lies on the room's tiles (a bedroll, a pile) and the pieces: those tiles are taken.
  const lying = itemsOf(world).filter((i) => !i['holder'] && i['z'] === 0 && inside.has(idx(i)));
  // A bed may stand where a sleeper's bedroll lies: the roll goes when they claim it.
  const blocking = lying.filter((i) => kind !== 'bed' || i['kind'] !== content.life.cart.bedroll);
  const taken = new Set([...blocking.map(idx), ...pieces.map(idx)]);
  // A room keeps its hearth's tile free until it has one (P3.6, V-068): nothing else takes the
  // floor the hearth would stand on, or a room furnished in summer has no tile left for one when
  // the cold comes. Every house size leaves room for its beds beside it (buildings.json).
  const keep =
    kind !== HEARTH && !pieces.some((f) => f['kind'] === HEARTH)
      ? siteFor(world, content, rr, HEARTH)
      : undefined;
  const hearthTile = keep ? keep.y * width + keep.x : -1;
  const free = room.tiles
    .filter((i) => !wayIn.has(i) && !taken.has(i) && i !== hearthTile)
    .sort((a, b) => a - b);
  if (!free.length) return undefined;
  // Beds first (P3.4): other pieces (not the bench beds are made at) leave a tile for each
  // sleeper here without a bed, and one more while anyone in the colony has none, or a late
  // sleeper finds the floor full.
  if (kind !== 'bed' && kind !== 'bench' && kind !== HEARTH) {
    const bedless = (world.entities['person'] ?? []).some(
      (p) => p['status'] === 'alive' && !bedOwnedBy(world, p.id),
    );
    if (free.length <= Math.max(0, room.sleepers - room.bedPieces) + (bedless ? 1 : 0))
      return undefined;
  }
  const wallSide = (i: number) => DIRS.find(([, dx, dy]) => isWall(i + dx + dy * width));
  const apart = (i: number, from: number[]) => Math.min(99, ...from.map((j) => cheb(i, j)));
  const awayDoor = (i: number) => Math.min(3, apart(i, room.doorTiles));
  const ofKind = (k: string) => pieces.filter((f) => f['kind'] === k).map(idx);
  const best = (list: number[], score: (i: number) => number) =>
    list.reduce<number | undefined>(
      (b, i) => (b === undefined || score(i) > score(b) ? i : b),
      undefined,
    );
  const beside = (k: string) => {
    const near = ofKind(k).flatMap((j) => [j - 1, j + 1, j - width, j + width]);
    return free.filter((i) => near.includes(i));
  };
  const walls = free.filter((i) => wallSide(i));
  const rolls = lying.filter((it) => it['kind'] === content.life.cart.bedroll).map(idx);
  const beds = [...ofKind('bed'), ...rolls];
  let pick: number | undefined;
  if (place === 'beside table' && beside('table').length) pick = beside('table')[0];
  else if (place === 'bed foot' && beside('bed').length) pick = beside('bed')[0];
  else if (place === 'middle' || place === 'beside table' || place === 'centre') {
    const open = free.filter((i) => !wallSide(i));
    // A hearth ('centre') takes the free tile nearest the middle, wall or not.
    const list = open.length && place !== 'centre' ? open : free;
    const [sx, sy] = [
      room.tiles.reduce((s, i) => s + xy(i).x, 0),
      room.tiles.reduce((s, i) => s + xy(i).y, 0),
    ];
    const n = room.tiles.length;
    pick = best(
      list,
      (i) =>
        (place === 'centre' ? 0 : 100 * awayDoor(i)) -
        Math.abs(xy(i).x * n - sx) -
        Math.abs(xy(i).y * n - sy),
    );
  } else {
    // Against a wall, as far from the door (and, but for a bed, from the beds) as it can be.
    pick = best(
      walls.length ? walls : free,
      (i) => 1000 * awayDoor(i) + (kind === 'bed' ? 0 : apart(i, beds)),
    );
  }
  if (pick === undefined) return undefined;
  const { x, y } = xy(pick);
  const wall = wallSide(pick);
  let facing = 's';
  if (kind === 'bed') facing = wall && (wall[0] === 'n' || wall[0] === 's') ? 'v' : 'h';
  else if (kind === 'chair') {
    const t = ofKind('table')[0];
    facing = t === undefined ? 's' : dirOf(xy(t).x - x, xy(t).y - y);
  } else if (wall) facing = DIRS[(DIRS.indexOf(wall) + 2) % 4]![0];
  return { x, y, facing };
}

/** What a room lacks, in the order of its role's wants: counts include pieces still planned. */
export function lacks(world: WorldState, content: EngineContent, rr: RoomRow) {
  // The sickroom's wants are its beds alone (spareBed).
  if (rr.h['sick']) return [];
  const def = content.buildings.rooms.wants.find((w) => w.role === rr.room.role?.id);
  const inside = new Set(rr.room.tiles);
  const width = world.map.width;
  const have = (k: string) =>
    furnitureOf(world).filter(
      (f) =>
        f['kind'] === k &&
        f['z'] === 0 &&
        inside.has((f['y'] as number) * width + (f['x'] as number)),
    ).length;
  return (def?.kinds ?? []).map((w) => {
    const need = w.per === 'sleeper' ? rr.room.sleepers : 1;
    return { kind: w.kind, have: have(w.kind), need };
  });
}

/** A room added for privacy (grow.ts) has no sleeper yet, so no role and no wants: it lacks one
 * bed while someone in its house is crowded, for them to move to (claim.ts). */
function spareBed(
  world: WorldState,
  content: EngineContent,
  rr: RoomRow,
): Omit<Want, 'rr' | 'at'> | undefined {
  const { room, h } = rr;
  const inside = new Set(room.tiles);
  const width = world.map.width;
  // Beds here, counting those still planned.
  const beds = furnitureOf(world).filter(
    (f) =>
      f['kind'] === 'bed' &&
      f['z'] === 0 &&
      inside.has((f['y'] as number) * width + (f['x'] as number)),
  ).length;
  // The sickroom (P5.6) wants its `health.sickroom.beds`.
  const need = content.health.sickroom.beds;
  if (h['sick']) return beds < need ? { kind: 'bed', have: beds, need } : undefined;
  if (!h['of'] || room.sleepers) return undefined;
  if (beds) return undefined;
  return crowdedIn(world, mainOf(world, h)).length ? { kind: 'bed', have: 0, need: 1 } : undefined;
}

/** The next piece to make: a bed in the room with the most sleepers lacking one, else the first
 * thing the room with the most sleepers lacks. Only what has a free tile to go on. */
export function nextWant(world: WorldState, content: EngineContent): Want | undefined {
  const rooms = roomsOf(world, content);
  let bed: Want | undefined;
  for (const rr of rooms) {
    const l =
      lacks(world, content, rr).find((w) => w.kind === 'bed' && w.have < w.need) ??
      spareBed(world, content, rr);
    if (!l || (bed && l.need - l.have <= bed.need - bed.have)) continue;
    const at = siteFor(world, content, rr, 'bed');
    if (at) bed = { ...l, rr, at };
  }
  if (bed) return bed;
  const order = [...rooms].sort((a, b) => b.room.sleepers - a.room.sleepers);
  for (const rr of order) {
    const wants = lacks(world, content, rr);
    // Beds first in a room too: nothing else takes the floor a sleeper's bed would stand on.
    const bedsLack = wants.some((w) => w.kind === 'bed' && w.have < w.need);
    for (const l of wants) {
      if (bedsLack && l.kind !== 'bed') continue;
      // A hearth is the builders' to plan and make (hearths.ts), not carpentry's.
      if (l.have >= l.need || content.buildings.furniture.kinds.find((k) => k.id === l.kind)?.job)
        continue;
      const at = siteFor(world, content, rr, l.kind);
      if (at) return { ...l, rr, at };
    }
  }
  return undefined;
}

/** Once a built room lacks furniture and there is no bench, the best crafter sets one up in the
 * largest room that has space, against a wall away from the door and the beds. */
export function planBench(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (anyBench(world) || !nextWant(world, content)) return;
  const trade = content.jobs.find((j) => j.id === content.buildings.furniture.job)?.skill;
  const skill = (p: EntityRow) =>
    (world.entities['skill'] ?? []).find((s) => s['person'] === p.id && s['skill'] === trade)?.[
      'level'
    ] as number;
  const maker = (world.entities['person'] ?? [])
    .filter((p) => p['status'] === 'alive')
    .reduce<EntityRow | undefined>((b, p) => (!b || skill(p) > skill(b) ? p : b), undefined);
  if (!maker) return;
  const rooms = [...roomsOf(world, content)].sort(
    (a, b) => b.room.tiles.length - a.room.tiles.length,
  );
  for (const rr of rooms) {
    const at = siteFor(world, content, rr, 'bench');
    if (!at) continue;
    const line = ctx.emit('furniture.benchPlaced', {
      causes: [rr.h['built'] as number],
      actors: [maker.id],
      data: { maker: maker['name'] as string, room: roomName(world, content, rr.h) },
    });
    addEntity(world, 'furniture', {
      ...{ kind: 'bench', x: at.x, y: at.y, z: 0, facing: at.facing, quality: 0, maker: 0 },
      ...{ owner: 0, made: 0, line, state: 'plan', have: 0, work: -1, waited: 0 },
    });
    raiseStock(ctx, content.buildings.furniture.material, 'bench', line);
    return;
  }
}

/** A number that changes whenever what a room lacks could: houses built, pieces made or planned,
 * beds owned, people crowded, bedrolls laid. A want searched for in vain need not be searched for again until it
 * changes. Always 1 or more. */
export function wantSignature(world: WorldState, content: EngineContent): number {
  const rolls = itemsOf(world).filter(
    (i) => i['kind'] === content.life.cart.bedroll && i['state'] === 'laid' && !i['holder'],
  );
  const pieces = furnitureOf(world);
  let sig = 1 + rolls.length;
  sig = sig * 31 + pieces.length;
  sig = sig * 31 + pieces.filter((f) => f['state'] === 'built').length;
  sig = sig * 31 + pieces.filter((f) => f['owner']).length;
  sig = sig * 31 + housesOf(world).filter((h) => h['state'] === 'built').length;
  // A spare bed is wanted for whoever is crowded (phase review), so their count is in it too.
  const crowded = (world.entities['need'] ?? []).filter(
    (n) => n['need'] === 'privacy' && n['low'],
  ).length;
  sig = sig * 31 + crowded;
  // Each bedroll's tile, scrambled so a move changes the sum (a plain x + 7y missed a move of
  // 7 east and 1 north, found in the phase review).
  const { width } = world.map;
  const tiles = rolls.reduce(
    (n, i) => (n + Math.imul((i['y'] as number) * width + (i['x'] as number) + 1, 0x9e3779b1)) | 0,
    0,
  );
  return (sig * 1009 + tiles) >>> 0 || 1;
}

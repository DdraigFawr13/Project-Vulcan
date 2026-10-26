// Fire (P3.6, V-042): a hearth is a furniture piece (build/furniture.ts) and a fire is the row
// keyed to it: whether it is lit, the fuel it has left in minutes, which fuel, whether it is banked
// (burning low and slow for the night) and the tick it was last used, which the people mark
// (people/hearth.ts `markUsed`): a fire knows no people (V-042). Its heat reaches its room's tiles,
// worked out when asked (heat.ts), and nothing about a room's warmth is stored (V-043).
import { clockAt, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { furnitureOf, greenOf, houseAt, roomAt, roomName } from '../build/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const FIRE_TABLES: Schemas = {
  /** `piece`: the hearth (a furniture row); `lit`: 1 while it burns; `fuel`: minutes of fuel
   * left; `kind`: the fuel (work.json `fire.fuels`), '' before any; `banked`: 1 while it burns
   * low; `used`: the tick someone was last in its room or reach; `line`: its last line (built,
   * lit, banked, tended), which the next one cites; `ash`: minutes burned towards the next
   * ash laid beside the hearth (lamp.json `ash`, system.ts). */
  fire: {
    piece: 'entity',
    lit: 'count',
    fuel: 'count',
    kind: 'text',
    banked: 'count',
    used: 'int',
    line: 'event',
    ash: 'count',
  },
};

export const firesOf = (world: WorldState): EntityRow[] => world.entities['fire'] ?? [];

export const fireOf = (world: WorldState, piece: number): EntityRow | undefined =>
  firesOf(world).find((f) => f['piece'] === piece);

/** The hearth piece a fire is keyed to. */
export const pieceOfFire = (world: WorldState, fire: EntityRow): EntityRow =>
  furnitureOf(world).find((f) => f.id === fire['piece'])!;

export const fuelOf = (content: EngineContent, id: string) =>
  content.work.fire.fuels.find((f) => f.id === id);

/** A new, unlit fire for a hearth just built; `cause` is the line that built it. */
export function createFire(ctx: SystemContext, piece: EntityRow, cause: number): void {
  addEntity(ctx.world, 'fire', {
    ...{ piece: piece.id, lit: 0, fuel: 0, kind: '', banked: 0, ash: 0 },
    ...{ used: ctx.world.tick, line: cause },
  });
}

/** The surface tiles a fire warms: those of the closed room it stands in, else the open tiles
 * within `fire.radius` of it. */
export function reachOf(world: WorldState, content: EngineContent, piece: EntityRow): number[] {
  const map = world.map;
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const room = roomAt(world, content, x, y);
  if (room) return room.tiles;
  const r = content.work.fire.radius;
  const out: number[] = [];
  // In the open it warms open ground only: not through a wall, nor a house's floor beyond it.
  for (let ty = Math.max(0, y - r); ty <= Math.min(map.height - 1, y + r); ty += 1)
    for (let tx = Math.max(0, x - r); tx <= Math.min(map.width - 1, x + r); tx += 1) {
      const i = ty * map.width + tx;
      if (!map.built[i] || (tx === x && ty === y)) out.push(i);
    }
  return out;
}

/** Where a fire is, in words: "in the cottage", "on the green" or "outdoors"; `indoors` when it
 * stands in a room. */
export function placeOf(
  world: WorldState,
  content: EngineContent,
  piece: EntityRow,
): { where: string; room: string; indoors: boolean } {
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const h = roomAt(world, content, x, y) ? houseAt(world, x, y) : undefined;
  if (h) {
    const room = roomName(world, content, h);
    return { where: `in the ${room}`, room, indoors: true };
  }
  const g = greenOf(world);
  const near = Math.max(Math.abs(g.x - x), Math.abs(g.y - y)) <= 3;
  return near
    ? { where: 'on the green', room: 'green', indoors: false }
    : { where: 'outdoors', room: 'open ground', indoors: false };
}

/** A tick in words: "06:00 on day 3 of Thawmonth". */
export function timeWords(content: EngineContent, tick: number): string {
  const c = clockAt(tick, content.calendar);
  const hm = `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
  return `${hm} on day ${c.day} of ${content.calendar.monthNames[c.month]}`;
}

/** `p` banks the lit fire whose reach includes `at` for the night, if it is not banked yet. */
export function bankFire(ctx: SystemContext, p: EntityRow, at: Spot): void {
  const { world, content } = ctx;
  if (at.z !== 0) return;
  const i = at.y * world.map.width + at.x;
  for (const f of firesOf(world)) {
    if (!f['lit'] || f['banked']) continue;
    const piece = pieceOfFire(world, f);
    if (!reachOf(world, content, piece).includes(i)) continue;
    f['banked'] = 1;
    f['line'] = ctx.emit('fire.banked', {
      causes: [f['line'] as number],
      actors: [p.id],
      data: { name: p['name'] as string, where: placeOf(world, content, piece).where },
    });
  }
}

/** The hearth `p` has just finished: it stands, quality plain, with an unlit fire; one line. */
export function layHearth(ctx: SystemContext, p: EntityRow, piece: EntityRow): void {
  const { world, content } = ctx;
  const where = placeOf(world, content, piece);
  const plain = content.buildings.furniture.quality.find((q) => q.id === 'plain')!;
  const green = where.where === 'on the green';
  const made = ctx.emit('fire.built', {
    causes: [p['took'] as number, piece['line'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      what: green ? 'a campfire' : 'a hearth',
      where: where.where,
    },
  });
  Object.assign(piece, {
    state: 'built',
    quality: plain.at,
    maker: p.id,
    made,
    work: 0,
    waited: 0,
  });
  createFire(ctx, piece, made);
}

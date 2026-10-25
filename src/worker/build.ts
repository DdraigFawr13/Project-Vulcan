// The Build sheet's view of houses and rooms (P3.7, P3.3, P3.8) and what a tile in one shows:
// the engine's own answers (sizes, rooms, the need, the green) put into words and numbers for the
// page. Pure reads of the world, like goods.ts.
import { content } from '../content/index.ts';
import {
  buildWantOf,
  dirFrom,
  greenOf,
  homeless,
  houseAt,
  housesOf,
  ingotInStore,
  mainOf,
  nthOf,
  planAt,
  planPart,
  plansOf,
  piecesOf,
  recordOf,
  rectOf,
  roomAt,
  rowsOf,
  sendBackBlock,
  sizeOf,
  smithiesOf,
  householdOf,
  whoseOf,
  type EntityRow,
  type Room,
  type SimEvent,
  type Stub,
  type WorldState,
} from '../engine/index.ts';
import { buildFields } from './fields.ts';
import { burialRow, sickBeds, word } from './places.ts';
import { roomWarmth } from './fires.ts';
import { pastureRow } from './flock.ts';
import { homeRows, homesRow } from './strangers.ts';
import type { LedgerLine, TileView } from './protocol.ts';
import type { BuildRow, BuildView, SmithyRow } from './protocol-build.ts';

const itemName = (kind: string): string => content.items.find((i) => i.id === kind)?.name ?? kind;

/** "cottage", "Gwallog's home" or "hall" (P5.14), or "cottage's second room" for a room added. */
function nameOf(world: WorldState, h: EntityRow): string {
  const main = mainOf(world, h);
  const owner = main['owner'] as number;
  const name = main['hall']
    ? 'hall'
    : owner
      ? `${whoseOf(world, householdOf(world, owner))} home`
      : sizeOf(content, main).name;
  return h['of'] ? `${name}'s ${nthOf(rowsOf(world, main).indexOf(h))} room` : name;
}

/** Whether a plan may still be sent back: planned, not a replacement, nothing built on it yet. */
const canSendBack = (world: WorldState, h: EntityRow): boolean =>
  h['state'] === 'plan' &&
  !h['sent'] &&
  !plansOf(world).some((p) => p['house'] === h.id && (p['done'] as number) > 0);

/** Material brought of what a house or room needs, per good. */
function matsOf(world: WorldState, h: EntityRow): BuildRow['mats'] {
  const mats = new Map<string, { have: number; cost: number }>();
  for (const p of plansOf(world).filter((p) => p['house'] === h.id)) {
    const part = planPart(content, p);
    const m = mats.get(part.material) ?? { have: 0, cost: 0 };
    m.cost += part.cost;
    m.have += p['state'] === 'built' ? part.cost : (p['have'] as number);
    mats.set(part.material, m);
    if (part.also) {
      const a = mats.get(part.also.material) ?? { have: 0, cost: 0 };
      a.cost += part.also.cost;
      a.have += p['state'] === 'built' ? part.also.cost : (p['also'] as number);
      mats.set(part.also.material, a);
    }
  }
  return [...mats].map(([good, m]) => ({ good: itemName(good), ...m }));
}

/** "5 people sleep under the open sky" (the event's words), or "none now". */
function needOf(world: WorldState): string {
  const n = homeless(world, content).length;
  if (!n) return 'none now';
  return `${n} ${n > 1 ? 'people sleep' : 'person sleeps'} under the open sky`;
}

/** The Smithy row: shown once an ingot lies in the store or a smithy is planned (Bundle 3). */
function smithyRow(world: WorldState): SmithyRow | undefined {
  const s = smithiesOf(world).find((r) => r['state'] !== 'sent');
  if (!s && !ingotInStore(world, content)) return undefined;
  const { level } = buildWantOf(world, content, 'smithy');
  const want = { level, word: content.work.priority.words[level - 1] ?? '' };
  if (!s) return { want };
  const house = housesOf(world).find((h) => h.id === s['house']);
  const name = house ? sizeOf(content, mainOf(world, house)).name : 'house';
  return {
    want,
    plan: {
      id: s.id,
      state: s['state'] as string,
      where: `on the ${name}'s ${s['side'] as string} side`,
      why: s['why'] as string,
      back: !sendBackBlock(world, s),
      sent: !!s['sent'],
    },
  };
}

/** The Build sheet and the map's green and house labels. */
export function buildView(world: WorldState): BuildView {
  const green = greenOf(world);
  const level = buildWantOf(world, content).level;
  const state = world.systems['build'] ?? {};
  const smithy = smithyRow(world);
  const burial = burialRow(world);
  const pasture = pastureRow(world);
  const homes = homesRow(world);
  return {
    green: { x: green.x, y: green.y },
    want: { level, word: content.work.priority.words[level - 1] ?? '' },
    ...buildFields(world),
    ...(smithy && { smithy }),
    ...(burial && { burial }),
    ...(pasture && { pasture }),
    ...(homes && { homes }),
    need: needOf(world),
    noGround: !!state['noGround'] && homeless(world, content).length > 0,
    houses: housesOf(world)
      .filter((h) => h['state'] !== 'sent')
      .map((h) => ({
        id: h.id,
        name: nameOf(world, h),
        size: sizeOf(content, h).name,
        state: h['state'] as string,
        ...rectOf(h),
        of: h['of'] as number,
        beds: sizeOf(content, h).sleeps,
        dir: dirFrom(green, rectOf(h)),
        back: canSendBack(world, h),
        sent: !!h['sent'],
        why: h['why'] as string,
        mats: matsOf(world, h),
      })),
  };
}

/** "Pedr's bedroom" when every bed in the room is one person's, else "the cottage". */
function roomWords(world: WorldState, room: Room, house: string): string {
  const inside = new Set(room.tiles);
  const owners = new Set(
    piecesOf(world, 'bed')
      .filter((b) => inside.has((b['y'] as number) * world.map.width + (b['x'] as number)))
      .map((b) => b['owner'] as number),
  );
  const [owner] = owners.size === 1 ? owners : [];
  const who = (world.entities['person'] ?? []).find((p) => p.id === owner);
  return who && room.role ? `${who['name'] as string}'s ${room.role.name}` : `the ${house}`;
}

/** The tile's house and room rows (surface only): which house the tile belongs to, its roof and,
 * once walls and a door close it in, its room as `roomAt` works it out. */
export function tileHouse(
  world: WorldState,
  x: number,
  y: number,
  lineOf: (e: SimEvent | Stub) => LedgerLine,
): Pick<TileView, 'house' | 'room'> {
  const id = (planAt(world, x, y)?.['house'] as number | undefined) || houseAt(world, x, y)?.id;
  const h = id ? housesOf(world).find((r) => r.id === id && r['state'] !== 'sent') : undefined;
  if (!h) return {};
  const planned = h['state'] === 'plan';
  const sited = recordOf(world, h['line'] as number);
  const name = nameOf(world, h);
  const room = roomAt(world, content, x, y);
  const def = content.buildings.rooms;
  const bed = def.roles.reduce((a, r) => (r.beds < a.beds ? r : a));
  const open = homeless(world, content).length;
  return {
    house: {
      id: h.id,
      name,
      state: h['state'] as string,
      why: h['why'] as string,
      back: canSendBack(world, h),
      roof: planned ? `${def.roof}, laid with the walls` : `${def.roof} (not drawn)`,
      ...(h['sick'] ? { sick: word('sickTitle') } : {}),
      ...(sited && { sited: lineOf(sited) }),
      ...homeRows(world, mainOf(world, h), lineOf),
    },
    ...(room && {
      room: {
        name: roomWords(world, room, name),
        tiles: room.tiles.length,
        role: h['sick']
          ? word('sickRole')
          : (room.role?.name ?? `none yet: a bed makes it a ${bed.name}`),
        beauty: `${room.beauty}, ${room.look}`,
        impressiveness: `${room.impressiveness} of ${def.top}`,
        beds: h['sick']
          ? sickBeds(world, h)
          : room.beds
            ? `${room.beds}${room.crowded ? ', crowded' : ''}`
            : `none yet${open ? `: ${open > 1 ? `the ${open} carry their bedrolls` : 'one carries their bedroll'} in at dusk` : ''}`,
        warmth: roomWarmth(world, x, y),
      },
    }),
  };
}

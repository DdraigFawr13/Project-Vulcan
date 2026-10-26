// Light after dusk (P5.13, V-075, V-135). Outdoor work stops at dusk. Work in content's `dark`
// list goes on (fires are tended and flocks folded by feel, a forge lights itself, below ground is
// always dark); work in `dim` is done at a fire, whose own light serves; work in `candle` (the
// finer trades) needs a candle burning in the room of its workplace (`at`). A worker who reaches
// an unlit room lights a candle from the store, the cheapest first (`candles` order), which then
// burns only while someone works by it: one candle lights the room for everyone in it. With no
// candle in store, or a workplace in no room, the room goes dark with one line a day and the
// work waits for morning. Candles come from the store without the walk being modelled.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { houseAt, piecesOf, roomAt, roomName, type Room } from '../build/index.ts';
import { inStore, itemsOf, stockOf, takeFrom } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { isDark } from './daylight.ts';

export const LAMP_TABLES: Schemas = {
  /** A room's candle: `room` its key (its lowest tile index, or minus the workplace piece's id
   * for one in no room), `kind` the candle burning (an item kind, '' once spent), `left` its
   * minutes of light, `used` the tick it last burned, `line` the lighting's line, `dark` the day
   * of the room's last went-dark line (-1 for none). */
  light: { room: 'int', kind: 'text', left: 'count', used: 'int', line: 'event', dark: 'int' },
};

export type LightClass = 'out' | 'dark' | 'dim' | 'candle';

/** What a kind of work needs after dusk. */
export function lightClass(content: EngineContent, job: string): LightClass {
  const l = content.lamp;
  if (l.dark.includes(job)) return 'dark';
  if (l.dim.includes(job)) return 'dim';
  if (l.candle.includes(job)) return 'candle';
  return 'out';
}

export const lightsOf = (world: WorldState): EntityRow[] => world.entities['light'] ?? [];

const keyOf = (room: Room): number => Math.min(...room.tiles);

/** The workplace of a candle trade and its room, if one stands. */
function placeOf(world: WorldState, content: EngineContent, job: string) {
  const kind = content.lamp.at[job];
  const piece = kind ? piecesOf(world, kind)[0] : undefined;
  if (!piece) return undefined;
  const [x, y] = [piece['x'] as number, piece['y'] as number];
  const room = piece['z'] === 0 ? roomAt(world, content, x, y) : undefined;
  const house = room ? houseAt(world, x, y) : undefined;
  const name = house ? `the ${roomName(world, content, house)}` : `the ${kind} in the open`;
  return { piece, room, key: room ? keyOf(room) : -piece.id, name, kind: kind as string };
}

const day = (tick: number) => Math.floor(tick / 1440);

/** Candles in the stores, in `candles` order (cheapest first). */
function storeCandle(world: WorldState, content: EngineContent): EntityRow | undefined {
  for (const c of content.lamp.candles) {
    const item = itemsOf(world).find(
      (i) =>
        i['kind'] === c.item &&
        !i['holder'] &&
        (i['state'] === 'kept' ||
          inStore(world, i['x'] as number, i['y'] as number, i['z'] as number)),
    );
    if (item) return item;
  }
  return undefined;
}

/** Whether a candle trade could work after dusk: its workplace stands in a room that has a
 * candle burning, or there is one in store to light. */
export function canLight(world: WorldState, content: EngineContent, job: string): boolean {
  const at = placeOf(world, content, job);
  if (!at?.room) return false;
  const row = lightsOf(world).find((r) => r['room'] === at.key);
  return (!!row && (row['left'] as number) > 0) || !!storeCandle(world, content);
}

/** Whether `p` may go on with `job` this minute, as far as light goes. Burns or lights the room's
 * candle when they stand in it after dusk; writes the went-dark line when there is none. Their
 * minutes away from the workplace (fetching) are not lit and burn nothing. */
export function lit(ctx: SystemContext, p: EntityRow, job: string): boolean {
  const { world, content } = ctx;
  if ((p['z'] as number) > 0 || !isDark(content, world.tick)) return true;
  const cls = lightClass(content, job);
  if (cls === 'dark' || cls === 'dim') return true;
  if (cls === 'out') return false;
  const at = placeOf(world, content, job);
  if (!at) return false;
  const here = at.room?.tiles.includes((p['y'] as number) * world.map.width + (p['x'] as number));
  if (at.room && !here) return true;
  let row = lightsOf(world).find((r) => r['room'] === at.key);
  if (row && (row['left'] as number) > 0) {
    burn(world, row);
    return true;
  }
  const candle = at.room ? storeCandle(world, content) : undefined;
  if (!candle) {
    goneDark(ctx, p, at, row);
    return false;
  }
  const kind = candle['kind'] as string;
  const minutes = content.lamp.candles.find((c) => c.item === kind)!.minutes;
  takeFrom(world, candle, 1);
  const line = ctx.emit('lamp.lit', {
    causes: [p['took'] as number, stockOf(world, 'candles')?.['line'] as number].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: {
      name: p['name'] as string,
      candle: content.lamp.candles.find((c) => c.item === kind)!.name,
      where: at.name,
      at: at.kind,
    },
  });
  if (!row) {
    const id = addEntity(world, 'light', {
      ...{ room: at.key, kind, left: minutes, used: -1, line, dark: -1 },
    });
    row = lightsOf(world).find((r) => r.id === id)!;
  } else Object.assign(row, { kind, left: minutes, line });
  burn(world, row);
  return true;
}

/** A minute of the room's candle, once a tick however many work by it. */
function burn(world: WorldState, row: EntityRow): void {
  if (row['used'] === world.tick) return;
  row['used'] = world.tick;
  row['left'] = (row['left'] as number) - 1;
  if ((row['left'] as number) <= 0) row['kind'] = '';
}

function goneDark(
  ctx: SystemContext,
  p: EntityRow,
  at: NonNullable<ReturnType<typeof placeOf>>,
  row: EntityRow | undefined,
): void {
  const { world } = ctx;
  const today = day(world.tick);
  if (row && row['dark'] === today) return;
  const why = at.room ? 'no candles in store' : `the ${at.kind} stands in no room to light`;
  const line = ctx.emit('lamp.dark', {
    causes: [row?.['line'] as number, stockOf(world, 'candles')?.['line'] as number].filter(
      (l): l is number => !!l,
    ),
    actors: [p.id],
    data: { name: p['name'] as string, where: at.name, at: at.kind, why },
  });
  if (row) row['dark'] = today;
  else
    addEntity(world, 'light', {
      ...{ room: at.key, kind: '', left: 0, used: -1, line, dark: today },
    });
}

/** Rooms with a candle burning this minute, as a tile of each (its key), for the map's glow. */
export function litRooms(world: WorldState): number[] {
  return lightsOf(world)
    .filter((r) => (r['used'] as number) >= world.tick - 1 && (r['room'] as number) >= 0)
    .map((r) => r['room'] as number);
}

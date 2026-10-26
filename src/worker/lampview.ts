// The lamp as the page shows it (P5.13): today's first light and dusk, the rooms with a candle
// burning for the map's glow, a room's Light row and the Candles plate's stores line. Every value
// is the engine's answer put into words; nothing here decides a rule (GAME-02). Pure reads.
import { content } from '../content/index.ts';
import {
  daylightAt,
  fireOf,
  furnitureOf,
  ashIn,
  haveOf,
  inStore,
  itemsOf,
  litRooms,
  roomAt,
  type WorldState,
} from '../engine/index.ts';
import { minutesWords } from './fires.ts';
import type { GoodsView } from './protocol.ts';

/** Today's first light and dusk in hours (decimals), for the clock and the day strip. */
export function sunOf(tick: number): { dawn: number; dusk: number } {
  const { dawn, dusk } = daylightAt(content, tick);
  return { dawn: dawn / 60, dusk: dusk / 60 };
}

/** The rooms with a candle burning this minute, as the box round their tiles. */
export function litGoods(world: WorldState): GoodsView['lit'] {
  const width = world.map.width;
  const boxes: GoodsView['lit'] = [];
  for (const key of litRooms(world)) {
    const room = roomAt(world, content, key % width, Math.floor(key / width));
    if (!room) continue;
    const xs = room.tiles.map((t) => t % width);
    const ys = room.tiles.map((t) => Math.floor(t / width));
    const [x, y] = [Math.min(...xs), Math.min(...ys)];
    boxes.push({ x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 });
  }
  return boxes;
}

/** A room's Light row for tile (x, y): its candle, a fire, the day or the dark. */
export function roomLight(world: WorldState, x: number, y: number): string {
  const width = world.map.width;
  const room = roomAt(world, content, x, y);
  const key = room ? Math.min(...room.tiles) : -1;
  const row = (world.entities['light'] ?? []).find((r) => r['room'] === key);
  if (row && (row['left'] as number) > 0 && (row['used'] as number) >= world.tick - 1)
    return `Candlelit · ${minutesWords(row['left'] as number)} of candle left`;
  const { dawn, dusk } = daylightAt(content, world.tick);
  const minute = world.tick % 1440;
  if (minute >= dawn && minute < dusk) return 'Daylight';
  const inside = new Set(room?.tiles);
  const fire = furnitureOf(world).find(
    (f) =>
      f['kind'] === 'hearth' &&
      f['state'] === 'built' &&
      inside.has((f['y'] as number) * width + (f['x'] as number)) &&
      fireOf(world, f.id)?.['lit'],
  );
  return fire ? 'Hearthlight' : 'Dark after dusk';
}

/** `{candles}` in a plate's note: the candles in store and with the cart, the soap, and what
 * there is to make more from. */
export function candleNote(world: WorldState): string {
  const count = (kept: boolean, kind: string) =>
    itemsOf(world)
      .filter(
        (i) =>
          i['kind'] === kind &&
          !i['holder'] &&
          (i['state'] === 'kept') === kept &&
          (kept || inStore(world, i['x'] as number, i['y'] as number, i['z'] as number)),
      )
      .reduce((n, i) => n + (i['count'] as number), 0);
  const kinds = content.lamp.candles;
  const stored = kinds.map((c) => [count(false, c.item), c.name.replace(/ candle$/, '')] as const);
  const kept = kinds.reduce((n, c) => n + count(true, c.item), 0);
  const soap = content.lamp.chandler.soap.item;
  const from = [...new Set(content.lamp.chandler.recipes.flatMap((r) => Object.keys(r.from)))];
  const name = (id: string) => content.items.find((i) => i.id === id)?.name ?? id;
  const list = (parts: readonly (readonly [number, string])[]) =>
    parts.filter(([n]) => n).map(([n, w]) => `${n} ${w}`);
  const store = list(stored);
  const makeMore = list(
    from.map(
      (f) =>
        [
          haveOf(world, content, f) + (f === content.lamp.ash.item ? ashIn(world, content) : 0),
          name(f).toLowerCase(),
        ] as const,
    ),
  );
  const lines = [
    `${store.length ? `${store.join(' and ')} in store` : 'No candles in store'}${kept ? `, ${kept} with the cart` : ''}.`,
    `${haveOf(world, content, soap) || 'No'} ${name(soap).toLowerCase()} in store.`,
    makeMore.length
      ? `To make more: ${makeMore.join(', ')}.`
      : `To make more: none yet of ${from.map((f) => name(f).toLowerCase()).join(', ')}.`,
  ];
  return lines.join(' ');
}

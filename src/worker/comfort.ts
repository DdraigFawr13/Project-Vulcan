// What feeds a person's beauty and privacy, in words (P3.5): the room they stand in and the room
// they sleep in, as the engine's `roomAt` works them out. Read when the page asks, never stored;
// worked out once a tick for everyone, since every snapshot asks.
import { content } from '../content/index.ts';
import {
  bedOwnedBy,
  houseAt,
  itemsOf,
  piecesOf,
  roomAt,
  type EntityRow,
  type WorldState,
} from '../engine/index.ts';

const COUNTS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** The room a person stands in: only inside a built house's walls, as the needs system has it. */
function standingIn(world: WorldState, p: EntityRow) {
  const [x, y] = [p['x'] as number, p['y'] as number];
  const h = p['z'] === 0 ? houseAt(world, x, y) : undefined;
  return h?.['state'] === 'built' ? roomAt(world, content, x, y) : undefined;
}

function beautyWords(world: WorldState, p: EntityRow): string {
  const room = standingIn(world, p);
  if (!room) return 'open air';
  return room.crowded ? `crowded ${room.role?.name ?? 'room'}, ${room.look}` : `${room.look} room`;
}

/** Where they sleep: their bed's room, else their laid bedroll's. */
function privacyWords(world: WorldState, p: EntityRow): string {
  const bed = bedOwnedBy(world, p.id);
  const roll = itemsOf(world).find(
    (i) => i['owner'] === p.id && i['kind'] === content.life.cart.bedroll && i['state'] === 'laid',
  );
  const at = bed ?? roll;
  if (!at) return 'sleeps under the open sky';
  const room =
    at['z'] === 0 ? roomAt(world, content, at['x'] as number, at['y'] as number) : undefined;
  if (!room) return 'sleeps outdoors';
  const others = Math.max(0, room.sleepers - 1);
  if (others) return `sleeps with ${COUNTS[others] ?? others} ${others > 1 ? 'others' : 'other'}`;
  if (!bed) return 'on a bedroll, no bed of their own';
  const inside = new Set(room.tiles);
  const beds = piecesOf(world, 'bed').filter((b) =>
    inside.has((b['y'] as number) * world.map.width + (b['x'] as number)),
  );
  return beds.every((b) => b['owner'] === p.id)
    ? `own ${room.role?.name ?? 'room'}`
    : 'own bed, shared room';
}

let cache:
  { world: WorldState; tick: number; words: Map<number, Record<string, string>> } | undefined;

/** The word for what feeds `need` of person `p`, for beauty and privacy; none for the others. */
export function feedsOf(world: WorldState, p: EntityRow, need: string): string | undefined {
  if (need !== 'beauty' && need !== 'privacy') return undefined;
  if (cache?.world !== world || cache.tick !== world.tick)
    cache = { world, tick: world.tick, words: new Map() };
  let words = cache.words.get(p.id);
  if (!words) {
    words = { beauty: beautyWords(world, p), privacy: privacyWords(world, p) };
    cache.words.set(p.id, words);
  }
  return words[need];
}

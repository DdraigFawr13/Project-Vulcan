// Beauty and privacy (P3.5): the two needs the rooms feed. Awake indoors, beauty moves towards
// the room's own (worked out when asked, build/rooms.ts); outdoors it drifts slowly to neutral.
// Asleep, privacy rises in a bedroom whose every bed is the sleeper's alone, and falls for each
// other sleeper in the room. Nothing here is a ledger line; the crossing lines are needs.ts's.
import type { EntityRow } from '../core/index.ts';
import { houseAt, roomAt, type Room } from '../build/index.ts';
import type { SystemContext } from '../sim/index.ts';

const near = (a: number, b: number, by: number): number => Math.max(-by, Math.min(by, b - a));

/** The room a person stands in, if any: worked out only inside a built house's walls. */
export function roomHere(ctx: SystemContext, p: EntityRow): Room | undefined {
  const { world, content } = ctx;
  const [x, y] = [p['x'] as number, p['y'] as number];
  const h = p['z'] === 0 ? houseAt(world, x, y) : undefined;
  return h?.['state'] === 'built' ? roomAt(world, content, x, y) : undefined;
}

/** One hour's change to a person's `beauty` or `privacy`; `where` gives the room they are in. */
export function comfortOf(
  ctx: SystemContext,
  p: EntityRow,
  id: 'beauty' | 'privacy',
  where: () => Room | undefined,
): number {
  const { world, content } = ctx;
  const life = content.life;
  const sleeping = p['doing'] === 'sleep' && !(p['path'] as number[]).length;
  const room = id === 'privacy' && !sleeping ? undefined : where();
  if (id === 'beauty') {
    if (sleeping) return 0;
    const value = (world.entities['need'] ?? []).find(
      (n) => n['person'] === p.id && n['need'] === 'beauty',
    )?.['value'] as number;
    const b = life.beauty;
    if (!room) return near(value, b.neutral, b.outdoors);
    const target = Math.max(0, Math.min(life.scale, b.neutral + b.perPoint * room.beauty));
    return near(value, target, b.rate);
  }
  if (!sleeping || !room) return 0;
  const inside = new Set(room.tiles);
  const width = world.map.width;
  const others = (world.entities['person'] ?? []).filter(
    (q) =>
      q.id !== p.id &&
      q['status'] === 'alive' &&
      q['z'] === 0 &&
      q['doing'] === 'sleep' &&
      !(q['path'] as number[]).length &&
      inside.has((q['y'] as number) * width + (q['x'] as number)),
  ).length;
  if (others) return -life.privacy.perOther * others;
  // Alone: private only in a room whose every bed is theirs and where no one else sleeps by right.
  const mine = (world.entities['furniture'] ?? []).filter(
    (f) =>
      f['kind'] === 'bed' &&
      f['state'] === 'built' &&
      f['owner'] === p.id &&
      inside.has((f['y'] as number) * width + (f['x'] as number)),
  ).length;
  return mine > 0 && mine === room.bedPieces && room.sleepers === 1 ? life.privacy.gain : 0;
}

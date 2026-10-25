// Claiming a bed (P3.5): nobody is assigned one. At bedtime a person with no bed takes the free
// bed nearest where they sleep now, in their own house first; the bed's owner is then them (it
// lives on the bed), and their bedroll is carried to the store with the next load. Someone
// crowded moves to a free bed in an empty room of their house (phase review).
import type { EntityRow } from '../core/index.ts';
import {
  bedOwnedBy,
  builtHome,
  houseAt,
  mainOf,
  othersHome,
  piecesOf,
  roomAt,
  roomName,
  sizeOf,
} from '../build/index.ts';
import { itemsOf } from '../goods/index.ts';
import { feltAt } from '../needs/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { spotOf } from './spots.ts';

/** Someone crowded (privacy under its line) who owns a bed moves to a free bed in an empty room
 * of the same house, one built for them (build/grow.ts); their old bed is free again. */
function moveForPrivacy(ctx: SystemContext, p: EntityRow, owned: EntityRow): void {
  const { world, content } = ctx;
  const row = (world.entities['need'] ?? []).find(
    (n) => n['person'] === p.id && n['need'] === 'privacy',
  );
  const here = houseAt(world, owned['x'] as number, owned['y'] as number);
  if (!row?.['low'] || !here || here['state'] !== 'built') return;
  const home = mainOf(world, here).id;
  // Warmth beats privacy (V-046): not to a room colder than the one they leave, below comfort.
  const tile = (e: EntityRow) => (e['y'] as number) * world.map.width + (e['x'] as number);
  const warmEnough = Math.min(feltAt(world, content, tile(owned)), content.life.warmth.comfort);
  const bed = piecesOf(world, 'bed').find((b) => {
    if (feltAt(world, content, tile(b)) < warmEnough) return false;
    if (b['owner'] || b['z'] !== 0) return false;
    const [x, y] = [b['x'] as number, b['y'] as number];
    const h = houseAt(world, x, y);
    return (
      h?.['state'] === 'built' &&
      !h['sick'] &&
      mainOf(world, h).id === home &&
      roomAt(world, content, x, y)?.sleepers === 0 &&
      canReach(content, world.map, spotOf(p), spotOf(b))
    );
  });
  if (!bed) return;
  const h = houseAt(world, bed['x'] as number, bed['y'] as number)!;
  owned['owner'] = 0;
  bed['owner'] = p.id;
  ctx.emit('people.movedRoom', {
    causes: [bed['made'] as number, row['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, room: roomName(world, content, h) },
  });
}

/** Someone whose home stands takes a free bed there, leaving their old one free (P5.14). */
function moveHome(
  ctx: SystemContext,
  p: EntityRow,
  owned: EntityRow,
  bed: EntityRow,
  home: EntityRow,
): void {
  owned['owner'] = 0;
  bed['owner'] = p.id;
  home['moved'] = ctx.emit('people.movedHome', {
    causes: [home['built'] as number, bed['made'] as number].filter((l) => l > 0),
    actors: [p.id],
    data: { name: p['name'] as string, whose: 'their own', size: sizeOf(ctx.content, home).name },
  });
}

/** `p` takes a free bed if they have none and one can be reached; one line citing the bed made. */
export function claimBed(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  const owned = bedOwnedBy(world, p.id);
  // Nobody claims a sickroom bed: those are for the hurt (P5.6). Nor a bed in someone else's
  // home, and once theirs stands, one only there (P5.14).
  const own = builtHome(world, p.id);
  const free = piecesOf(world, 'bed').filter((b) => {
    const h = houseAt(world, b['x'] as number, b['y'] as number);
    const main = h && mainOf(world, h);
    if (b['owner'] || b['z'] !== 0 || h?.['sick']) return false;
    return own
      ? main?.id === own.id && h!['state'] === 'built'
      : !main || !othersHome(world, main, p.id);
  });
  if (owned) {
    const at = houseAt(world, owned['x'] as number, owned['y'] as number);
    if (own && (!at || mainOf(world, at).id !== own.id) && free.length) {
      const bed = free.find((b) => canReach(content, world.map, spotOf(p), spotOf(b)));
      if (bed) return moveHome(ctx, p, owned, bed, own);
    }
    return moveForPrivacy(ctx, p, owned);
  }
  if (!free.length) return;
  const roll = itemsOf(world).find(
    (i) => i['owner'] === p.id && i['kind'] === content.life.cart.bedroll && i['state'] === 'laid',
  );
  const from = roll ? spotOf(roll) : spotOf(p);
  const mine = houseAt(world, from.x, from.y);
  const home = mine && mine['state'] === 'built' ? mainOf(world, mine).id : 0;
  const rank = (b: EntityRow) => {
    const h = houseAt(world, b['x'] as number, b['y'] as number);
    const own = home && h && mainOf(world, h).id === home ? 0 : 1000;
    return (
      own + Math.max(Math.abs((b['x'] as number) - from.x), Math.abs((b['y'] as number) - from.y))
    );
  };
  const bed = [...free]
    .sort((a, b) => rank(a) - rank(b) || a.id - b.id)
    .find((b) => canReach(content, world.map, spotOf(p), spotOf(b)));
  if (!bed) return;
  const h = houseAt(world, bed['x'] as number, bed['y'] as number);
  bed['owner'] = p.id;
  ctx.emit('people.claimedBed', {
    causes: [bed['made'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, room: h ? roomName(world, content, h) : '' },
  });
  // The bedroll goes back to stock: they carry it in with their next load.
  if (roll) Object.assign(roll, { owner: 0, holder: p.id, state: '' });
}

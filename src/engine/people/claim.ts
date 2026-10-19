// Claiming a bed (P3.5): nobody is assigned one. At bedtime a person with no bed takes the free
// bed nearest where they sleep now, in their own house first; the bed's owner is then them (it
// lives on the bed), and their bedroll is carried to the store with the next load.
import type { EntityRow } from '../core/index.ts';
import { bedOwnedBy, houseAt, mainOf, piecesOf, roomName } from '../build/index.ts';
import { itemsOf } from '../goods/index.ts';
import { canReach } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { spotOf } from './spots.ts';

/** `p` takes a free bed if they have none and one can be reached; one line citing the bed made. */
export function claimBed(ctx: SystemContext, p: EntityRow): void {
  const { world, content } = ctx;
  if (bedOwnedBy(world, p.id)) return;
  const free = piecesOf(world, 'bed').filter((b) => !b['owner'] && b['z'] === 0);
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

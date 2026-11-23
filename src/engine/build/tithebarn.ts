// The tithe barn (6C Slice 2, V-222): once the reeve has named the colony's lord, the Build
// sheet's Tithe barn row says how much the colony wants one, 1 first to 4 last, and it is sited as
// the tavern is (`siteHall`, the size lord.json `tithe.barn.size`): a house row with `inn`
// INN_TITHE, nobody's home, wanting no furniture. The lord's share is carried into it (band
// tithehaul.ts). The lord's row is read as data: build imports nothing of the lord.
import type { EntityRow, WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { INN_TITHE, TITHE_KIND } from './houses.ts';
import { siteHall } from './tavern.ts';
import { housesOf, rectOf } from './site.ts';

/** The tithe barn's house row (not one sent back), if the colony has sited one. */
export const barnHouse = (world: WorldState): EntityRow | undefined =>
  housesOf(world).find((h) => h['inn'] === INN_TITHE && h['state'] !== 'sent');

/** A tile inside the built barn to carry the share to: its middle; undefined until it stands. */
export function barnSpot(world: WorldState): Spot | undefined {
  const h = barnHouse(world);
  if (!h || h['state'] !== 'built') return undefined;
  const r = rectOf(h);
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), z: 0 };
}

/** Each hour: once the lord is named, with the Tithe barn row at 1 to 3 and (above 1) everyone
 * housed, the colony sites the tithe barn. `again` after a send-back. */
export function planBarn(ctx: SystemContext, green: Spot, again = false): void {
  const { world, content } = ctx;
  if (barnHouse(world)) return;
  const named = world.entities['lord']?.[0]?.['named'] as number | undefined;
  if (!named) return;
  const hall = {
    ...{ kind: TITHE_KIND, inn: INN_TITHE, size: content.lord.tithe.barn.size },
    ...{ tried: 'barnTried', event: 'build.titheBarn', why: 'the lord named', causes: [named] },
    purpose: "a barn for the lord's tithe",
  };
  siteHall(ctx, green, hall, again);
}

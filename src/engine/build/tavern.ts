// The tavern (6B Bundle 5, P6.12, V-183, V-188): the Build sheet's Tavern row says how much the
// colony wants one, 1 first to 4 last. At levels 1 to 3 the colony sites it once the first
// harvest home is past and (above level 1) nobody sleeps in the open; at 4 it waits. `siteHall`
// does the same for the schoolroom (school.ts). Sited like
// the sick-house: `chooseHouse` with the one size `tavern.build.size`, kept apart from the smithy's
// noise; a house row with `inn` 1, which is no one's home (beds, claim, homes, strangers and growth
// skip it). Once built it wants a hearth (builders) and what `tavern.build.wants` lists (carpentry,
// wants.ts). Its name and keeper are the inn system's. A plan can be sent back once.
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { furnitureOf } from './furniture.ts';
import { HEARTH, planHearthAt } from './hearths.ts';
import { dirFrom, homeless, INN_TAVERN, placeHouse, TAVERN_KIND, wantOf } from './houses.ts';
import { roomAt } from './rooms.ts';
import { chooseHouse, housesOf, rectOf } from './site.ts';
import { smithiesOf } from './smithy.ts';
import { siteFor } from './wants.ts';

/** The tavern's house row (not one sent back), if the colony has sited one. */
export const tavernHouse = (world: WorldState): EntityRow | undefined =>
  housesOf(world).find((h) => h['inn'] === INN_TAVERN && h['state'] !== 'sent');

/** The line of the first harvest home eaten (a supper with no couple and no feast day), if any. */
export function harvestHome(world: WorldState): number | undefined {
  const f = (world.entities['feast'] ?? []).find(
    (r) => r['eaten'] && !(r['couple'] as number[]).length && !r['holy'],
  );
  return f && (f['line'] as number);
}

/** A house that is nobody's home, sited from a Build sheet row (the tavern, the schoolroom). */
export interface Hall {
  kind: string;
  /** The house row's `inn`: INN_TAVERN or INN_SCHOOL. */
  inn: number;
  size: string;
  /** System state key for the tick it last found no ground. */
  tried: string;
  /** The line it is sited with, and the words its data takes. */
  event: string;
  why: string;
  causes: number[];
  /** The house row's reason, before the site's own. */
  purpose: string;
  apart?: Spot[];
}

/** With `hall`'s row at 1 to 3 and (above 1) everyone housed, sites it: `chooseHouse` with its one
 * size; with no ground it looks again a day later. `again` after a send-back. */
export function siteHall(ctx: SystemContext, green: Spot, hall: Hall, again = false): void {
  const { world, content, state } = ctx;
  const want = wantOf(world, content, hall.kind);
  if (want.level >= content.work.priority.words.length) return;
  if (want.level > 1 && homeless(world, content).length) return;
  const tried = state[hall.tried] ?? 0;
  if (!again && tried && world.tick < tried + TICKS_PER_DAY) return;
  state[hall.tried] = world.tick;
  const size = content.buildings.house.sizes.find((s) => s.id === hall.size);
  const only = { sizes: size ? [size] : [], apart: hall.apart ?? [] };
  const pick = size && chooseHouse(world, content, green, size.sleeps, undefined, only);
  if (!pick) return;
  const housed = want.level > 1 ? ' and everyone housed' : '';
  const line = ctx.emit(hall.event, {
    causes: [...hall.causes, ...(want.line ? [want.line] : [])],
    data: {
      ...{ why: `${hall.why}${housed}`, size: pick.size.name },
      ...{ dir: dirFrom(green, pick.site), where: pick.why },
    },
  });
  const id = placeHouse(ctx, pick.site, pick.size, pick.wall, line, {
    why: `${hall.purpose}; ${pick.why}`,
    sent: again ? 1 : 0,
  });
  housesOf(world).find((h) => h.id === id)!['inn'] = hall.inn;
}

/** Each hour: with the Tavern row at 1 to 3, the harvest home past and (above 1) everyone housed,
 * the colony sites the tavern, away from the smithy's hammering. `again` after a send-back. */
export function planTavern(ctx: SystemContext, green: Spot, again = false): void {
  const { world, content } = ctx;
  if (tavernHouse(world)) return;
  const harvest = harvestHome(world);
  if (!harvest) return;
  const noisy = smithiesOf(world)
    .filter((s) => s['state'] !== 'sent')
    .map((s) => {
      const r = rectOf(s);
      return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2), z: 0 };
    });
  const hall = {
    ...{ kind: TAVERN_KIND, inn: INN_TAVERN, size: content.tavern.build.size },
    ...{ tried: 'tavernTried', event: 'build.tavern', why: 'the harvest in', causes: [harvest] },
    ...{ purpose: 'a tavern for the evenings', apart: noisy },
  };
  siteHall(ctx, green, hall, again);
}

/** Each hour: a built hall (the tavern, the schoolroom) with no hearth gets one planned, by its
 * kind's `place` hint. */
export function planHallHearth(ctx: SystemContext, h: EntityRow | undefined, name: string): void {
  const { world, content } = ctx;
  if (!h || h['state'] !== 'built') return;
  const r = rectOf(h);
  const room = roomAt(world, content, r.x + 1, r.y + 1);
  if (!room) return;
  const tiles = new Set(room.tiles);
  const width = world.map.width;
  const inside = (f: EntityRow) =>
    f['z'] === 0 && tiles.has((f['y'] as number) * width + (f['x'] as number));
  if (furnitureOf(world).some((f) => f['kind'] === HEARTH && inside(f))) return;
  const at = siteFor(world, content, { h, room }, HEARTH);
  if (!at) return;
  const line = ctx.emit('fire.planned', {
    causes: [h['built'] as number],
    data: { what: 'hearth', where: `in the ${name}`, why: `a ${name} wants a fire` },
  });
  planHearthAt(ctx, at, line);
}

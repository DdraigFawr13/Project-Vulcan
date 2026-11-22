// The schoolroom (6B Bundle 6, P6.13, V-183, V-189 q7): the Build sheet's Schoolroom row says how
// much the colony wants one, 1 first to 4 last. At levels 1 to 3 the colony sites it once the
// first harvest home is past, (above level 1) nobody sleeps in the open, the tavern is not still
// a plan (one hall at a time) and there is someone to teach or something to write: a child, or a
// master (teach.json `master`) whose ways could be written down. A cottage that is nobody's home
// (`inn` INN_SCHOOL), sited by `siteHall`; once built it wants a hearth and what
// `teach.school.build.wants` lists (a table, chairs and the shelf books are kept on). The teacher,
// lessons and books are engine teach's. A plan can be sent back once.
import { yearNow, type EntityRow, type WorldState } from '../core/index.ts';
import { skillLine } from '../entity/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { INN_SCHOOL, SCHOOL_KIND } from './houses.ts';
import { roomAt, type Room } from './rooms.ts';
import { housesOf, rectOf } from './site.ts';
import { harvestHome, planHallHearth, siteHall, tavernHouse } from './tavern.ts';

/** The schoolroom's house row (not one sent back), if the colony has sited one. */
export const schoolHouse = (world: WorldState): EntityRow | undefined =>
  housesOf(world).find((h) => h['inn'] === INN_SCHOOL && h['state'] !== 'sent');

/** The built schoolroom's room, if it stands. */
export function schoolRoom(ctx: Pick<SystemContext, 'world' | 'content'>): Room | undefined {
  const h = schoolHouse(ctx.world);
  if (!h || h['state'] !== 'built') return undefined;
  const r = rectOf(h);
  return roomAt(ctx.world, ctx.content, r.x + 1, r.y + 1);
}

/** Why the colony wants a schoolroom now, and the line it cites: a child to teach, else a master's
 * ways to write down; undefined while there is neither. */
function reason(ctx: SystemContext): { why: string; cause: number } | undefined {
  const { world, content } = ctx;
  const w = content.teach.school.words;
  const living = (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
  const year = yearNow(world, content);
  const young = (p: EntityRow) =>
    year - (p['born'] as number) <
    (content.races.find((r) => r.id === p['race'])?.maturityYears ?? 0);
  const child = living.find((p) => p['bornLine'] && young(p));
  if (child) return { why: w.children, cause: child['bornLine'] as number };
  const master = (world.entities['skill'] ?? []).find(
    (s) =>
      (s['level'] as number) >= content.teach.master &&
      living.some((p) => p.id === s['person'] && !p['stranger']),
  );
  if (!master) return undefined;
  const p = living.find((q) => q.id === master['person'])!;
  return { why: w.masters, cause: skillLine(world, content, p, master['skill'] as string) };
}

/** Each hour: with the Schoolroom row at 1 to 3, the harvest home past, no tavern plan waiting
 * and someone to teach or something to write, the colony sites the schoolroom. `again` after a
 * send-back. */
export function planSchool(ctx: SystemContext, green: Spot, again = false): void {
  const { world, content } = ctx;
  if (schoolHouse(world) || tavernHouse(world)?.['state'] === 'plan') return;
  const harvest = harvestHome(world);
  const why = harvest && reason(ctx);
  if (!harvest || !why) return;
  const hall = {
    ...{ kind: SCHOOL_KIND, inn: INN_SCHOOL, size: content.teach.school.build.size },
    ...{ tried: 'schoolTried', event: 'build.school', why: `${why.why} and the harvest in` },
    ...{ causes: [harvest, ...(why.cause ? [why.cause] : [])] },
    purpose: `a schoolroom for ${why.why}`,
  };
  siteHall(ctx, green, hall, again);
}

/** Each hour: the built schoolroom's hearth. */
export const planSchoolHearth = (ctx: SystemContext): void =>
  planHallHearth(ctx, schoolHouse(ctx.world), 'schoolroom');

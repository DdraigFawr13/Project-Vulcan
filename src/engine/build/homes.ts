// Homes of their own and the hall (P5.14, V-119, V-121). Every adult, or couple, wants a home of
// their own: the band after a season under a shared roof, a newcomer from the day they stay
// (strangers.json `home.after`). Each want is one line, and the want adds a house plan citing
// whose it meets: one home at a time, whoever has waited longest first, a couple before someone
// on their own the same day. A home is the smallest size that sleeps the household, sited round
// the green leaning toward their work (site.ts), its walls by the wall rule (V-097). When the last
// of the band sleeps in a home of their own, the first house becomes the hall: newcomers sleep
// there until their homes are up, the harvest-home supper is eaten there and mourners gather there.
import { pronouns, TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { homeFor, householdOf, sleepsIn } from './beds.ts';
import { bedsOf, dirFrom, placeHouse, sizeOf, wantOf } from './houses.ts';
import { chooseHouse, housesOf } from './site.ts';
import { alive } from '../entity/index.ts';
import { growHomes, leaveOutgrown, outgrownHome } from './outgrown.ts';
import { widenRing } from './ring.ts';

const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const named = (world: WorldState, ids: readonly number[]): string[] =>
  ids.map((id) => (world.entities['person'] ?? []).find((p) => p.id === id)?.['name'] as string);

/** "Gwallog's", or "Asgild and Ormar's", for a household's home. */
export const whoseOf = (world: WorldState, ids: readonly number[]): string =>
  `${list(named(world, ids))}'s`;

/** The hall, once the first house became it. */
export const hallOf = (world: WorldState): EntityRow | undefined =>
  housesOf(world).find((h) => h['hall']);

/** Where a person's trade is worked (strangers.json `home.work`): the first row of its table. */
function workOf(world: WorldState, table: string | undefined): Spot | undefined {
  const row = table ? (world.entities[table] ?? [])[0] : undefined;
  if (!row) return undefined;
  const tiles = row['tiles'] as number[] | undefined;
  if (tiles?.length)
    return { x: tiles[0]! % world.map.width, y: Math.floor(tiles[0]! / world.map.width), z: 0 };
  return { x: row['x'] as number, y: row['y'] as number, z: 0 };
}

/** Each hour: whoever's time has come wants a home of their own, one line a household. */
function sayWants(ctx: SystemContext): void {
  const { world } = ctx;
  for (const p of alive(world)) {
    const from = p['wantsFrom'] as number;
    if (!from || p['wants'] || world.tick < from || homeFor(world, p.id)) continue;
    const ids = householdOf(world, p.id);
    const band = !p['stranger'];
    const line = ctx.emit('people.wantsHome', {
      causes: [p['arrived'] as number].filter((l) => l > 0),
      actors: ids,
      data: {
        names: list(named(world, ids)),
        want: ids.length > 1 ? 'want' : 'wants',
        since: band ? ', after a season under a shared roof' : '',
      },
    });
    for (const id of ids) {
      const q = alive(world).find((r) => r.id === id)!;
      q['wants'] = line;
    }
  }
}

/** Whose home comes next: whoever has waited longest, a couple first that day; then a household
 * that outgrew its home (outgrown.ts), with that home. */
function nextHousehold(world: WorldState): { p: EntityRow; old?: EntityRow } | undefined {
  const waiting = alive(world).filter((p) => p['wants'] && !homeFor(world, p.id));
  const day = (p: EntityRow) => Math.floor((p['wantsFrom'] as number) / TICKS_PER_DAY);
  const size = (p: EntityRow) => householdOf(world, p.id).length;
  const first = [...waiting].sort((a, b) => day(a) - day(b) || size(b) - size(a) || a.id - b.id)[0];
  if (first) return { p: first };
  const old = outgrownHome(world);
  const p = old && alive(world).find((q) => q.id === old['owner']);
  return p && { p, old };
}

/** Ground for a home of `n`, for a household leaving home `old` one that sleeps more than it
 * did (so a home is outgrown at most once a size); with no ground within the ring it widens
 * (P4.7), as for a house, and the colony looks again. */
function siteHome(
  ctx: SystemContext,
  green: Spot,
  n: number,
  cause: number,
  work?: Spot,
  old?: EntityRow,
) {
  const { world, content } = ctx;
  const room = old ? bedsOf(world, content, old).room : 0;
  const sizes = content.buildings.house.sizes.filter((s) => s.sleeps > room);
  if (!sizes.length) return undefined;
  const only = { sizes };
  const pick = chooseHouse(world, content, green, n, work, only);
  if (pick || !cause || !widenRing(ctx, cause)) return pick;
  return chooseHouse(world, content, green, n, work, only);
}

/** One home planned at a time, for the household that has waited longest. */
function planHome(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  if (housesOf(world).some((h) => h['owner'] && h['state'] === 'plan')) return;
  // The band's first house comes first.
  if (!housesOf(world).some((h) => !h['of'] && h['state'] === 'built')) return;
  const next = nextHousehold(world);
  if (!next) return;
  if (world.tick < (state['homeTried'] ?? 0) + TICKS_PER_DAY && state['homeTried']) return;
  const { p, old } = next;
  const ids = householdOf(world, p.id);
  const table = content.strangers.home.work[p['trade'] as string];
  const work = workOf(world, table);
  const pick = siteHome(
    ctx,
    green,
    ids.length,
    (old ? old['outgrown'] : p['wants']) as number,
    work,
    old,
  );
  if (!pick) {
    state['homeTried'] = world.tick;
    return;
  }
  state['homeTried'] = 0;
  const want = wantOf(world, content);
  const wants = old
    ? [old['outgrown']]
    : [...new Set(ids.map((id) => alive(world).find((q) => q.id === id)!['wants']))];
  const lean = work ? `, toward the ${table === 'field' ? 'fields' : table} where they work` : '';
  const line = ctx.emit('build.homeSited', {
    causes: [...(wants as number[]), ...(want.line ? [want.line] : [])].filter((l) => l > 0),
    actors: ids,
    data: {
      whose: whoseOf(world, ids),
      size: pick.size.name,
      dir: dirFrom(green, pick.site),
      why: `${pick.why}${lean}`,
    },
  });
  placeHouse(ctx, pick.site, pick.size, pick.wall, line, {
    why: `the flattest dry ground near the green${lean}`,
    owner: ids[0]!,
  });
}

/** When the last of the band sleeps in a home of their own, the first house becomes the hall. */
function becomeHall(ctx: SystemContext): void {
  const { world, content } = ctx;
  if (hallOf(world)) return;
  const first = housesOf(world).find(
    (h) => !h['of'] && h['state'] === 'built' && !h['owner'] && !h['sick'] && !h['inn'],
  );
  const band = alive(world).filter((p) => !p['stranger']);
  if (!first || !band.length) return;
  const homes = band.map((p) => sleepsIn(world, content, p.id));
  if (homes.some((h) => !h?.['owner'])) return;
  // The last to move in: the latest moving-in line among their homes.
  const moved = (k: number) => homes[k]!['moved'] as number;
  const k = band.reduce((best, _, i) => (moved(i) > moved(best) ? i : best), 0);
  const last = band[k]!;
  const home = homes[k]!;
  first['hall'] = ctx.emit('build.hall', {
    causes: [home['moved'] as number].filter((l) => l > 0),
    actors: [last.id],
    data: {
      size: sizeOf(content, first).name,
      name: last['name'] as string,
      their: pronouns(last).their,
    },
  });
}

/** Each hour: wants said, a home grown or outgrown and left, a home planned, the hall opened. */
export function planHomes(ctx: SystemContext, green: Spot): void {
  sayWants(ctx);
  growHomes(ctx, green);
  leaveOutgrown(ctx);
  planHome(ctx, green);
  becomeHall(ctx);
}

/** After a burial the mourners gather in the hall, if there is one. */
export function mournInHall(ctx: SystemContext, cause: number, name: string): void {
  const hall = hallOf(ctx.world);
  if (hall) ctx.emit('hall.mourned', { causes: [cause, hall['hall'] as number], data: { name } });
}

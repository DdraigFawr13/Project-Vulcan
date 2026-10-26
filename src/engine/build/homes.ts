// Homes of their own and the hall (P5.14, V-119, V-121). Every adult, or couple, wants a home of
// their own: the band after a season under a shared roof, a newcomer from the day they stay
// (strangers.json `home.after`). Each want is one line, and the want adds a house plan citing
// whose it meets: one home at a time, whoever has waited longest first, a couple before someone
// on their own the same day. A home is the smallest size that sleeps the household, sited round
// the green leaning toward their work (site.ts), its walls by the wall rule (V-097). When the last
// of the band sleeps in a home of their own, the first house becomes the hall: newcomers sleep
// there until their homes are up, the harvest-home supper is eaten there and mourners gather there.
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { homeFor, householdOf, sleepsIn } from './beds.ts';
import { dirFrom, placeHouse, sizeOf, wantOf } from './houses.ts';
import { chooseHouse, housesOf } from './site.ts';

const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const alive = (world: WorldState): EntityRow[] =>
  (world.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

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

/** One home planned at a time, for the household that has waited longest. */
function planHome(ctx: SystemContext, green: Spot): void {
  const { world, content, state } = ctx;
  if (housesOf(world).some((h) => h['owner'] && h['state'] === 'plan')) return;
  // The band's first house comes first.
  if (!housesOf(world).some((h) => !h['of'] && h['state'] === 'built')) return;
  const waiting = alive(world).filter((p) => p['wants'] && !homeFor(world, p.id));
  if (!waiting.length) return;
  if (world.tick < (state['homeTried'] ?? 0) + TICKS_PER_DAY && state['homeTried']) return;
  const day = (p: EntityRow) => Math.floor((p['wantsFrom'] as number) / TICKS_PER_DAY);
  const size = (p: EntityRow) => householdOf(world, p.id).length;
  const p = [...waiting].sort((a, b) => day(a) - day(b) || size(b) - size(a) || a.id - b.id)[0]!;
  const ids = householdOf(world, p.id);
  const table = content.strangers.home.work[p['trade'] as string];
  const work = workOf(world, table);
  const pick = chooseHouse(world, content, green, ids.length, work);
  if (!pick) {
    state['homeTried'] = world.tick;
    return;
  }
  state['homeTried'] = 0;
  const want = wantOf(world, content);
  const wants = [...new Set(ids.map((id) => alive(world).find((q) => q.id === id)!['wants']))];
  const lean = work ? `, toward the ${table === 'field' ? 'fields' : table} where they work` : '';
  const line = ctx.emit('build.homeSited', {
    causes: [...(wants as number[]), ...(want.line ? [want.line] : [])],
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
    (h) => !h['of'] && h['state'] === 'built' && !h['owner'] && !h['sick'],
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
    },
  });
}

/** Each hour: wants said, a home planned, the hall opened. */
export function planHomes(ctx: SystemContext, green: Spot): void {
  sayWants(ctx);
  planHome(ctx, green);
  becomeHall(ctx);
}

/** After a burial the mourners gather in the hall, if there is one. */
export function mournInHall(ctx: SystemContext, cause: number, name: string): void {
  const hall = hallOf(ctx.world);
  if (hall) ctx.emit('hall.mourned', { causes: [cause, hall['hall'] as number], data: { name } });
}

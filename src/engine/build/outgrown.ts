// A home outgrown (6B review slice 3, V-214). A home (P5.14) is sized for its household when it
// is planned, but children are born into it. Each day a built home whose household is more than
// its rooms sleep adds a room, as a house does (V-052), walled as the home is (V-097), up to
// `house.private` rows; when it can add none, the household wants a bigger home: one line, and
// homes.ts plans one sized for them through the house wants; once it stands they move, and the old
// home is left free for others. Nobody is told to move (V-041).
import { TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import type { Spot } from '../paths/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { householdOf, rowsOf } from './beds.ts';
import { stageSite } from './grow.ts';
import { bedsOf, nthOf, placeHouse, sizeOf } from './houses.ts';
import { partOf } from './plans.ts';
import { housesOf, inRect, rectOf } from './site.ts';

/** "Eadgyth and Edwin's" for a household's home. */
function whose(world: WorldState, ids: readonly number[]): string {
  const names = ids
    .map((id) => alive(world).find((p) => p.id === id))
    .filter((p): p is EntityRow => !!p && !p['household'])
    .map((p) => p['name'] as string);
  return `${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)!}` : (names[0] ?? 'their')}'s`;
}

/** The newest birth line among a household, else 0: a room for a child cites the child. */
const lastBorn = (world: WorldState, ids: readonly number[]): number =>
  Math.max(
    0,
    ...alive(world)
      .filter((p) => ids.includes(p.id))
      .map((p) => p['bornLine'] as number),
  );

/** Each day: a home too small for its household adds a room, else is outgrown (one line). */
export function growHomes(ctx: SystemContext, green: Spot): void {
  const { world, content } = ctx;
  const house = content.buildings.house;
  for (const main of housesOf(world)) {
    if (main['of'] || main['state'] !== 'built' || !main['owner'] || main['outgrown']) continue;
    const rows = rowsOf(world, main);
    if (rows.some((h) => h['state'] === 'plan')) continue;
    if (world.tick < (main['tried'] as number) + TICKS_PER_DAY) continue;
    main['tried'] = world.tick;
    const ids = householdOf(world, main['owner'] as number);
    const { room } = bedsOf(world, content, main);
    if (ids.length <= room) continue;
    const size = sizeOf(content, main).name;
    const site = rows.length < house.private ? stageSite(ctx, main, green) : undefined;
    const causes = [main['built'] as number, lastBorn(world, ids)].filter((l) => l > 0);
    if (!site) {
      main['outgrown'] = ctx.emit('build.homeOutgrown', {
        causes,
        actors: ids,
        data: { whose: whose(world, ids), size, sleepers: ids.length, room },
      });
      continue;
    }
    const line = ctx.emit('build.grows', {
      causes,
      data: { sleepers: ids.length, size, room, nth: nthOf(rows.length), side: site.side },
    });
    placeHouse(ctx, site, house.stage, partOf(content, main['wall'] as string)!, line, {
      why: `the flattest side of the ${size}: ${site.rise} m of rise`,
      of: main.id,
      skip: (x, y) => rows.some((h) => inRect(rectOf(h), x, y)),
    });
  }
}

/** The home outgrown by a household with no other home planned or standing, oldest first. */
export function outgrownHome(world: WorldState): EntityRow | undefined {
  return housesOf(world).find(
    (h) => h['outgrown'] && h['owner'] && !newHomeOf(world, h) && h['state'] === 'built',
  );
}

/** The household's other home, planned or built, beside outgrown home `old`. */
function newHomeOf(world: WorldState, old: EntityRow): EntityRow | undefined {
  const ids = householdOf(world, old['owner'] as number);
  return housesOf(world).find(
    (h) =>
      h.id !== old.id && !h['of'] && h['state'] !== 'sent' && ids.includes(h['owner'] as number),
  );
}

/** Each hour: a household whose bigger home stands moves to it; the old one is left free. */
export function leaveOutgrown(ctx: SystemContext): void {
  const { world, content } = ctx;
  for (const old of housesOf(world)) {
    if (!old['outgrown'] || !old['owner']) continue;
    const next = newHomeOf(world, old);
    if (next?.['state'] !== 'built') continue;
    const ids = householdOf(world, old['owner'] as number);
    ctx.emit('build.homeLeft', {
      causes: [next['built'] as number, old['outgrown'] as number].filter((l) => l > 0),
      actors: ids,
      data: {
        whose: whose(world, ids),
        size: sizeOf(content, next).name,
        old: sizeOf(content, old).name,
      },
    });
    Object.assign(old, { owner: 0, outgrown: 0 });
  }
}

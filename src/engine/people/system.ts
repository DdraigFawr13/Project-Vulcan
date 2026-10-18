// The people system (P2.1): when a world begins, the band arrives. Each person is a row of the
// `person` table with a row per skill and per trait, standing near the start tile, and one ledger
// line names them all. Each minute they walk (P2.3) and choose what to do from their needs (P2.2, mind.ts).
import { clockAt, type EngineContent, type MapState, type WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import { valleyOf } from '../region/index.ts';
import type { System } from '../sim/index.ts';
import { drawBand, type Home } from './band.ts';
import { JOB_FIELDS } from './jobs.ts';
import { hourNow, MIND_FIELDS, think } from './mind.ts';
import { stepAlong, WALK_FIELDS } from './walk.ts';

const ATTRIBUTES = [
  'strength',
  'agility',
  'endurance',
  'intellect',
  'willpower',
  'perception',
  'charisma',
];

export const PEOPLE_TABLES: Schemas = {
  person: {
    name: 'text',
    sex: 'text',
    race: 'text',
    culture: 'text',
    /** The settlement they came from ('' for a plain seed), its days away and direction. */
    home: 'text',
    homeDays: 'count',
    homeDir: 'text',
    /** Year of birth, so age follows the calendar. */
    born: 'int',
    ...Object.fromEntries(ATTRIBUTES.map((a) => [a, 'count' as const])),
    trade: 'text',
    /** The look, drawn once: hair style ('' for bald), hair and clothing colours as #rrggbb. */
    hair: 'text',
    hairColour: 'text',
    clothes: 'text',
    x: 'int',
    y: 'int',
    z: 'int',
    /** `alive` for now; a person who dies keeps their row so old lines can still name them. */
    status: 'text',
    arrived: 'event',
    ...WALK_FIELDS,
    ...MIND_FIELDS,
    ...JOB_FIELDS,
  },
  skill: { person: 'entity', skill: 'text', level: 'count', potential: 'count' },
  trait: { person: 'entity', trait: 'text' },
};

/** Where the band came from: the valley's neighbours, or the home culture for a plain seed. */
function homesOf(world: WorldState, content: EngineContent): Home[] {
  const found = valleyOf(world.seed, content);
  const byName = (n: string) => content.cultures.find((c) => c.id === n || c.name === n)?.id;
  const homes = (found?.valley.near ?? [])
    .map((n) => ({ name: n.name, culture: byName(n.culture) ?? '', days: n.days, dir: n.dir }))
    .filter((h) => h.culture);
  return homes.length ? homes : [{ name: '', culture: content.band.homeCulture, days: 0, dir: '' }];
}

/** Open ground near the start: the band's spots first, then the nearest open tiles around. */
function standingSpots(map: MapState, content: EngineContent, count: number): [number, number][] {
  const open = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const i = y * map.width + x;
    const kind = content.terrain.kinds[map.tiles[i]!]!;
    const feature = map.features[i]! ? content.features[map.features[i]! - 1] : undefined;
    return !kind.water && !kind.solid && !feature?.blocks;
  };
  const out: [number, number][] = [];
  const take = (x: number, y: number): void => {
    if (out.length < count && open(x, y) && !out.some(([a, b]) => a === x && b === y))
      out.push([x, y]);
  };
  for (const [dx, dy] of content.band.spots) take(map.startX + dx!, map.startY + dy!);
  for (let r = 1; out.length < count && r <= 12; r += 1)
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r) take(map.startX + dx, map.startY + dy);
  while (out.length < count) out.push([map.startX, map.startY]);
  return out;
}

const list = (items: readonly string[]): string =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

export const peopleSystem: System = {
  id: 'people',
  every: 'minute',
  stream: 'people',
  emits: ['people.arrived', 'work.tookUp', 'work.tookUpMarked', 'work.felled'],
  tables: PEOPLE_TABLES,
  init(ctx) {
    const { world, content } = ctx;
    const homes = homesOf(world, content);
    const band = drawBand(ctx.rng(), content, homes);
    const found = valleyOf(world.seed, content);
    // The arrival follows the choice of valley; a plain seed has none, so it follows the beginning.
    const settled = world.log.find((e) => e.type === 'region.settled')?.id ?? world.begunEvent;
    const from = [...new Set(band.map((p) => p.home.name).filter(Boolean))];
    const arrived = ctx.emit('people.arrived', {
      causes: [settled],
      data: {
        names: list(band.map((p) => p.name)),
        valley: found?.valley.name ?? 'the valley',
        homes: from.length ? list(from) : 'far off',
      },
    });
    const year = clockAt(world.tick, content.calendar).year;
    const spots = standingSpots(world.map, content, band.length);
    band.forEach((p, k) => {
      const id = addEntity(world, 'person', {
        ...{ name: p.name, sex: p.sex, race: p.race, culture: p.culture },
        ...{ home: p.home.name, homeDays: p.home.days, homeDir: p.home.dir, born: year - p.age },
        ...Object.fromEntries(ATTRIBUTES.map((a) => [a, p.attributes[a] ?? 0])),
        ...{ trade: p.trade, hair: p.hair, hairColour: p.hairColour, clothes: p.clothes },
        ...{ x: spots[k]![0], y: spots[k]![1], z: 0, status: 'alive', arrived },
        ...{ path: [], stride: 0, rest: 30 + 15 * k, doing: '', retry: 0 },
        ...{ job: '', target: -1, work: 0, took: 0, next: 0 },
      });
      for (const skill of content.band.skills)
        addEntity(world, 'skill', { person: id, skill, ...p.skills[skill]! });
      for (const trait of p.traits) addEntity(world, 'trait', { person: id, trait });
    });
  },
  run(ctx) {
    const hour = hourNow(ctx);
    for (const p of ctx.world.entities['person'] ?? []) {
      if (p['status'] !== 'alive') continue;
      stepAlong(ctx, p);
      think(ctx, p, hour);
    }
  },
};

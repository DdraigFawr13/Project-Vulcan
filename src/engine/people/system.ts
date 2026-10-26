// The people system (P2.1): when a world begins, the band arrives. Each person is a row of the
// `person` table with a row per skill and per trait, standing near the start tile, and one ledger
// line names them all. Each minute they walk (P2.3) and choose what to do from their needs (P2.2, mind.ts).
import {
  clockAt,
  streamFor,
  TICKS_PER_DAY,
  type EngineContent,
  type MapState,
  type WorldState,
} from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';
import { valleyOf } from '../region/index.ts';
import type { System } from '../sim/index.ts';
import { drawBand, type Home } from './band.ts';
import { drawSmithing } from './smithing.ts';
import { addPerson, ATTRIBUTES, NEWCOMER_FIELDS } from './row.ts';
import { FORAGE_TABLES } from './forage.ts';
import { JOB_FIELDS } from './jobs.ts';
import { DRINK_FIELDS } from './drink.ts';
import { hourNow, MIND_FIELDS, think } from './mind.ts';
import { markUsed } from './hearth.ts';
import { PRIORITY_TABLES, setPriority } from './priority.ts';
import { TOOL_TABLES, toolsDaily } from './tools.ts';
import { rollTally, TALLY_START } from './tally.ts';
import { stepAlong, WALK_FIELDS } from './walk.ts';
import { risk } from './accident.ts';
import { careMinute } from './care.ts';
import { attacksMinute, syncLures } from './fight.ts';
import { tracksMinute } from './hunt.ts';
import { herdWatch } from './herd.ts';

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
    /** `alive`; `stranger` while a newcomer waits on the band's word, `gone` once turned away
     * (P5.9); a person who dies keeps their row so old lines can still name them. */
    status: 'text',
    arrived: 'event',
    ...NEWCOMER_FIELDS,
    ...WALK_FIELDS,
    ...MIND_FIELDS,
    ...DRINK_FIELDS,
    ...JOB_FIELDS,
  },
  /** `xp`: minutes practised towards the next level (P2.5, learn.ts). */
  skill: { person: 'entity', skill: 'text', level: 'count', potential: 'count', xp: 'count' },
  trait: { person: 'entity', trait: 'text' },
  ...PRIORITY_TABLES,
  ...FORAGE_TABLES,
  ...TOOL_TABLES,
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
  emits: [
    'people.arrived',
    'work.tookUp',
    'work.tookUpMarked',
    'work.tookUpClearing',
    'people.movedIn',
    'people.claimedBed',
    'people.movedRoom',
    'work.tookUpCarpentry',
    'work.tookUpHearth',
    'work.tookUpTending',
    'work.tookUpCooking',
    'food.cooked',
    'people.warming',
    'fire.lit',
    'fire.built',
    'fire.banked',
    'furniture.made',
    'work.felled',
    'work.tookUpBuilding',
    'build.waiting',
    'build.shutIn',
    'build.built',
    'build.takenDown',
    'work.picked',
    'work.prioritySet',
    'work.declined',
    'skill.rose',
    ...[
      'work.tookUpSowing',
      'work.tookUpReaping',
      'work.tookUpMucking',
      'work.tookUpWatering',
      'field.harvested',
      'farm.harvestHome',
    ],
    ...['hall.feast', 'people.movedHome'],
    ...[
      'people.changed',
      'work.tookUpWeaving',
      'loom.wove',
      'work.tookUpTailoring',
      'clothes.made',
    ],
    'goods.ateSeed',
    ...['work.tookUpStation', 'metal.smelterBuilt', 'work.tookUpCharcoal', 'metal.clampLit'],
    ...[
      'metal.charcoalMade',
      'work.tookUpSmelting',
      'metal.smelted',
      'metal.mixed',
      'metal.waiting',
    ],
    ...[
      'tool.taken',
      'tool.worn',
      'tool.broke',
      'work.tookUpSmithing',
      'smith.made',
      'smith.noIngots',
    ],
    'craft.firstFine',
    ...['mine.sank', 'mine.dug', 'mine.veinMined', 'mine.clayDug', 'mine.noLadder'],
    ...['health.hurt', 'health.found', 'health.missed', 'health.carried', 'health.bound'],
    'work.tookUpBurial',
    ...['work.tookUpHunting', 'work.tookUpFishing', 'work.followedTracks', 'work.trackingPack'],
    ...['wild.tracksFound', 'wild.sighted', 'wild.attacked', 'wild.killed'],
    ...['wild.predatorWounded', 'wild.predatorKilled', 'wild.packDrewOff'],
    ...['flock.watchLit', 'flock.watchEnded', 'flock.noWatch'],
  ],
  tables: PEOPLE_TABLES,
  refs: ['noIngots', 'noCharcoal', 'tracksLine', 'sighted', 'signLine'],
  // Yesterday's tally (tally.ts) lives in the state too, and `idle`: the signature of the rooms
  // when carpentry last found nothing to make (carpentry.ts).
  // P5.4a: `tracksDay` the game day of the last `wild.tracksFound` and `tracksLine` it; `sighted`
  // the last `wild.sighted` line and `sightedAt` its tick; `lured` the middens the pack was told of;
  // `fished` the fish caught.
  initialState: {
    ...{ ...TALLY_START, idle: 0, noIngots: 0, noCharcoal: 0 },
    ...{ tracksDay: 0, tracksLine: 0, sighted: 0, sightedAt: 0, lured: 0, fished: 0, taken: 0 },
  },
  commands: {
    setPriority: (ctx, command, cause) => setPriority(ctx, command.data, cause),
  },
  init(ctx) {
    const { world, content } = ctx;
    const homes = homesOf(world, content);
    const band = drawBand(ctx.rng(), content, homes);
    // Smithing is drawn after the band from its own stream, so the band is as it always was.
    const smithing = drawSmithing(streamFor(world, 'smithing'), content, band);
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
      const at = { x: spots[k]![0], y: spots[k]![1], status: 'alive', arrived };
      // The band wants homes of their own after a season under a shared roof (P5.14).
      const wantsFrom = world.tick + content.strangers.home.after * TICKS_PER_DAY;
      addPerson(world, content, p, { ...at, born: year - p.age, rest: 30 + 15 * k }, smithing[k]!, {
        wantsFrom,
      });
    });
  },
  run(ctx) {
    rollTally(ctx);
    markUsed(ctx);
    toolsDaily(ctx);
    const hour = hourNow(ctx);
    careMinute(ctx);
    herdWatch(ctx);
    for (const p of ctx.world.entities['person'] ?? []) {
      if (p['status'] !== 'alive') continue;
      stepAlong(ctx, p);
      tracksMinute(ctx, p);
      think(ctx, p, hour);
      risk(ctx, p);
    }
    syncLures(ctx);
    attacksMinute(ctx);
  },
};

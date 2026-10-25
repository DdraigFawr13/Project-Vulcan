// The flock's table and the questions the people side asks of it (P5.4b, Phase 5 Bundle 3). One
// `flock` row stands for each built pasture; the animals are wild `animal` rows in a kept `herd`.
import { clockAt, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { foldTiles, grazingTiles, pasturesOf } from '../build/index.ts';
import { entityOf, type Schemas } from '../entity/index.ts';
import { animalsOf, herdsOf, herdOf } from '../wild/index.ts';

export const FLOCK_TABLES: Schemas = {
  /** A flock, one per built pasture (`pasture`). `hay` is the rick; `swaths`, `swathHay`, `swathDry`
   * are parallel lists (a cut tile, its hay left, its dry days); `mown` the meadow tiles mown this
   * year; `mowDay` the day number on which mowing is allowed, `mowLog` the day `flock.mowing` was
   * last written; `spoiled` hay lost to rain this year; `folded` 1 while shut in; `outLine` tonight's
   * `flock.leftOut` (0 at dawn); `takenAt` / `takenLine` the pack's last taking; `onHay` 1 while the
   * flock eats from the rick; `cullLine` the latest cull line; `full` 1 once `flock.full` is said;
   * `line` the flock's latest line; `year` the year the yearly counters belong to; `births` the
   * lambs drawn for this month, four numbers each: day, species (index in `flock.kinds`), sex
   * (0 female, 1 male), days the weak one lives (0 for a healthy one). */
  flock: {
    pasture: 'entity',
    hay: 'count',
    swaths: 'ints',
    swathHay: 'ints',
    swathDry: 'ints',
    mown: 'ints',
    mowDay: 'int',
    mowLog: 'int',
    spoiled: 'count',
    folded: 'count',
    outLine: 'event',
    takenAt: 'int',
    takenLine: 'event',
    onHay: 'count',
    cullLine: 'event',
    full: 'count',
    line: 'event',
    year: 'count',
    births: 'ints',
  },
};

export const flocksOf = (world: WorldState): EntityRow[] => world.entities['flock'] ?? [];

export const flockOf = (world: WorldState, pastureId: number): EntityRow | undefined =>
  flocksOf(world).find((f) => f['pasture'] === pastureId);

/** The pasture a flock grazes. */
export const pastureOf = (world: WorldState, flock: EntityRow): EntityRow =>
  entityOf(world, 'pasture', flock['pasture'] as number)!;

/** The ids of the kept herds of a flock (one per species). */
export const keptHerds = (world: WorldState, flock: EntityRow): EntityRow[] =>
  herdsOf(world).filter((h) => h['kept'] === flock['pasture']);

/** A flock's animal rows, by id. */
export function keptOf(world: WorldState, flock: EntityRow): EntityRow[] {
  const herds = new Set(keptHerds(world, flock).map((h) => h.id));
  return animalsOf(world).filter((a) => herds.has(a['herd'] as number));
}

export const headOf = (world: WorldState, flock: EntityRow): number => keptOf(world, flock).length;

export const kindDef = (content: EngineContent, species: string) =>
  content.flock.kinds.find((k) => k.species === species)!;

/** The species id of a kept animal. */
export const speciesId = (world: WorldState, animal: EntityRow): string =>
  herdOf(world, animal['herd'] as number)!['species'] as string;

/** What lines call an animal: `ewe`, `lamb`, `nanny goat`. */
export function animalWord(content: EngineContent, animal: EntityRow): string {
  for (const k of content.flock.kinds) {
    if (animal['kind'] === k.female) return k.femaleName;
    if (animal['kind'] === k.male) return k.maleName;
    if (animal['kind'] === k.young) return k.youngName;
  }
  return animal['kind'] as string;
}

/** "a" or "an" before a word. */
export const articleOf = (word: string): string => ('aeiou'.includes(word.charAt(0)) ? 'an' : 'a');

/** A person's name, else "Someone". */
export function whoName(world: WorldState, id: number): string {
  const person = id ? entityOf(world, 'person', id) : undefined;
  return (person?.['name'] as string | undefined) ?? 'Someone';
}

/** Where a flock may stand: the fold while shut in, else the grazing ground. */
export function placeTiles(world: WorldState, flock: EntityRow): number[] {
  const p = pastureOf(world, flock);
  return flock['folded'] ? foldTiles(world.map.width, p) : grazingTiles(world.map.width, p);
}

/** The grazing tile nearest the pasture's middle: where the pack is drawn to. */
export function lureTile(world: WorldState, flock: EntityRow): number {
  const w = world.map.width;
  const p = pastureOf(world, flock);
  const [mx, my] = [
    (p['x'] as number) + (p['w'] as number) / 2,
    (p['y'] as number) + (p['h'] as number) / 2,
  ];
  let [best, far] = [-1, Infinity];
  for (const t of grazingTiles(w, p)) {
    const d = Math.abs((t % w) - mx) + Math.abs(Math.floor(t / w) - my);
    if (d < far) [best, far] = [t, d];
  }
  return best;
}

/** The built pastures that have no flock row yet. */
export const unflocked = (world: WorldState): EntityRow[] =>
  pasturesOf(world).filter((p) => p['state'] === 'built' && !flockOf(world, p.id));

export const dayNumber = (tick: number): number => Math.floor(tick / 1440);

/** The calendar month name now and its index. */
export function monthNow(
  world: WorldState,
  content: EngineContent,
): { name: string; index: number } {
  const index = clockAt(world.tick, content.calendar).month;
  return { name: content.calendar.monthNames[index]!, index };
}

/** Whole days from today to the next first of `month` (a name): a year when it is that month. */
export function daysTo(world: WorldState, content: EngineContent, month: string): number {
  const cal = content.calendar;
  const clock = clockAt(world.tick, cal);
  const target = cal.monthNames.indexOf(month);
  const months = ((target - clock.month - 1 + cal.monthsPerYear) % cal.monthsPerYear) + 1;
  return months * cal.daysPerMonth - (clock.day - 1);
}

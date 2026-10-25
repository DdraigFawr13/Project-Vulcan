// The flock's midnight and month starts (P5.4b): hay spoiling or drying, the flock on hay, the rick,
// lambing, growing up and the autumn cull.
import { clockAt, type EntityRow, type WorldState } from '../core/index.ts';
import { foldTiles, grazingTiles } from '../build/index.ts';
import { addEntity, removeEntity } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { cullEarly, setCull, starve } from './cull.ts';
import { animalWord, articleOf, flocksOf, headOf, keptOf, pastureOf, speciesId } from './flock.ts';
import { hayDay, yearNow } from './hay.ts';
import { keptHerdFor } from './tame.ts';

const plural = (word: string, n: number): string => (n === 1 ? word : `${word}s`);

/** Whether snow lies on most of the pasture's grazing tiles. */
function snowOnPasture(world: WorldState, flock: EntityRow): boolean {
  const tiles = grazingTiles(world.map.width, pastureOf(world, flock));
  const snowy = tiles.filter((t) => world.map.snowLie[t]).length;
  return tiles.length > 0 && snowy * 2 > tiles.length;
}

/** The flock eats from the rick while snow lies: `flock.onHay` at the first snow after the hay
 * months, `flock.onGrass` on the first of the thaw month; then the day's feed, the early cull and
 * the starving. */
function onHayDay(ctx: SystemContext, flock: EntityRow, first: boolean): void {
  const { world, content } = ctx;
  const index = clockAt(world.tick, content.calendar).month;
  const name = content.calendar.monthNames[index]!;
  const weather = world.systems['weather'];
  const head = headOf(world, flock);
  if (flock['onHay'] && first && name === content.flock.hay.thaw) {
    flock['onHay'] = 0;
    const cause = flock['line'] as number;
    flock['line'] = ctx.emit('flock.onGrass', { causes: cause ? [cause] : [] });
    return;
  }
  const last = Math.max(
    ...content.flock.hay.months.map((m) => content.calendar.monthNames.indexOf(m)),
  );
  if (!flock['onHay'] && index > last && snowOnPasture(world, flock)) {
    flock['onHay'] = 1;
    const cause = weather?.['snowLine'] || (flock['line'] as number);
    flock['line'] = ctx.emit('flock.onHay', {
      causes: cause ? [cause] : [],
      data: {
        hay: flock['hay'] as number,
        days: head ? Math.floor((flock['hay'] as number) / head) : 0,
      },
    });
  }
  if (!flock['onHay'] || !head) return;
  if ((flock['hay'] as number) >= head) {
    flock['hay'] = (flock['hay'] as number) - head;
    cullEarly(ctx, flock);
  } else {
    flock['hay'] = 0;
    starve(ctx, flock);
  }
}

/** The month's lambs are drawn now: for each grown female with a grown male of her species in the
 * pasture, a lamb with chance `lambing.chance` on a day of the month, of either sex, and a weak one
 * may die within `diesWithin` days. Stored in `births` (four numbers each). */
function drawLambs(ctx: SystemContext, flock: EntityRow): void {
  const { world, content } = ctx;
  const rng = ctx.rng();
  const def = content.flock.lambing;
  const births = flock['births'] as number[];
  const animals = keptOf(world, flock);
  content.flock.kinds.forEach((kd, s) => {
    const mine = animals.filter((a) => speciesId(world, a) === kd.species && !a['young']);
    if (!mine.some((a) => a['sex'] === 'm')) return;
    for (const _ of mine.filter((a) => a['sex'] === 'f')) {
      if (!rng.chance(def.chance)) continue;
      const day = rng.between(1, content.calendar.daysPerMonth);
      const sex = rng.int(2);
      births.push(day, s, sex, rng.chance(def.dies) ? rng.between(1, def.diesWithin) : 0);
    }
  });
}

/** Today's births: each makes a lamb in the fold; one `flock.lambed` for a species' day. */
function bear(ctx: SystemContext, flock: EntityRow, dayOfMonth: number): void {
  const { world, content } = ctx;
  const births = flock['births'] as number[];
  const rest: number[] = [];
  const born = new Map<number, number>();
  const rng = ctx.rng();
  const fold = foldTiles(world.map.width, pastureOf(world, flock));
  for (let k = 0; k < births.length; k += 4) {
    const [day, s, sex, dies] = births.slice(k, k + 4) as [number, number, number, number];
    if (day !== dayOfMonth) {
      rest.push(day, s, sex, dies);
      continue;
    }
    const kd = content.flock.kinds[s]!;
    const at = rng.pick(fold);
    addEntity(world, 'animal', {
      ...{
        herd: keptHerdFor(ctx, flock, kd.species),
        pack: 0,
        kind: kd.young,
        x: at % world.map.width,
      },
      ...{
        y: Math.floor(at / world.map.width),
        z: 0,
        path: [],
        stride: 0,
        facing: 'e',
        state: '',
        until: 0,
      },
      ...{ sex: sex ? 'm' : 'f', born: world.tick, young: 1, tamedBy: 0, cull: 0, shorn: 0 },
      dies: dies ? world.tick + dies * 1440 : 0,
    });
    born.set(s, (born.get(s) ?? 0) + 1);
  }
  flock['births'] = rest;
  for (const [s, count] of born) {
    const cause = flock['line'] as number;
    flock['line'] = ctx.emit('flock.lambed', {
      causes: cause ? [cause] : [],
      data: { count, young: plural(content.flock.kinds[s]!.youngName, count) },
    });
  }
}

/** Weak young die when their day comes: `flock.youngDied`, no carcass worth a good. */
function youngDie(ctx: SystemContext, flock: EntityRow): void {
  const { world, content } = ctx;
  for (const a of keptOf(world, flock)) {
    if (!a['dies'] || world.tick < (a['dies'] as number)) continue;
    const word = animalWord(content, a);
    const cause = flock['line'] as number;
    flock['line'] = ctx.emit('flock.youngDied', {
      causes: cause ? [cause] : [],
      data: { a: articleOf(word), young: word },
    });
    removeEntity(world, 'animal', a.id);
  }
}

/** The first of `lambing.grown`: last year's young are grown. */
function growUp(ctx: SystemContext, flock: EntityRow): void {
  const { world, content } = ctx;
  for (const kd of content.flock.kinds) {
    const young = keptOf(world, flock).filter(
      (a) => a['young'] && speciesId(world, a) === kd.species,
    );
    if (!young.length) continue;
    let females = 0;
    for (const a of young) {
      const f = a['sex'] === 'f';
      females += f ? 1 : 0;
      Object.assign(a, { young: 0, dies: 0, kind: f ? kd.female : kd.male });
    }
    const males = young.length - females;
    const cause = flock['line'] as number;
    flock['line'] = ctx.emit('flock.grown', {
      causes: cause ? [cause] : [],
      data: {
        ...{
          young: plural(kd.youngName, young.length),
          females,
          female: plural(kd.femaleName, females),
        },
        ...{ males, male: plural(kd.maleName, males) },
      },
    });
  }
}

/** The month's first day for one flock. */
function monthStart(ctx: SystemContext, flock: EntityRow, name: string): void {
  const { world, content } = ctx;
  const months = content.flock.hay.months;
  const after =
    content.calendar.monthNames[
      (content.calendar.monthNames.indexOf(months.at(-1)!) + 1) % content.calendar.monthsPerYear
    ];
  if (name === content.flock.lambing.month) drawLambs(ctx, flock);
  if (name === content.flock.lambing.grown) growUp(ctx, flock);
  if (name === after) {
    const head = headOf(world, flock);
    const hay = flock['hay'] as number;
    if (head || hay) {
      const cause = flock['line'] as number;
      flock['line'] = ctx.emit('flock.rick', {
        causes: cause ? [cause] : [],
        data: { hay, days: head ? Math.floor(hay / head) : 0, head },
      });
    }
  }
  if (name === content.flock.cull.month) setCull(ctx, flock);
}

/** Midnight, after the weather and the wild. */
export function dailyFlock(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const clock = clockAt(world.tick, content.calendar);
  const name = content.calendar.monthNames[clock.month]!;
  const first = clock.day === 1;
  state['wetPrev'] = state['wetNow']!;
  const wet = world.systems['weather']?.['wet'] === 1;
  state['wetNow'] = wet ? 1 : 0;
  for (const flock of flocksOf(world)) {
    if (first && clock.month === 0)
      Object.assign(flock, { spoiled: 0, mown: [], year: yearNow(world, content) });
    hayDay(ctx, flock, wet);
    if (first) monthStart(ctx, flock, name);
    bear(ctx, flock, clock.day);
    youngDie(ctx, flock);
    onHayDay(ctx, flock, first);
    if (headOf(world, flock) < content.flock.pasture.holds) flock['full'] = 0;
  }
}

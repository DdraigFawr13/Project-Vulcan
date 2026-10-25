// The hay meadow (proposal P3): mowing on a day after a dry night, drying in swaths, the rick, and
// the rain that spoils cut hay. The people side picks the work; these are the rules.
import { clockAt, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import { meadowTiles } from '../build/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { dayNumber, monthNow, pastureOf, whoName } from './flock.ts';

const list = (flock: EntityRow, key: string): number[] => flock[key] as number[];

/** Whether the calendar is in a hay month. */
export const inHayMonth = (world: WorldState, content: EngineContent): boolean =>
  content.flock.hay.months.includes(monthNow(world, content).name);

/** Meadow tiles not yet mown this year, when today is a mowing day. */
export function mowable(world: WorldState, content: EngineContent, flock: EntityRow): number[] {
  if (!inHayMonth(world, content) || flock['mowDay'] !== dayNumber(world.tick)) return [];
  const done = new Set(list(flock, 'mown'));
  return meadowTiles(world.map.width, pastureOf(world, flock)).filter((t) => !done.has(t));
}

/** Mows a meadow tile: it joins the year's mown list and lies as a swath of `hay.perTile` hay.
 * The first tile of a day writes `flock.mowing`; returns that line, else 0. */
export function mowTile(
  ctx: SystemContext,
  flock: EntityRow,
  tile: number,
  byPerson: number,
): number {
  const { world, content } = ctx;
  if (list(flock, 'mown').includes(tile)) return 0;
  list(flock, 'mown').push(tile);
  list(flock, 'swaths').push(tile);
  list(flock, 'swathHay').push(content.flock.hay.perTile);
  list(flock, 'swathDry').push(0);
  const day = dayNumber(world.tick);
  if (flock['mowLog'] === day) return 0;
  flock['mowLog'] = day;
  const cause = flock['line'] as number;
  return (flock['line'] = ctx.emit('flock.mowing', {
    actors: byPerson ? [byPerson] : [],
    causes: cause ? [cause] : [],
    data: { who: whoName(world, byPerson) },
  }));
}

/** Cut tiles whose hay has dried (`hay.dry` dry days). */
export function readySwaths(
  _world: WorldState,
  content: EngineContent,
  flock: EntityRow,
): number[] {
  const dry = list(flock, 'swathDry');
  return list(flock, 'swaths').filter((_, k) => dry[k]! >= content.flock.hay.dry);
}

/** Takes up to `most` hay from the swath on `tile`; returns what was taken (0 for no swath). */
export function takeHay(_world: WorldState, flock: EntityRow, tile: number, most: number): number {
  const k = list(flock, 'swaths').indexOf(tile);
  if (k < 0) return 0;
  const hay = list(flock, 'swathHay');
  const took = Math.min(most, hay[k]!);
  hay[k] = hay[k]! - took;
  if (hay[k] === 0)
    for (const key of ['swaths', 'swathHay', 'swathDry']) list(flock, key).splice(k, 1);
  return took;
}

/** Stacks hay in the rick. */
export function addToRick(_ctx: SystemContext, flock: EntityRow, hay: number): void {
  flock['hay'] = (flock['hay'] as number) + hay;
}

/** A midnight in the hay field: a wet day spoils `hay.spoil` of each swath (rounded up, in whole
 * hay; one `flock.haySpoiled` for the day's loss), a dry one dries every swath a day more. */
export function hayDay(ctx: SystemContext, flock: EntityRow, wet: boolean): void {
  const { world, content } = ctx;
  const swaths = list(flock, 'swaths');
  if (!swaths.length) return;
  if (!wet) {
    const dry = list(flock, 'swathDry');
    dry.forEach((d, k) => (dry[k] = d + 1));
    return;
  }
  const permille = Math.round(content.flock.hay.spoil * 1000);
  const hay = list(flock, 'swathHay');
  let lost = 0;
  for (let k = hay.length - 1; k >= 0; k -= 1) {
    const loss = Math.floor((hay[k]! * permille + 999) / 1000);
    lost += loss;
    hay[k] = hay[k]! - loss;
    if (hay[k]! <= 0)
      for (const key of ['swaths', 'swathHay', 'swathDry']) list(flock, key).splice(k, 1);
  }
  if (!lost) return;
  flock['spoiled'] = (flock['spoiled'] as number) + lost;
  const spell = world.systems['weather']?.['spell'] || (flock['line'] as number);
  flock['line'] = ctx.emit('flock.haySpoiled', {
    causes: spell ? [spell] : [],
    data: { lost },
  });
}

/** Whether the night just gone was dry: neither yesterday nor today (the weather's daily wet flag
 * is drawn at midnight and covers the day) was wet. */
export const dryNight = (ctx: SystemContext): boolean =>
  !ctx.state['wetPrev'] && !ctx.state['wetNow'];

/** At 06:00 of a hay month after a dry night, today becomes a mowing day. */
export function setMowDay(ctx: SystemContext, flock: EntityRow): void {
  if (inHayMonth(ctx.world, ctx.content) && dryNight(ctx))
    flock['mowDay'] = dayNumber(ctx.world.tick);
}

export const yearNow = (world: WorldState, content: EngineContent): number =>
  clockAt(world.tick, content.calendar).year;

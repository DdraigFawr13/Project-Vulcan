// Harvest home (5B Bundle 4, proposal P1, V-093, V-121, V-133): when the last field of the year is
// reaped (no other field still growing, and no crop has a month to be sown left this year), the
// colony calls the harvest-home supper. That evening everyone free gathers in the hall (else at the
// campfire) and eats the best food in store together (people/feast.ts); each remembers the feast.
// Once a year; other harvests have their own lines and no feast. A wedding (engine family) calls
// its own feast, round the fire on the green, through `callWedding`; a feast day (6B, engine faith)
// its own, round the shrine, through `callHoly`.
import { clockAt, TICKS_PER_DAY, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fieldsOf } from './fields.ts';

export const FEAST_TABLES: Schemas = {
  /** A harvest-home supper: the harvest line that called it, the year, `called` until it is eaten
   * (`eaten`), the tick the first person arrived (0 before), who has arrived, the line it was
   * eaten on; `couple` the two wed (P6.1), none for the harvest home; `on` the game day it is
   * held (a supper not eaten that evening lapses, so it never blocks the next); `holy` the feast
   * day (a `holyday` row, 6B) it keeps, 0 for none, and `lean` 1 when it is kept with no supper. */
  feast: {
    ...{ line: 'event', year: 'int', state: 'text', start: 'int', there: 'ints' },
    ...{ eaten: 'event', couple: 'ints', on: 'int', holy: 'int', lean: 'count' },
  },
};

const today = (world: WorldState): number => Math.floor(world.tick / TICKS_PER_DAY);

/** The supper called for this evening and not yet eaten, if any. */
export const feastOf = (world: WorldState): EntityRow | undefined =>
  (world.entities['feast'] ?? []).find((f) => f['state'] === 'called' && f['on'] === today(world));

/** Whether field `f`, just reaped, was the last of the year. */
export function lastOfYear(ctx: SystemContext, f: EntityRow): boolean {
  const { world, content } = ctx;
  const growing = fieldsOf(world).some(
    (o) => o.id !== f.id && (o['state'] === 'sown' || o['state'] === 'ripe'),
  );
  if (growing) return false;
  const names = content.calendar.monthNames;
  const now = clockAt(world.tick, content.calendar).month;
  return !content.buildings.field.crops.some((c) => c.sow.some((m) => names.indexOf(m) > now));
}

/** Calls the harvest-home supper for this evening, once a year; tomorrow's when a wedding's is
 * called for tonight. */
export function callFeast(ctx: SystemContext, cause: number): void {
  const { world, content } = ctx;
  const year = clockAt(world.tick, content.calendar).year;
  const feasts = world.entities['feast'] ?? [];
  const harvest = (f: EntityRow) => !(f['couple'] as number[] | undefined)?.length && !f['holy'];
  if (feasts.some((f) => f['year'] === year && harvest(f))) return;
  const on = today(world) + (feastOf(world) ? 1 : 0);
  addEntity(world, 'feast', {
    ...{ line: cause, year, state: 'called', start: 0, there: [], eaten: 0, couple: [], on },
    ...{ holy: 0, lean: 0 },
  });
}

/** Calls the wedding feast of `couple` for this evening, citing the wedding line; false when a
 * supper is already called for tonight. */
export function callWedding(ctx: SystemContext, cause: number, couple: readonly number[]): boolean {
  const { world, content } = ctx;
  if (feastOf(world)) return false;
  const year = clockAt(world.tick, content.calendar).year;
  addEntity(world, 'feast', {
    ...{ line: cause, year, state: 'called', start: 0, there: [], eaten: 0 },
    ...{ couple: [...couple], on: today(world), holy: 0, lean: 0 },
  });
  return true;
}

/** Calls the supper of feast day `holy` (a `holyday` row), citing `cause`, for this evening, or
 * tomorrow's when a supper is already called for tonight; `lean` keeps it with no food. */
export function callHoly(ctx: SystemContext, cause: number, holy: number, lean: boolean): void {
  const { world, content } = ctx;
  const year = clockAt(world.tick, content.calendar).year;
  const on = today(world) + (feastOf(world) ? 1 : 0);
  addEntity(world, 'feast', {
    ...{ line: cause, year, state: 'called', start: 0, there: [], eaten: 0, couple: [], on },
    ...{ holy, lean: lean ? 1 : 0 },
  });
}

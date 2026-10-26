// Harvest home (5B Bundle 4, proposal P1, V-093, V-121, V-133): when the last field of the year is
// reaped (no other field still growing, and no crop has a month to be sown left this year), the
// colony calls the harvest-home supper. That evening everyone free gathers in the hall (else at the
// campfire) and eats the best food in store together (people/feast.ts); each remembers the feast.
// Once a year; other harvests have their own lines and no feast.
import { clockAt, type EntityRow, type WorldState } from '../core/index.ts';
import { addEntity, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fieldsOf } from './fields.ts';

export const FEAST_TABLES: Schemas = {
  /** A harvest-home supper: the harvest line that called it, the year, `called` until it is eaten
   * (`eaten`), the tick the first person arrived (0 before), who has arrived, the line it was
   * eaten on. */
  feast: {
    ...{ line: 'event', year: 'int', state: 'text', start: 'int', there: 'ints' },
    eaten: 'event',
  },
};

/** The supper called and not yet eaten, if any. */
export const feastOf = (world: WorldState): EntityRow | undefined =>
  (world.entities['feast'] ?? []).find((f) => f['state'] === 'called');

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

/** Calls the harvest-home supper for this evening, once a year. */
export function callFeast(ctx: SystemContext, cause: number): void {
  const { world, content } = ctx;
  const year = clockAt(world.tick, content.calendar).year;
  if ((world.entities['feast'] ?? []).some((f) => f['year'] === year)) return;
  addEntity(world, 'feast', { line: cause, year, state: 'called', start: 0, there: [], eaten: 0 });
}

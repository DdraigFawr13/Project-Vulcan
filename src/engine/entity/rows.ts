// Rows by kind for reading: a kind's table, the people, one person and their name. Systems and
// worker views read through these rather than each keeping its own copy.
import type { EntityRow, WorldState } from '../core/index.ts';

/** A kind's table of rows, or none when nothing of that kind exists yet. */
export const tableOf = (world: WorldState, kind: string): EntityRow[] => world.entities[kind] ?? [];

/** Every person row, the dead included (the dead stay as rows). */
export const people = (world: WorldState): EntityRow[] => world.entities['person'] ?? [];

/** The person with this id, if there is one. */
export const personOf = (world: WorldState, id: unknown): EntityRow | undefined =>
  people(world).find((p) => p.id === id);

/** A person's name, or `none` when the id names nobody. */
export const personName = (world: WorldState, id: unknown, none = ''): string =>
  (personOf(world, id)?.['name'] as string) ?? none;

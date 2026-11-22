// Rows by kind for reading: a kind's table, the people, one person and their name. Systems and
// worker views read through these rather than each keeping its own copy.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';

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

/** The living: every person row whose status is `alive` (not the dead, the gone or strangers). */
export const alive = (world: WorldState): EntityRow[] =>
  people(world).filter((p) => p['status'] === 'alive');

/** The living who are not asleep. */
export const awake = (world: WorldState): EntityRow[] =>
  alive(world).filter((p) => p['doing'] !== 'sleep');

/** How far apart two rows stand: tiles on the larger axis, Infinity on different levels. */
export const far = (a: EntityRow, b: EntityRow): number =>
  a['z'] !== b['z']
    ? Infinity
    : Math.max(
        Math.abs((a['x'] as number) - (b['x'] as number)),
        Math.abs((a['y'] as number) - (b['y'] as number)),
      );

const SKILL_LINES = new Set(['skill.rose', 'skill.taught', 'skill.read']);

/** The newest line the recent ledger holds that raised `person`'s `skill` (an ability id; skill
 * lines name it in lower case), else the line they came to the valley on: what a master's skill
 * cites. */
export function skillLine(
  world: WorldState,
  content: EngineContent,
  person: EntityRow,
  skill: string,
): number {
  const word = (content.abilities.find((a) => a.id === skill)?.name ?? skill).toLowerCase();
  for (let k = world.log.length - 1; k >= 0; k -= 1) {
    const e = world.log[k]!;
    if (SKILL_LINES.has(e.type) && e.actors[0] === person.id && e.data['skill'] === word)
      return e.id;
  }
  return (person['arrived'] as number) ?? 0;
}

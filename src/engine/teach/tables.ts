// The teaching tables and their reads (6B Bundle 6, P6.13, V-074, V-141, V-189): who is whose
// apprentice, and who taught whom.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const TEACH_TABLES: Schemas = {
  /** A master and their apprentice in a skill: the line that bound them (`line`), the tick, and
   * the line that ended it (0 while it lasts), and the minutes beside the master on day `day`. Band `learn.ts` reads it as data. */
  apprentice: {
    ...{ master: 'entity', learner: 'entity', skill: 'text' },
    ...{ line: 'event', since: 'int', ended: 'event', day: 'int', beside: 'count' },
  },
  /** Who taught whom: a learner, their teacher and the skill, from level `from` to `to`, the first
   * and the last taught rise. */
  taught: {
    ...{ learner: 'entity', teacher: 'entity', skill: 'text', from: 'count', to: 'count' },
    ...{ first: 'event', last: 'event' },
  },
  /** The schoolroom (V-189 q7): its house, its teacher (0 none) and the line saying so. */
  school: { house: 'entity', teacher: 'entity', kept: 'event' },
  /** A book: the master whose ways it holds, the skill and level, who wrote it, `state` `writing`
   * (minutes of sittings so far), `kept` on the shelf or `lost`; the line it was begun with, the
   * one it was finished with and the one that lost it. */
  book: {
    ...{ master: 'entity', skill: 'text', level: 'count', scribe: 'entity', state: 'text' },
    ...{ minutes: 'count', begun: 'event', line: 'event', lost: 'event' },
  },
  /** Minutes a person read on game day `day` (1 + its index). */
  reader: { person: 'entity', day: 'int', minutes: 'count' },
};

export const apprenticesOf = (world: WorldState): EntityRow[] => world.entities['apprentice'] ?? [];
export const taughtOf = (world: WorldState): EntityRow[] => world.entities['taught'] ?? [];

/** The bond a person is in now, as master or as learner. */
export const bondNow = (world: WorldState, person: number): EntityRow | undefined =>
  apprenticesOf(world).find(
    (a) => !a['ended'] && (a['master'] === person || a['learner'] === person),
  );

/** A skill's name in lower case ("stoneworking"). */
export const skillWord = (content: EngineContent, skill: string): string =>
  (content.abilities.find((a) => a.id === skill)?.name ?? skill).toLowerCase();

/** The school row of the schoolroom house `house`. */
export const schoolOf = (world: WorldState, house: number | undefined): EntityRow | undefined =>
  (world.entities['school'] ?? []).find((s) => s['house'] === house);
export const booksOf = (world: WorldState): EntityRow[] => world.entities['book'] ?? [];
/** The books on the shelf now. */
export const keptBooks = (world: WorldState): EntityRow[] =>
  booksOf(world).filter((b) => b['state'] === 'kept');
/** "the book of smithing, Colm's method". */
export function bookName(world: WorldState, content: EngineContent, book: EntityRow): string {
  const m = (world.entities['person'] ?? []).find((p) => p.id === book['master']);
  return `the book of ${skillWord(content, book['skill'] as string)}, ${(m?.['name'] as string) ?? 'a master'}'s method`;
}

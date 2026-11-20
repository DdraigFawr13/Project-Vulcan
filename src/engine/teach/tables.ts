// The teaching tables and their reads (6B Bundle 6, P6.13, V-074, V-141, V-189): who is whose
// apprentice, and who taught whom.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const TEACH_TABLES: Schemas = {
  /** A master and their apprentice in a skill: the line that bound them (`line`), the tick, and
   * the line that ended it (0 while it lasts). Band `learn.ts` reads it as data. */
  apprentice: {
    ...{ master: 'entity', learner: 'entity', skill: 'text' },
    ...{ line: 'event', since: 'int', ended: 'event' },
  },
  /** Who taught whom: a learner, their teacher and the skill, from level `from` to `to`, the first
   * and the last taught rise. */
  taught: {
    ...{ learner: 'entity', teacher: 'entity', skill: 'text', from: 'count', to: 'count' },
    ...{ first: 'event', last: 'event' },
  },
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

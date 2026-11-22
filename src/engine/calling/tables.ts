// The callings table and its reads (6B Bundle 6, P6.13, V-175, V-189 q8): who holds which calling.
import type { EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const CALLING_TABLES: Schemas = {
  /** A calling held: by whom, at which stage, in which trade skill ('' for none) and under what
   * title, the line that gave it and when, the tick it ended (0 while held) and the line of the
   * holder's masterwork (0 until made) and its name. Engine entity `callings.ts` reads it as data. */
  calling: {
    ...{ person: 'entity', calling: 'text', stage: 'text', skill: 'text', title: 'text' },
    ...{ line: 'event', since: 'int', ended: 'int', work: 'event', named: 'text' },
  },
};

/** Every calling row, held or ended. */
export const callingsOf = (world: WorldState): EntityRow[] => world.entities['calling'] ?? [];

/** The calling `person` holds now, if any. */
export const callingOf = (world: WorldState, person: number): EntityRow | undefined =>
  callingsOf(world).find((c) => c['person'] === person && !c['ended']);

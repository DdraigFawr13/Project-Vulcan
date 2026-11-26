// The contest system's tables (6C Slice 7 part 3, V-236, V-241).
import type { EntityRow, WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const CONTEST_TABLES: Schemas = {
  /** A contest held at a harvest home: its kind (contests.json), the year, the supper (a `feast`
   * row), the winner, who stood up (winner first, then by score), its line, 1 when it was the one
   * held for the lord. */
  contest: {
    ...{ kind: 'text', year: 'int', feast: 'entity', winner: 'entity', entered: 'ints' },
    ...{ line: 'event', lord: 'count' },
  },
  /** `person` was beaten twice by `of` and holds them their rival, since line `line`. */
  rival: { person: 'entity', of: 'entity', line: 'event' },
};

const contests = (world: WorldState): EntityRow[] => world.entities['contest'] ?? [];

/** The contests held at the supper of feast row `feast`, in the order held. */
export const contestsAt = (world: WorldState, feast: number): EntityRow[] =>
  contests(world).filter((c) => c['feast'] === feast);

/** Every contest held, oldest first. */
export const contestsOf = (world: WorldState): EntityRow[] => contests(world);

/** Whether `a` and `b` are rivals, either way round. */
export const rivals = (world: WorldState, a: number, b: number): boolean =>
  (world.entities['rival'] ?? []).some(
    (r) => (r['person'] === a && r['of'] === b) || (r['person'] === b && r['of'] === a),
  );

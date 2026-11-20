// The family tables and their reads (P6.1, V-145, V-161): how close two unwed adults have grown,
// and their courtship.
import { yearNow, type EngineContent, type EntityRow, type WorldState } from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';
import { personOf } from '../entity/index.ts';

export const FAMILY_TABLES: Schemas = {
  /** Two people, `a` the lower id: how close they are (family.json), their `state` ('' friends,
   * `courting`, `wed`), the tick it began and the line that said so. */
  bond: { a: 'entity', b: 'entity', close: 'int', state: 'text', since: 'int', line: 'event' },
};

export const bondsOf = (world: WorldState): EntityRow[] => world.entities['bond'] ?? [];

/** The bond between two people, if any. */
export function bondOf(world: WorldState, p: number, q: number): EntityRow | undefined {
  const [a, b] = p < q ? [p, q] : [q, p];
  return bondsOf(world).find((r) => r['a'] === a && r['b'] === b);
}

/** The other of a bond. */
export const otherOf = (bond: EntityRow, id: number): number =>
  (bond['a'] === id ? bond['b'] : bond['a']) as number;

/** Whom `id` is courting, 0 for no one. */
export function courtingOf(world: WorldState, id: number): number {
  const r = bondsOf(world).find(
    (x) => x['state'] === 'courting' && (x['a'] === id || x['b'] === id),
  );
  return r ? otherOf(r, id) : 0;
}

/** A person's age in years (`born` is the year they were born). */
export const ageOf = (world: WorldState, content: EngineContent, p: EntityRow): number =>
  yearNow(world, content) - (p['born'] as number);

/** Whether `p` is grown: as old as their race's maturity. */
export function grown(world: WorldState, content: EngineContent, p: EntityRow): boolean {
  const race = content.races.find((r) => r.id === p['race']);
  return !race || ageOf(world, content, p) >= race.maturityYears;
}

/** Whether `p` is free to court: alive, grown, with no living partner. */
export function unwed(world: WorldState, content: EngineContent, p: EntityRow): boolean {
  if (p['status'] !== 'alive' || !grown(world, content, p)) return false;
  const partner = personOf(world, p['partner']);
  return !partner || partner['status'] !== 'alive';
}

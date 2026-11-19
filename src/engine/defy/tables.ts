// The defiance tables and their reads (P6.6's grievances grown into acts, P6.7, V-160).
import {
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type WorldState,
} from '../core/index.ts';
import type { Schemas } from '../entity/index.ts';

export const DEFY_TABLES: Schemas = {
  /** A person's place on the ladder: the step (1 to the number of defy.json `steps`, 0 none),
   * the law the grievance is with, the tick they reached the step, days under its bar, days in
   * low spirits, the line they reached it with, the memory and belief lines behind it and the
   * belief's id, and the ticks they last took from the store and last brawled. */
  defy: {
    ...{ person: 'entity', law: 'text', step: 'int', since: 'int', under: 'int', misery: 'int' },
    ...{ line: 'event', mem: 'event', why: 'event', belief: 'text', took: 'int', brawled: 'int' },
  },
  /** A sentence under the Punishment law: who, its kind (`work`, `stocks`), the day (index) it
   * is served on and the line that gave it. */
  sentence: { person: 'entity', kind: 'text', day: 'int', line: 'event' },
  /** Someone leaving the valley for good, and the line that says so (people `depart.ts`). */
  leaving: { person: 'entity', line: 'event' },
};

export const defyOf = (world: WorldState, person: number): EntityRow | undefined =>
  (world.entities['defy'] ?? []).find((r) => r['person'] === person);

/** The index (1-based) of a step by id, 0 when content has none. */
export const stepAt = (content: EngineContent, id: string): number =>
  content.defy.steps.findIndex((s) => s.id === id) + 1;

/** How far up the ladder `person` stands: 0 for not at all. */
export const stepOf = (world: WorldState, person: number): number =>
  (defyOf(world, person)?.['step'] as number | undefined) ?? 0;

/** Whether `person` is at or past step `id`. */
export const atLeast = (
  world: WorldState,
  content: EngineContent,
  person: number,
  id: string,
): boolean => {
  const k = stepAt(content, id);
  return k > 0 && stepOf(world, person) >= k;
};

/** Whether someone working slowly idles this minute: one in `slow.every`. */
export const slacks = (world: WorldState, content: EngineContent, person: number): boolean =>
  atLeast(world, content, person, 'slow') && world.tick % content.defy.slow.every === 0;

/** The sentence of kind `kind` `person` serves today, if any. */
export const sentenceOf = (
  world: WorldState,
  person: number,
  kind: string,
): EntityRow | undefined => {
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  return (world.entities['sentence'] ?? []).find(
    (r) => r['person'] === person && r['kind'] === kind && r['day'] === day,
  );
};

/** The line `person` is leaving the valley with, 0 for none. */
export const leavingOf = (world: WorldState, person: number): number =>
  ((world.entities['leaving'] ?? []).find((r) => r['person'] === person)?.['line'] as
    number | undefined) ?? 0;

/** A stash `person` pocketed from the store (state `hid`), held by them. */
export const stashOf = (world: WorldState, person: number): EntityRow | undefined =>
  (world.entities['item'] ?? []).find((i) => i['holder'] === person && i['state'] === 'hid');

/** What someone leaving takes with them: their worn clothes, their bedroll and their stash. The
 * rest they own or carry (tools, a load) they leave behind. */
export const takesWith = (content: EngineContent, item: EntityRow, person: number): boolean =>
  (item['owner'] === person || item['holder'] === person) &&
  (item['state'] === 'worn' ||
    item['state'] === 'hid' ||
    item['kind'] === content.life.cart.bedroll);

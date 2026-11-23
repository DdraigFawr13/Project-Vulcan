// The discovery tables and their reads (6C Slice 5, V-142, V-218): each person's puzzle and its
// hints, the hours each works at a trade, and who knows each way.
import type { EngineContent, EntityRow, MethodDef, WorldState } from '../core/index.ts';
import { alive, tableOf, type Schemas } from '../entity/index.ts';

export const DISCOVER_TABLES: Schemas = {
  /** Hours `person` worked at `job` on each of the last `methods.start.days` days (a ring by day
   * number), the day number last written and the line of the latest work there. */
  trade: { person: 'entity', job: 'text', hours: 'ints', day: 'int', line: 'event' },
  /** A person's puzzle over a way: begun on `line` at `since`; `work` hours at its trade toward
   * the next work hint; the days of the last failure and book hints (-1 none); the tick of the
   * last hint; `ended` the line that ended it (a find, theirs or another's), 0 while it lasts;
   * `busy` the last midnight its window held `drop.hours` at its trade. */
  puzzle: {
    ...{ person: 'entity', method: 'text', line: 'event', since: 'int', work: 'count' },
    ...{ failed: 'int', read: 'int', last: 'int', ended: 'event', busy: 'int' },
  },
  /** One hint: the puzzle it is for, its kind (methods.json `kinds`), its line and its words in
   * the find's list. */
  hint: { puzzle: 'entity', kind: 'text', line: 'event', short: 'text' },
  /** Who knows a way: `how` `found`, the line, and `from` who it came from (0 for a find). */
  knows: { person: 'entity', method: 'text', how: 'text', line: 'event', from: 'entity' },
};

export const methodDef = (content: EngineContent, id: string): MethodDef | undefined =>
  content.methods.methods.find((m) => m.id === id);

/** The puzzle `person` is on now. */
export const puzzleOf = (world: WorldState, person: number): EntityRow | undefined =>
  tableOf(world, 'puzzle').find((p) => p['person'] === person && !p['ended']);

/** Every puzzle open now. */
export const puzzlesNow = (world: WorldState): EntityRow[] =>
  tableOf(world, 'puzzle').filter((p) => !p['ended']);

/** The hints gathered on a puzzle, oldest first. */
export const hintsOf = (world: WorldState, puzzle: number): EntityRow[] =>
  tableOf(world, 'hint').filter((h) => h['puzzle'] === puzzle);

export const knowsOf = (world: WorldState): EntityRow[] => tableOf(world, 'knows');

/** Whether `person` knows the way. */
export const knows = (world: WorldState, person: number, method: string): boolean =>
  knowsOf(world).some((k) => k['person'] === person && k['method'] === method);

/** The living colonists who know a way. */
export function knowersOf(world: WorldState, method: string): EntityRow[] {
  const ids = new Set(
    knowsOf(world)
      .filter((k) => k['method'] === method)
      .map((k) => k['person']),
  );
  return alive(world).filter((p) => ids.has(p.id));
}

/** A person's row of hours at a trade. */
export const tradeRow = (world: WorldState, person: number, job: string): EntityRow | undefined =>
  tableOf(world, 'trade').find((t) => t['person'] === person && t['job'] === job);

/** Hours at a trade over the window. */
export const monthHours = (row: EntityRow | undefined): number =>
  ((row?.['hours'] as number[] | undefined) ?? []).reduce((n, h) => n + h, 0);

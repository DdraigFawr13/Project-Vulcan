// Work priorities (P2.5, V-015): the player says what matters more to a person, 1 first to 4
// last, per kind of work. Nobody is assigned: a person looking for work tries the kinds in their
// own order, leaves felling to someone free who puts it higher, and declines work they are not
// able for, once per change, with a line that cites the change.
import type { EngineContent, EntityRow, WorldState } from '../core/index.ts';
import { addEntity, entityOf, type Schemas } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';

export const PRIORITY_TABLES: Schemas = {
  /** A level the player set; a person with no row for a job is at `work.priority.start`. */
  priority: { person: 'entity', job: 'text', level: 'count', line: 'event', declined: 'event' },
};

const rowOf = (world: WorldState, person: number, job: string): EntityRow | undefined =>
  (world.entities['priority'] ?? []).find((r) => r['person'] === person && r['job'] === job);

/** The player's line setting this person's level for a job, or undefined at the start level. */
export const priorityLine = (world: WorldState, person: number, job: string): number | undefined =>
  rowOf(world, person, job)?.['line'] as number | undefined;

/** The line where this person declined a job since its priority last changed, if any. */
export function declinedLine(world: WorldState, person: number, job: string): number | undefined {
  const row = rowOf(world, person, job);
  const declined = row?.['declined'] as number | undefined;
  return row && declined && declined > (row['line'] as number) ? declined : undefined;
}

/** A person's level for a job, 1 first to 4 last. */
export const levelOf = (world: WorldState, content: EngineContent, person: number, job: string) =>
  (rowOf(world, person, job)?.['level'] as number | undefined) ?? content.work.priority.start;

/** The Work sheet's kinds of work in this person's order: by level, ties in content order. */
export function jobsInOrder(world: WorldState, content: EngineContent, p: EntityRow): string[] {
  const jobs = content.work.priority.jobs;
  return [...jobs].sort(
    (a, b) =>
      levelOf(world, content, p.id, a) - levelOf(world, content, p.id, b) ||
      jobs.indexOf(a) - jobs.indexOf(b),
  );
}

/** Whether a person meets a job's requirements (attributes) in jobs.json. */
export function able(content: EngineContent, p: EntityRow, job: string): boolean {
  return shortfall(content, p, job) === undefined;
}

/** The first requirement a person falls short of, if any. */
function shortfall(content: EngineContent, p: EntityRow, job: string) {
  const def = content.jobs.find((j) => j.id === job);
  if (!def) return { attribute: 'skill', need: 1, have: 0 };
  for (const [attribute, need] of Object.entries(def.requirements)) {
    const have = (p[attribute] as number) ?? 0;
    if (have < need) return { attribute, need, have };
  }
  return undefined;
}

/** Whether someone else free to take up `job` now, able, and with somewhere to do it (`can`),
 * puts it higher than `p` does. `can` is asked last: it may search. */
export function outranked(
  ctx: SystemContext,
  p: EntityRow,
  job: string,
  can: (q: EntityRow) => boolean,
): boolean {
  const { world, content } = ctx;
  const mine = levelOf(world, content, p.id, job);
  return (world.entities['person'] ?? []).some(
    (q) =>
      q.id !== p.id &&
      q['status'] === 'alive' &&
      q['job'] === '' &&
      q['doing'] !== 'sleep' &&
      q['doing'] !== 'eat' &&
      world.tick >= (q['next'] as number) &&
      levelOf(world, content, q.id, job) < mine &&
      able(content, q, job) &&
      can(q),
  );
}

/** When `p` is not able for a job the player raised for them, says so once per change. */
export function declineIfUnable(ctx: SystemContext, p: EntityRow, job: string): void {
  const row = rowOf(ctx.world, p.id, job);
  const short = shortfall(ctx.content, p, job);
  if (!row || !short || (row['declined'] as number) > (row['line'] as number)) return;
  if ((row['level'] as number) >= ctx.content.work.priority.start) return;
  row['declined'] = ctx.emit('work.declined', {
    causes: [row['line'] as number],
    actors: [p.id],
    data: { name: p['name'] as string, job: jobWord(ctx.content, job), ...short },
  });
}

const jobWord = (content: EngineContent, job: string): string =>
  (content.jobs.find((j) => j.id === job)?.name ?? job).toLowerCase();

/** The `setPriority` lever: `{ person, job, level }`. Refused with a reason when any is unknown. */
export function setPriority(
  ctx: SystemContext,
  data: Readonly<Record<string, unknown>>,
  cause: number,
): void {
  const { world, content } = ctx;
  const p = entityOf(world, 'person', data['person'] as number);
  const job = data['job'] as string;
  const level = data['level'] as number;
  const levels = content.work.priority.words.length;
  const fits = Number.isSafeInteger(level) && level >= 1 && level <= levels;
  if (!p || p['status'] !== 'alive' || !content.work.priority.jobs.includes(job) || !fits) {
    ctx.emit('command.refused', {
      causes: [cause],
      data: { kind: 'setPriority', reason: 'no such person, kind of work or level' },
    });
    return;
  }
  if (levelOf(world, content, p.id, job) === level) return;
  const line = ctx.emit('work.prioritySet', {
    causes: [cause],
    actors: [p.id],
    data: {
      name: p['name'] as string,
      job: jobWord(content, job),
      word: content.work.priority.words[level - 1]!,
    },
  });
  const row = rowOf(world, p.id, job);
  if (row) Object.assign(row, { level, line });
  else addEntity(world, 'priority', { person: p.id, job, level, line, declined: 0 });
  // They look again at once: a priority speaks to what they take up next.
  p['next'] = 0;
}

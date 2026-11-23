// Spreading and loss (6C Slice 5, V-218 q6, V-141): a way passes from a knower to an apprentice
// in its skill after `spread.apprentice` hours at its trade, to anyone after `spread.beside` hours
// at its trade on days a knower worked it too, and at once to someone reading a book by a knower
// of its skill. Learning ends their own puzzle on it. A way nobody living knows is lost, with a
// line citing the last knower's death or leaving.
import { pronouns, type EntityRow, type MethodDef, type SimEvent } from '../core/index.ts';
import { addEntity, alive, entityOf, tableOf, type Schemas } from '../entity/index.ts';
import { addMemory } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { fill } from './find.ts';
import { knowersOf, knows, knowsOf, puzzleOf } from './tables.ts';
import { tradesOf, workedToday, workLine } from './trade.ts';

export const SPREAD_TABLES: Schemas = {
  /** Hours `person` has worked toward learning a way from a knower. */
  learn: { person: 'entity', method: 'text', hours: 'count' },
};

type How = 'apprentice' | 'book' | 'beside';

/** `p` learns the way from `teacher`, citing `cause`. */
export function learnWay(
  ctx: SystemContext,
  p: EntityRow,
  m: MethodDef,
  teacher: EntityRow,
  how: How,
  causes: readonly number[],
  vars: Readonly<Record<string, unknown>> = {},
): void {
  const { world, content } = ctx;
  const words = fill(content.methods.spread.words[how], {
    ...{ their: pronouns(p).their, them: pronouns(teacher).them, where: m.where, ...vars },
  });
  const line = ctx.emit('discover.learned', {
    causes: causes.filter((l) => l > 0),
    actors: [p.id, teacher.id],
    data: {
      name: p['name'] as string,
      method: m.name,
      teacher: teacher['name'] as string,
      how: words,
    },
  });
  addEntity(world, 'knows', { person: p.id, method: m.id, how, line, from: teacher.id });
  addMemory(ctx, p.id, content.methods.memories.learned, line, teacher.id);
  const q = puzzleOf(world, p.id);
  if (q?.['method'] === m.id) q['ended'] = line;
}

/** The knower `p` is apprenticed to in the way's skill, and the bond. */
function masterOf(ctx: SystemContext, p: EntityRow, m: MethodDef, knowers: EntityRow[]) {
  const bond = tableOf(ctx.world, 'apprentice').find(
    (a) =>
      a['learner'] === p.id &&
      !a['ended'] &&
      a['skill'] === m.skill &&
      knowers.some((k) => k.id === a['master']),
  );
  return (
    bond && { teacher: knowers.find((k) => k.id === bond['master'])!, line: bond['line'] as number }
  );
}

/** The line a knower came to know a way on. */
const knownLine = (ctx: SystemContext, person: number, method: string): number =>
  (knowsOf(ctx.world).find((k) => k['person'] === person && k['method'] === method)?.[
    'line'
  ] as number) ?? 0;

/** An hour at work at `job` with a knower about: hours toward learning each of its ways. */
function learnHour(ctx: SystemContext, p: EntityRow, job: string): void {
  const { world, content } = ctx;
  const s = content.methods.spread;
  for (const m of content.methods.methods.filter((w) => w.job === job)) {
    if (knows(world, p.id, m.id)) continue;
    const knowers = knowersOf(world, m.id).filter((k) => k.id !== p.id);
    const bond = masterOf(ctx, p, m, knowers);
    const beside = knowers.find((k) => workedToday(ctx, k.id, job));
    if (!bond && !beside) continue;
    let row = tableOf(world, 'learn').find((r) => r['person'] === p.id && r['method'] === m.id);
    if (!row) {
      addEntity(world, 'learn', { person: p.id, method: m.id, hours: 0 });
      row = tableOf(world, 'learn').at(-1)!;
    }
    row['hours'] = (row['hours'] as number) + 1;
    const teacher = bond?.teacher ?? beside!;
    if ((row['hours'] as number) >= (bond ? s.apprentice : s.beside))
      learnWay(ctx, p, m, teacher, bond ? 'apprentice' : 'beside', [
        workLine(ctx, p.id, job),
        bond?.line ?? knownLine(ctx, teacher.id, m.id),
      ]);
  }
}

/** The hour's learning at work. */
export function spreadHour(ctx: SystemContext): void {
  const trades = tradesOf(ctx.content);
  for (const p of alive(ctx.world))
    if (p['doing'] === 'work' && trades.has(p['job'] as string))
      learnHour(ctx, p, p['job'] as string);
}

/** A book read (`methods.book.event`, actors reader and the book's master): the reader learns
 * every way of the book's skill its master knows. */
export function bookLearn(ctx: SystemContext, e: SimEvent): void {
  const { world, content } = ctx;
  const [reader, master] = e.actors.map((id) => entityOf(world, 'person', id));
  if (!reader || !master || reader['status'] !== 'alive') return;
  for (const m of content.methods.methods) {
    const word = content.abilities.find((a) => a.id === m.skill)?.name.toLowerCase();
    if (!word || e.data['skill'] !== word || knows(world, reader.id, m.id)) continue;
    if (knows(world, master.id, m.id))
      learnWay(ctx, reader, m, master, 'book', [e.id], { book: e.data['book'] });
  }
}

const GONE = new Set(['health.died', 'defy.left']);

/** The line that took `person`: their death or leaving, newest first. */
function goneLine(log: readonly SimEvent[], person: number): number {
  for (let k = log.length - 1; k >= 0; k -= 1)
    if (GONE.has(log[k]!.type) && log[k]!.actors[0] === person) return log[k]!.id;
  return 0;
}

/** Whether a book on the shelf was written by a knower of the way, in its skill (V-141: a book
 * keeps a master's ways). */
const inBook = (ctx: SystemContext, m: MethodDef): boolean =>
  tableOf(ctx.world, 'book').some(
    (b) =>
      b['state'] === 'kept' &&
      b['skill'] === m.skill &&
      knows(ctx.world, b['master'] as number, m.id),
  );

/** The hour's look at who knows each way: one nobody living knows, and no kept book holds, is
 * lost (state `k.<way>` holds the last living knower while one lives). */
export function lossHour(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  for (const m of content.methods.methods) {
    const key = `k.${m.id}`;
    const [living] = knowersOf(world, m.id);
    if (living) state[key] = living.id;
    if (living || inBook(ctx, m)) continue;
    const last = state[key] && entityOf(world, 'person', state[key]);
    delete state[key];
    if (!last) continue;
    const gone = goneLine(world.log, last.id) || knownLine(ctx, last.id, m.id);
    ctx.emit('discover.lost', {
      causes: [gone].filter((l) => l > 0),
      actors: [last.id],
      data: { method: m.name, name: last['name'] as string },
    });
  }
}

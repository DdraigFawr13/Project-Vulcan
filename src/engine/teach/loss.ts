// What a master takes with them (6B Bundle 6, P6.13, V-141, V-189): each hour the system notes
// the living at teach.json `master` or more in each skill; when one of them dies or leaves and
// nobody living is within `near` levels of them in it, the ledger says what went with them
// (`teach.lost`, citing the death or leaving line), and a tale spreads it. A book of their skill
// on the schoolroom shelf near their level keeps it. With nobody near them
// left, nobody can be taught past their gift in that skill until a new master grows or comes.
import { pronouns, type EntityRow, type SimEvent } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { keptBooks, skillWord } from './tables.ts';

const KEY = /^m(\d+)\.(.+)$/;
const GONE = new Set(['health.died', 'defy.left']);

/** The line that took `person`: their death or leaving, newest first. */
function goneLine(log: readonly SimEvent[], person: number): SimEvent | undefined {
  for (let k = log.length - 1; k >= 0; k -= 1)
    if (GONE.has(log[k]!.type) && log[k]!.actors[0] === person) return log[k];
  return undefined;
}

/** Whether someone living, or a book on the schoolroom shelf (books.ts), still comes within
 * `near` levels of `level` in `skill`. */
function kept(ctx: SystemContext, skill: string, level: number): boolean {
  const living = new Set(alive(ctx.world).map((p) => p.id));
  const near = ctx.content.teach.near;
  if (
    keptBooks(ctx.world).some((b) => b['skill'] === skill && (b['level'] as number) + near >= level)
  )
    return true;
  return (ctx.world.entities['skill'] ?? []).some(
    (s: EntityRow) =>
      s['skill'] === skill &&
      living.has(s['person'] as number) &&
      (s['level'] as number) + ctx.content.teach.near >= level,
  );
}

/** The hour's look at the masters: a loss for each one gone, then the living noted again. */
export function lossHour(ctx: SystemContext): void {
  const { world, content, state } = ctx;
  const people = world.entities['person'] ?? [];
  for (const key of Object.keys(state)) {
    const m = KEY.exec(key);
    if (!m) continue;
    const id = Number(m[1]);
    const p = people.find((x) => x.id === id);
    if (p?.['status'] === 'alive') continue;
    const level = state[key]!;
    delete state[key];
    if (!p || kept(ctx, m[2]!, level)) continue;
    const gone = goneLine(world.log, id);
    ctx.emit('teach.lost', {
      causes: gone ? [gone.id] : [],
      actors: [id],
      data: {
        ...{ name: p['name'] as string, skill: skillWord(content, m[2]!), level },
        ...pronouns(p),
        how: gone?.type === 'defy.left' ? content.teach.words.left : content.teach.words.died,
      },
    });
  }
  const living = new Set(alive(world).map((p) => p.id));
  for (const s of world.entities['skill'] ?? [])
    if (living.has(s['person'] as number) && (s['level'] as number) >= content.teach.master)
      state[`m${s['person'] as number}.${s['skill'] as string}`] = s['level'] as number;
}

// Dreams (6C Slice 3, V-225). An ambition unfulfilled `dreams.days` days asks the colony to back
// it: goods for a house of their own, or by the dream's skill (`dreams.skills`), open
// `dreams.answer` days. Taken up, the dreamer and their trade-mates set it aside at its priority
// (crafts askmade.ts `willWork`); once all is set apart the dream is backed (`dreams.backed`) and
// the goods are laid out again for the dreamer's work. Let pass or unanswered, the dreamer gains
// `dreams.unbacked`. A dream fulfilled first closes its ask with no line.
import { pronouns, TICKS_PER_DAY, type EntityRow } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { asksOf, liveAsks } from '../goods/index.ts';
import { addMemory } from '../needs/index.ts';
import { ambitionText } from '../self/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addAsk, giveBack, settleAsk, wantsOf } from './asks.ts';

/** The ambition a dream ask is for (its `of`: "dream:<row id>"). */
export const dreamOf = (ctx: SystemContext, a: EntityRow): EntityRow | undefined =>
  (ctx.world.entities['ambition'] ?? []).find((r) => `dream:${r.id}` === a['of']);

/** Each hour: a dream long unfulfilled asks to be backed. */
function dreamsAsk(ctx: SystemContext): void {
  const { world, content } = ctx;
  const d = content.asks.dreams;
  const asked = new Set(asksOf(world).map((a) => a['of'] as string));
  for (const row of world.entities['ambition'] ?? []) {
    if (row['done'] || asked.has(`dream:${row.id}`)) continue;
    if (world.tick - (row['since'] as number) < d.days * TICKS_PER_DAY) continue;
    const p = alive(world).find((q) => q.id === row['person']);
    const def = content.self.ambitions.find((x) => x.id === row['ambition']);
    const want = def?.kind === 'house' ? d.house : d.skills[row['skill'] as string];
    if (!p || !want) continue;
    const name = p['name'] as string;
    const wants = wantsOf(ctx, { ...want, what: want.what.replace('{name}', name) });
    const their = pronouns(p).their;
    const line = ctx.emit('dream.asked', {
      causes: [row['line'] as number],
      actors: [p.id],
      data: { name, their, text: ambitionText(content, row, their), what: wants.what },
    });
    const due = world.tick + d.answer * TICKS_PER_DAY;
    addAsk(ctx, {
      ...wants,
      source: 'dream',
      asker: name,
      cite: row['line'] as number,
      line,
      due,
      of: `dream:${row.id}`,
    });
  }
}

/** Settles dream ask `a` citing `cause`, with the dreamer's memory; what was set apart is laid
 * out again for the dreamer's work. */
function settleDream(ctx: SystemContext, a: EntityRow, row: EntityRow, cause: number): void {
  const d = ctx.content.asks.dreams;
  const held = a['held'] as string;
  const { how, line } = settleAsk(ctx, a, [cause], { who: 'The colony' });
  a['held'] = held;
  giveBack(ctx, a, line);
  const memory = how === 'done' ? d.backed : how === 'passed' ? d.unbacked : '';
  if (memory) addMemory(ctx, row['person'] as number, memory, line);
}

/** Each hour: dreams ask, and dream asks are settled as they are answered. */
export function dreamsHour(ctx: SystemContext): void {
  dreamsAsk(ctx);
  for (const a of liveAsks(ctx.world)) {
    if (a['source'] !== 'dream') continue;
    const row = dreamOf(ctx, a);
    if (!row || row['done']) {
      // Fulfilled (or gone) first: what was set apart goes back, quietly.
      giveBack(ctx, a, a['line'] as number);
      Object.assign(a, { state: 'done', settled: a['line'], going: [] });
    } else if (a['state'] === 'taken') {
      if ((a['got'] as number) >= (a['count'] as number))
        settleDream(ctx, a, row, a['line'] as number);
    } else if (a['state'] === 'passed') settleDream(ctx, a, row, a['answer'] as number);
    else if (ctx.world.tick >= (a['due'] as number)) settleDream(ctx, a, row, a['line'] as number);
  }
}

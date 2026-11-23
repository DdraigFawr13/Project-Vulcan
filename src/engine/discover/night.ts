// Luck and dreams (6C Slice 5, V-218), each midnight. Luck: a puzzler who worked `luck.hours` or
// more at their puzzle's trade that day stumbles on something at 1 in `luck.days` (1 in
// `luck.lucky` for someone whose byname is in `luck.bynames`). A dream gives the last hint: 1 in
// `dream.nights` once `dream.days` have passed without a hint while only the last is missing.
import { TICKS_PER_DAY, today } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { bynameOf } from '../tales/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addHint, wayOf } from './find.ts';
import { hintsOf, puzzleOf, tradeRow } from './tables.ts';

/** Hours `person` worked at `job` on game day `day`, if the ring still holds it. */
function hoursOn(ctx: SystemContext, person: number, job: string, day: number): number {
  const row = tradeRow(ctx.world, person, job);
  const n = ctx.content.methods.start.days;
  if (!row || (row['day'] as number) < day || (row['day'] as number) - day >= n) return 0;
  return (row['hours'] as number[])[day % n] ?? 0;
}

/** The night's luck and dreams, for the day just ended. */
export function nightHour(ctx: SystemContext): void {
  const { world, content } = ctx;
  const { luck, dream } = content.methods;
  const day = today(world) - 1;
  for (const p of alive(world)) {
    const q = puzzleOf(world, p.id);
    if (!q) continue;
    const m = wayOf(ctx, q);
    const lucky = luck.bynames.includes((bynameOf(world, p.id)?.['word'] as string) ?? '');
    if (
      hoursOn(ctx, p.id, m.job, day) >= luck.hours &&
      ctx.rng().int(lucky ? luck.lucky : luck.days) === 0
    ) {
      addHint(ctx, q, 'luck', [p['took'] as number]);
      continue;
    }
    const hints = hintsOf(world, q.id);
    if (hints.length !== m.hints - 1) continue;
    if (world.tick - (q['last'] as number) < dream.days * TICKS_PER_DAY) continue;
    if (ctx.rng().int(dream.nights) === 0)
      addHint(ctx, q, 'dream', [hints.at(-1)!['line'] as number]);
  }
}

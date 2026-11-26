// The elder's petition (6C Slice 7 part 2, V-236, V-240): in a lean year (the store under
// `tithe.lean.days` days' eating) the elder asks for a lower tithe before it is taken, at the
// reeve's visit or the lord's, at most once in `petition.every` years. A cautious, pious or learned
// lord forgives the lean year's tithe whole; a bold or greedy one halves it once his favour is at
// `half.favour`; the rest refuse, and a refused plea costs favour. Everyone remembers the answer.
// The elder pleads of their own accord: no lever asks it (V-041).
import { clockAt, type EntityRow } from '../core/index.ts';
import { alive } from '../entity/index.ts';
import { elderOf } from '../colony/index.ts';
import { foodDays } from '../goods/index.ts';
import { addMemories } from '../needs/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { addFavour, favourOf } from './favour.ts';
import { lordName, lordRow, pronounsOf } from './tables.ts';

/** What a plea won: the tithe forgiven whole, halved, or nothing. */
export type Eased = 'whole' | 'half' | undefined;

/** The lord's answer by temper and favour. */
function answerOf(ctx: SystemContext, temper: string): Eased {
  const p = ctx.content.lord.visit.petition;
  if (p.whole.includes(temper)) return 'whole';
  if (p.half.tempers.includes(temper) && favourOf(ctx) >= p.half.favour) return 'half';
  return undefined;
}

/** Before the tithe is taken at a visit (`r`, citing `cause`): the elder may plead. */
export function plead(ctx: SystemContext, r: EntityRow, cause: number): Eased {
  const { world, content } = ctx;
  const lord = lordRow(world)!;
  const p = content.lord.visit.petition;
  const living = alive(world);
  const elder = living.find((q) => q.id === elderOf(world));
  const { days } = foodDays(world, content, living.length);
  const year = clockAt(world.tick, content.calendar).year;
  const last = (lord['plea'] as number) || 0;
  if (!elder || days >= content.lord.tithe.lean.days || (last && year - last < p.every))
    return undefined;
  lord['plea'] = year;
  const eased = answerOf(ctx, lord['temper'] as string);
  const line = ctx.emit('lord.plea', {
    causes: [cause],
    actors: [elder.id],
    data: {
      ...{ name: elder['name'] as string, lord: lordName(lord), days: String(days) },
      through: r['lord'] ? '' : `, through ${lord['reeve'] as string}`,
      answer: p.answers[eased ?? 'no'],
      He: pronounsOf(lord).He,
      eased: eased ?? 'no',
    },
  });
  if (!eased) addFavour(ctx, 'plea', [line]);
  const memory = eased ? p.memories.heard : p.memories.refused;
  addMemories(
    ctx,
    living.map((q) => q.id),
    memory,
    line,
    elder.id,
  );
  return eased;
}

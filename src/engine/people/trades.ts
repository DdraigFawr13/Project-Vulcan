// The loom's trades (Phase 5B Bundle 5, P5.5): changing clothes, weaving and tailoring, kept out
// of jobs.ts, which takes them up and runs them through these two.
import type { EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { changing } from './change.ts';
import { tailoring, takeUpTailoring } from './tailor.ts';
import { takeUpWeaving, weaving } from './weave.ts';

export const TRADE_TAKE_UP: Readonly<
  Record<string, (ctx: SystemContext, p: EntityRow) => boolean>
> = { weave: takeUpWeaving, tailor: takeUpTailoring };

/** One minute of the work in hand, if it is one of these; false when it is done or none. */
export function tradeWork(ctx: SystemContext, p: EntityRow): boolean {
  const job = p['job'];
  if (job === 'change') return changing(ctx, p);
  if (job === 'weave') return weaving(ctx, p);
  if (job === 'tailor') return tailoring(ctx, p);
  return false;
}

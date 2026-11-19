// The loom's trades (Phase 5B Bundle 5, P5.5): changing clothes, weaving, tanning and tailoring,
// as their rows of the job table (jobtable.ts). Changing clothes is taken up before the Work
// sheet's kinds (jobs.ts), so it has no `takeUp` here.
import { changing } from './change.ts';

export { takeUpChange } from './change.ts';
import { tailoring, takeUpTailoring } from './tailor.ts';
import { takeUpTanning, tanning } from './tan.ts';
import { takeUpWeaving, weaving } from './weave.ts';

export const TRADE_JOBS = {
  change: { work: changing },
  weave: { takeUp: takeUpWeaving, work: weaving, holds: true },
  tan: { takeUp: takeUpTanning, work: tanning, holds: true },
  tailor: { takeUp: takeUpTailoring, work: tailoring, holds: true },
} as const;

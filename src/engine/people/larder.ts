// The Larder rows of the Work sheet (5B Bundle 3): curing and coopering, as jobs.ts dispatches them.
import type { EntityRow } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { coopering, takeUpCoopering } from './cooper.ts';
import { curing, takeUpCuring } from './cure.ts';

/** How each Larder row is taken up. */
export const LARDER_TAKE_UP = { cure: takeUpCuring, cooper: takeUpCoopering };

/** One work-hours minute of curing or coopering for someone at it; false for anyone else. */
export const larderWork = (ctx: SystemContext, p: EntityRow): boolean =>
  p['job'] === 'cure' ? curing(ctx, p) : p['job'] === 'cooper' && coopering(ctx, p);

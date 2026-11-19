// The Larder rows of the Work sheet (5B Bundle 3): curing, coopering and pottery, as their rows of
// the job table (jobtable.ts). Each keeps what it fetched overnight.
import { coopering, takeUpCoopering } from './cooper.ts';
import { curing, takeUpCuring } from './cure.ts';
import { potting, takeUpPottery } from './potter.ts';

export const LARDER_JOBS = {
  cure: { takeUp: takeUpCuring, work: curing, holds: true },
  cooper: { takeUp: takeUpCoopering, work: coopering, holds: true },
  potter: { takeUp: takeUpPottery, work: potting, holds: true },
} as const;

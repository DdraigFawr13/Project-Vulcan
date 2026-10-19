// The Work sheet's trade headings (V-071): which rows sit on top, which fold under a heading, and
// what a heading's stepper shows. The headings are content (`work.json` `priority.headings`);
// this only sorts the rows the worker sent, it decides no rule (GAME-02).
import { content } from '../content/index.ts';
import type { WalkerView } from '../worker/index.ts';

type Job = WalkerView['work'][number];

/** Work that has nowhere to be done until a shaft exists or is planned: its row waits for one. */
const NEEDS_SHAFT: ReadonlySet<string> = new Set(['mine']);

/** The rows to show: all of them, less the ones that wait for a shaft while there is none. */
export function visibleJobs(jobs: readonly Job[], shaft: boolean): Job[] {
  return jobs.filter((j) => shaft || !NEEDS_SHAFT.has(j.job));
}

export interface Group {
  name: string;
  /** In the heading's order in content. */
  jobs: Job[];
}

/** Rows under no heading (haul, build, tend), which stay plain on top, and each heading with the
 * rows it folds; a heading none of whose rows are shown is left out. */
export function grouped(
  jobs: readonly Job[],
  headings: typeof content.work.priority.headings = content.work.priority.headings,
): { plain: Job[]; groups: Group[] } {
  const under = new Set(headings.flatMap((h) => h.jobs));
  const groups = headings.map((h) => ({
    name: h.name,
    jobs: h.jobs.flatMap((id) => jobs.filter((j) => j.job === id)),
  }));
  return {
    plain: jobs.filter((j) => !under.has(j.job)),
    groups: groups.filter((g) => g.jobs.length),
  };
}

/** The value a heading's stepper shows: the rows' common level, or the lowest (nearest first)
 * if they differ. */
export const commonLevel = (levels: readonly number[]): number => Math.min(...levels);

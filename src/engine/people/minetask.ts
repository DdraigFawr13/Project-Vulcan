// What a miner is doing (P4.1): the task, who else is on which tile, starting and stopping it.
import type { EngineContent, EntityRow } from '../core/index.ts';
import { loadOf } from '../goods/index.ts';
import type { SystemContext } from '../sim/index.ts';
import { practise } from './learn.ts';
import { people, skillOf, spotOf } from './spots.ts';

export type Kind = 'sink' | 'tunnel' | 'mine' | 'clay';

/** What to do next: `plan` the shaft (or the wall plan, for clay), `target` the tile (a packed
 * node), `what` the metal (or the part, for clay). */
export interface Task {
  kind: Kind;
  what: string;
  plan: number;
  target: number;
  /** Minutes at skill level 0 scaled by the skill. */
  minutes: number;
  /** The lines the taking up cites, and the words for its line. */
  causes: number[];
  word: string;
  good: string;
  have: number;
  want: number;
}

/** Targets (packed nodes) others are working on the tile-digging tasks. */
export const takenBy = (ctx: SystemContext, p: EntityRow): Set<number> =>
  new Set(
    people(ctx.world)
      .filter((q) => q.id !== p.id && q['job'] === 'mine' && q['task'] !== 'sink')
      .map((q) => q['target'] as number),
  );

export const nameOf = (content: EngineContent, id: string): string =>
  content.items.find((i) => i.id === id)?.name ?? id;

/** Sets them on the task (they are not yet on their way): minutes scaled by the mining skill. */
export function start(ctx: SystemContext, p: EntityRow, t: Task): void {
  const { world, content } = ctx;
  const mine = content.work.mine;
  const skill = content.jobs.find((j) => j.id === mine.job)?.skill ?? '';
  const level = skillOf(world, p, skill);
  p['job'] = 'mine';
  p['task'] = t.kind;
  p['what'] = t.what;
  p['plan'] = t.plan;
  p['target'] = t.target;
  p['work'] = Math.ceil((t.minutes * 2 * mine.skilled) / (mine.skilled + level));
}

/** Ends the task; they look for work again. A load they hold (a ladder's logs) is laid down where
 * they stand, not kept. */
export function stop(ctx: SystemContext, p: EntityRow): false {
  const load = loadOf(ctx.world, p.id);
  if (load) Object.assign(load, { ...spotOf(p), holder: 0 });
  p['job'] = '';
  p['task'] = '';
  p['target'] = -1;
  return false;
}

/** One minute of practice at the mining skill. */
export function practiseMining(ctx: SystemContext, p: EntityRow): void {
  const { content } = ctx;
  practise(
    ctx,
    p,
    content.jobs.find((j) => j.id === content.work.mine.job)?.skill ?? '',
    p['took'] as number,
  );
}

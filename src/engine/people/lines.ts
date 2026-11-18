// The needs-ladder lines (Phobos spec vulcan-bench, S1): the need value under which a rung of the
// mind fires. Today each is its need's `seek` in life.json, the same for everyone, except warmth,
// which traits and memories move (needs `warmLineOf`). A line hook set on the sim
// (`setLineHook`) may supply them from outside; with none, every line is today's. Warning lines
// (`low`) never move and are read where they are used.
import type { EntityRow } from '../core/index.ts';
import { warmLineOf } from '../needs/index.ts';
import type { Sim, SystemContext } from '../sim/index.ts';

export type LineNeed = 'food' | 'water' | 'rest' | 'recreation' | 'warmth';

/** Gives `p`'s line for `need`, told today's line. */
export type LineHook = (ctx: SystemContext, p: EntityRow, need: LineNeed, today: number) => number;

/** Today's line: the need's `seek`, or for warmth the person's own line (`warmLineOf`). */
export function todayLine(ctx: SystemContext, p: EntityRow, need: LineNeed): number {
  if (need === 'warmth') return warmLineOf(ctx.world, ctx.content, p.id);
  return ctx.content.life.needs.find((n) => n.id === need)?.seek ?? 0;
}

/** `p`'s line for `need`: the hook's, when the sim has one, else today's. */
export function lineOf(ctx: SystemContext, p: EntityRow, need: LineNeed): number {
  const today = todayLine(ctx, p, need);
  return ctx.hooks.line ? ctx.hooks.line(ctx, p, need, today) : today;
}

/** Sets or clears the sim's line hook; it applies from the next lookup. */
export function setLineHook(sim: Sim, hook: LineHook | undefined): void {
  if (hook) sim.hooks.line = hook;
  else delete sim.hooks.line;
}

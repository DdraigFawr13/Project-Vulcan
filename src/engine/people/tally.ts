// Yesterday's tally (P2.9): per game day, logs felled, items carried into the store, berries
// picked and food eaten. System state in numbers, no ledger lines; at midnight today's numbers
// become `yesterday` (with that day's index) and today starts again. The dawn page reads it.
import { clockAt, TICKS_PER_DAY, type EngineContent, type WorldState } from '../core/index.ts';
import type { SystemContext } from '../sim/index.ts';

const KINDS = ['felled', 'hauled', 'picked', 'eaten'] as const;
export type TallyKind = (typeof KINDS)[number];

export interface Tally {
  felled: number;
  hauled: number;
  picked: number;
  eaten: number;
}

/** What the tally holds from the start of a world: today (day 0) and no yesterday. */
export const TALLY_START: Readonly<Record<string, number>> = {
  tallyDay: 0,
  yesterdayOn: 0,
  ...Object.fromEntries(KINDS.flatMap((k) => [[`t_${k}`, 0] as const, [`y_${k}`, 0] as const])),
};

/** Adds `n` to today's count of `kind`. */
export function tallyAdd(ctx: SystemContext, kind: TallyKind, n: number): void {
  ctx.state[`t_${kind}`] = (ctx.state[`t_${kind}`] ?? 0) + n;
}

/** At midnight, today's numbers move to yesterday and today's reset. */
export function rollTally(ctx: SystemContext): void {
  const day = Math.floor(ctx.world.tick / TICKS_PER_DAY);
  const s = ctx.state;
  if ((s['tallyDay'] ?? 0) === day) return;
  s['yesterdayOn'] = (s['tallyDay'] ?? 0) + 1;
  for (const k of KINDS) {
    s[`y_${k}`] = s[`t_${k}`] ?? 0;
    s[`t_${k}`] = 0;
  }
  s['tallyDay'] = day;
}

/** Yesterday's numbers with that day's date, or undefined on the first day. */
export function yesterdayOf(
  world: WorldState,
  content: EngineContent,
): (Tally & { day: number; month: string }) | undefined {
  const s = world.systems['people'];
  const on = s?.['yesterdayOn'];
  if (!s || !on) return undefined;
  const clock = clockAt((on - 1) * TICKS_PER_DAY, content.calendar);
  return {
    day: clock.day,
    month: content.calendar.monthNames[clock.month] ?? '',
    felled: s['y_felled'] ?? 0,
    hauled: s['y_hauled'] ?? 0,
    picked: s['y_picked'] ?? 0,
    eaten: s['y_eaten'] ?? 0,
  };
}

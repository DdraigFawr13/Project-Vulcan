// The tick loop's decisions (V-191; 6T fix A): one tick and what it asks of the clock, a run at a
// speed or a jump, and how a jump ended. No timers and no messages, so a test runs the worker's
// own loop: `worker.ts` passes in the time limit and what to do with each tick's lines.
import { step, type Sim, type SimEvent, type WorldState } from '../engine/index.ts';
import { react, skipEnds, stopSkip, type Pace } from './pace.ts';
import type { JumpSpan, RecapSettings, StopAct, StopSettings } from './protocol-time.ts';
import { recapCount, recapPauses } from './recaps.ts';
import { stopOf } from './stops.ts';

/** How a jump ended, until the next snapshot tells the page: it landed, it stopped early on a
 * Pause line (`line`), or the player stopped it (neither). */
export interface JumpEnd {
  span: JumpSpan;
  /** The tick the jump set out from, so the page can name where it was going. */
  from: number;
  landed: boolean;
  line?: SimEvent;
}

export interface Clock {
  pace: Pace;
  stops: StopSettings;
  recaps: RecapSettings;
  ended?: JumpEnd;
}

/** One tick: its lines, and what the strongest notable one asks of the clock with the line that
 * asked it. At a running speed a recap switched on pauses play, so the page can open it; a jump
 * runs on and the page shows the recap when the jump lands. */
export function tickOnce(
  w: WorldState,
  sim: Sim,
  clock: Clock,
): { lines: SimEvent[]; act?: StopAct; line?: SimEvent } {
  const before = recapCount(w);
  const lines = step(w, sim, 1);
  const stop = stopOf(lines, sim.notable, clock.stops);
  if (!clock.pace.skip && recapPauses(w, before, clock.recaps)) return { lines, act: 'pause' };
  return { lines, ...(stop && { act: stop.act, line: stop.line }) };
}

/** Runs up to `ticks` ticks at the clock's speed, or a jump tick by tick, while `more()` (the
 * wake's time limit) allows. `each` gets every tick's lines. A jump that ends is kept in
 * `clock.ended`: landed at its last tick (or, for Next event, on its line), or stopped early. */
export function runTicks(
  w: WorldState,
  sim: Sim,
  clock: Clock,
  ticks: number,
  more: () => boolean,
  each: (lines: SimEvent[]) => void,
): void {
  const { pace } = clock;
  if (pace.skip) {
    // Tick by tick, exactly as at any speed, so a jump writes the ledger a 3x run would.
    while (pace.skip && more()) {
      const { lines, act, line } = tickOnce(w, sim, clock);
      each(lines);
      if (!skipEnds(pace, w.tick, act)) continue;
      const early = pace.until !== undefined && w.tick < pace.until;
      clock.ended = {
        span: pace.span ?? 'next',
        from: pace.from ?? w.tick,
        landed: !early,
        ...(early && line && { line }),
      };
      stopSkip(pace);
    }
    return;
  }
  for (let i = 0; i < ticks && more(); i += 1) {
    const { lines, act } = tickOnce(w, sim, clock);
    each(lines);
    if (react(pace, act)) break;
  }
}

/** The player changed speed (Stop included) while a jump ran: it ends where it is, not landed. */
export function cutJump(clock: Clock, tick: number): void {
  const { pace } = clock;
  if (pace.skip)
    clock.ended = { span: pace.span ?? 'next', from: pace.from ?? tick, landed: false };
}

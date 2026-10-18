// Tick timing (P2.0): how long each tick and each system takes, in the worker's own time. The
// engine reads no clock, so the worker wraps each system's run before building the simulation.
import type { System } from '../engine/index.ts';
import type { TimingView } from './protocol.ts';

/** How many of the latest ticks the figures cover. */
export const TIMED_TICKS = 1000;

export interface Timing {
  /** The latest ticks' times (ms), a ring. */
  ticks: Float64Array;
  /** How many ticks have been timed in all. */
  count: number;
  /** Each system's time (ms) since the window last turned over, by its index in the list. */
  systems: Float64Array;
  /** The figures as last worked out, refreshed once a window. */
  view: TimingView;
}

export const createTiming = (systems: number): Timing => ({
  ticks: new Float64Array(TIMED_TICKS),
  count: 0,
  systems: new Float64Array(systems),
  view: { mean: 0, p95: 0, slowest: '', slowestMs: 0 },
});

/** The systems with each `run` timed into `timing`, in the same order, otherwise unchanged. */
export const timedSystems = (
  systems: readonly System[],
  timing: Timing,
  now: () => number,
): System[] =>
  systems.map((system, i) => {
    const run = system.run;
    if (!run) return system;
    return {
      ...system,
      run(ctx) {
        const start = now();
        run(ctx);
        timing.systems[i]! += now() - start;
      },
    };
  });

/** Records one whole tick's time; each full window, works the figures out afresh. */
export function recordTick(timing: Timing, ms: number, names: readonly string[]): void {
  timing.ticks[timing.count % TIMED_TICKS] = ms;
  timing.count += 1;
  if (timing.count % TIMED_TICKS !== 0) return;
  const sorted = timing.ticks.slice().sort();
  let total = 0;
  for (const t of sorted) total += t;
  let slowest = 0;
  for (let i = 1; i < timing.systems.length; i += 1)
    if (timing.systems[i]! > timing.systems[slowest]!) slowest = i;
  timing.view = {
    mean: total / TIMED_TICKS,
    p95: sorted[Math.floor(TIMED_TICKS * 0.95)]!,
    slowest: names[slowest] ?? '',
    slowestMs: timing.systems[slowest]! / TIMED_TICKS,
  };
  timing.systems.fill(0);
}

// The progress bar's fill, apart from Phaser so it can be tested (P3.6): where a bar's fill should
// be between snapshots. The worker sends minutes done with each snapshot; the fill runs on at the
// sim speed from there (paused it holds), easing towards that, a little ahead of the latest at
// most, and never backwards unless the job's total changes (a new job or a reset).
import type { GoodsView } from '../worker/index.ts';

/** How fast the fill closes on where it should be (per second). */
export const EASE = 30;

export interface Bar {
  x: number;
  y: number;
  z: number;
  total: number;
  /** The minutes done in the latest snapshot, and the minutes drawn now. */
  goal: number;
  shown: number;
  /** Seconds the clock has run since the goal last moved (not while paused). */
  since: number;
}

/** The bars for a new snapshot's `work`, carrying over what is drawn for those still going. */
export function reconcile(
  bars: ReadonlyMap<string, Bar>,
  work: GoodsView['work'],
): Map<string, Bar> {
  const next = new Map<string, Bar>();
  for (const w of work) {
    const key = `${w.x},${w.y},${w.z}`;
    const old = bars.get(key);
    const fresh = { x: w.x, y: w.y, z: w.z, total: w.total, goal: w.done, shown: w.done, since: 0 };
    if (!old || old.total !== w.total || w.done < old.goal) next.set(key, fresh);
    else next.set(key, { ...old, goal: w.done, since: w.done > old.goal ? 0 : old.since });
  }
  return next;
}

/** One frame of `dt` seconds with the sim running `rate` minutes a second (0 when paused). */
export function advance(bar: Bar, dt: number, rate: number): void {
  if (rate > 0) bar.since += dt;
  // Where the clock should have got to: the latest minute, plus the part of the next that has
  // gone by at this speed, and no further than a snapshot's lag (a minute, or 50 ms of minutes
  // at the faster speeds), so a stalled job does not run ahead of its snapshots.
  const goal = bar.goal + Math.min(Math.max(1, rate * 0.05), bar.since * rate);
  if (goal > bar.shown) bar.shown += (goal - bar.shown) * (1 - Math.exp(-EASE * dt));
}

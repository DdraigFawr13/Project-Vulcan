// Turns real time into ticks owed. Worker timers are clamped and throttled, so the loop counts
// elapsed time on each wake instead of trusting the timer, and caps the backlog so a stalled tab
// does not try to catch up minutes of play at once.
import { TICKS_PER_SECOND, type Speed } from './protocol.ts';

/** At most this much real time (ms) is caught up after a stall; the rest is dropped. */
export const MAX_CATCH_UP_MS = 250;
/** Skipping ahead (P2.7) runs ticks for this long (ms) on each wake, as fast as the device allows,
 * leaving the rest of the 10 ms wake for messages. */
export const SKIP_MS = 8;

export interface Pace {
  speed: Speed;
  /** Ticks owed but not yet run, times 1000 (scaled, so whole milliseconds add up without drift). */
  owed: number;
  /** Real time of the last wake, in ms. */
  last: number;
  /** Skipping ahead (P2.7): run for `SKIP_MS` each wake instead of at the speed's rate. */
  skip: boolean;
}

export const createPace = (now: number): Pace => ({ speed: 0, owed: 0, last: now, skip: false });

/** Changes speed, ending any skip; returns the ticks still owed at the old speed, which the
 * caller runs first. */
export function setSpeed(pace: Pace, speed: Speed, now: number): number {
  const due = ticksDue(pace, now);
  pace.speed = speed;
  pace.skip = false;
  return due;
}

/** A skip has reached a notable line: it ends paused, owing nothing. */
export function stopSkip(pace: Pace): void {
  pace.skip = false;
  pace.speed = 0;
  pace.owed = 0;
}

/** Whole ticks to run now. Paused owes nothing, and a pause drops any fraction owed. */
export function ticksDue(pace: Pace, now: number): number {
  const elapsed = Math.min(Math.max(now - pace.last, 0), MAX_CATCH_UP_MS);
  pace.last = now;
  if (pace.speed === 0) {
    pace.owed = 0;
    return 0;
  }
  pace.owed += elapsed * TICKS_PER_SECOND[pace.speed];
  const whole = Math.floor(pace.owed / 1000);
  pace.owed -= whole * 1000;
  return whole;
}

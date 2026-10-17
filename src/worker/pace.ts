// Turns real time into ticks owed. Worker timers are clamped and throttled, so the loop counts
// elapsed time on each wake instead of trusting the timer, and caps the backlog so a stalled tab
// does not try to catch up minutes of play at once.
import { TICKS_PER_SECOND, type Speed } from './protocol.ts';

/** At most this much real time (ms) is caught up after a stall; the rest is dropped. */
export const MAX_CATCH_UP_MS = 250;

export interface Pace {
  speed: Speed;
  /** Ticks owed but not yet run, times 1000 (scaled, so whole milliseconds add up without drift). */
  owed: number;
  /** Real time of the last wake, in ms. */
  last: number;
}

export const createPace = (now: number): Pace => ({ speed: 0, owed: 0, last: now });

/** Changes speed; returns the ticks still owed at the old speed, which the caller runs first. */
export function setSpeed(pace: Pace, speed: Speed, now: number): number {
  const due = ticksDue(pace, now);
  pace.speed = speed;
  return due;
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

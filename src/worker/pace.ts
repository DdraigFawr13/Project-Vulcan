// Turns real time into ticks owed. Worker timers are clamped and throttled, so the loop counts
// elapsed time on each wake instead of trusting the timer, and caps the backlog so a stalled tab
// does not try to catch up minutes of play at once. Jumps and what stops play: V-191.
import { TICKS_PER_SECOND, type JumpSpan, type Speed, type StopAct } from './protocol-time.ts';

/** At most this much real time (ms) is caught up after a stall; the rest is dropped. */
export const MAX_CATCH_UP_MS = 250;
/** A jump runs ticks for this long (ms) on each wake, as fast as the device allows, leaving the
 * rest of the 10 ms wake for messages. */
export const SKIP_MS = 8;

export interface Pace {
  speed: Speed;
  /** Ticks owed but not yet run, times 1000 (scaled, so whole milliseconds add up without drift). */
  owed: number;
  /** Real time of the last wake, in ms. */
  last: number;
  /** Jumping ahead: run for `SKIP_MS` each wake instead of at the speed's rate. */
  skip: boolean;
  /** The jump's span; a span other than `next` runs from tick `from` to tick `until`. */
  span?: JumpSpan;
  from?: number;
  until?: number;
}

export const createPace = (now: number): Pace => ({ speed: 0, owed: 0, last: now, skip: false });

/** Jumps from `tick`: to the next Pause or Slow line, or (`until`) to that tick, stopping early
 * only on a Pause line. Every tick runs on the way. */
export function jump(pace: Pace, span: JumpSpan, tick: number, until?: number): void {
  pace.skip = true;
  pace.span = span;
  if (until === undefined) {
    delete pace.from;
    delete pace.until;
  } else [pace.from, pace.until] = [tick, until];
}

/** Whether a jump that has just run up to `tick`, whose lines asked `act`, ends here: Next event on
 * a Pause or Slow line, a span at its last tick or on a Pause line. */
export function skipEnds(pace: Pace, tick: number, act: StopAct | undefined): boolean {
  if (act === 'pause') return true;
  return pace.until === undefined ? act === 'slow' : tick >= pace.until;
}

/** Changes speed, ending any jump; returns the ticks still owed at the old speed, which the
 * caller runs first. */
export function setSpeed(pace: Pace, speed: Speed, now: number): number {
  const due = ticksDue(pace, now);
  pace.speed = speed;
  endJump(pace);
  return due;
}

function endJump(pace: Pace): void {
  pace.skip = false;
  delete pace.span;
  delete pace.from;
  delete pace.until;
}

/** A jump has ended (its last tick, or a line that stops it): paused, owing nothing. */
export function stopSkip(pace: Pace): void {
  endJump(pace);
  pace.speed = 0;
  pace.owed = 0;
}

/** At a running speed, a tick's lines asked `act`: Pause stops the clock, Slow drops it to 1× and
 * leaves it there (V-191). True when the ticks still owed this wake must not run. */
export function react(pace: Pace, act: StopAct | undefined): boolean {
  if (act === 'pause' || (act === 'slow' && pace.speed > 1)) {
    pace.speed = act === 'pause' ? 0 : 1;
    pace.owed = 0;
    return true;
  }
  return false;
}

/** How far a span's jump has come, 0 to 1; undefined for Next event or no jump. */
export function jumpDone(pace: Pace, tick: number): number | undefined {
  const { from, until } = pace;
  if (!pace.skip || from === undefined || until === undefined || until <= from) return undefined;
  return Math.min(1, Math.max(0, (tick - from) / (until - from)));
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

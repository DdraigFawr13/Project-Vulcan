// The speeds a player sees: ticks per real second at each speed, pause, the catch-up cap, jumps
// and what a stop kind does to the clock (V-191).
import { describe, expect, it } from 'vitest';
import type { Speed } from './protocol-time.ts';
import {
  createPace,
  jump,
  jumpDone,
  MAX_CATCH_UP_MS,
  react,
  setSpeed,
  skipEnds,
  stopSkip,
  ticksDue,
} from './pace.ts';

/** Ticks run over `seconds` of real time with a wake every `wake` ms. */
function run(speed: Speed, seconds: number, wake = 7) {
  const pace = createPace(0);
  setSpeed(pace, speed, 0);
  let ticks = 0;
  for (let t = wake; t <= seconds * 1000; t += wake) ticks += ticksDue(pace, t);
  return ticks;
}

describe('pace', () => {
  it('runs 10, 30, 100, 200, 400 and 800 game minutes a second, and none while paused', () => {
    expect([1, 2, 3, 4, 5, 6].map((s) => run(s as Speed, 7))).toEqual([
      70, 210, 700, 1400, 2800, 5600,
    ]);
    expect(run(0, 7)).toBe(0);
  });

  it('catches up at most 250 ms after a stall, and pausing stops the tick at once', () => {
    const pace = createPace(0);
    setSpeed(pace, 3, 0);
    expect(ticksDue(pace, 5000)).toBe((MAX_CATCH_UP_MS * 100) / 1000);
    expect(ticksDue(pace, 5015)).toBe(1);
    expect(setSpeed(pace, 0, 5020)).toBe(1);
    expect(ticksDue(pace, 9000)).toBe(0);
  });

  it('Next event ends paused on a Pause or Slow line, never on a Note', () => {
    const pace = createPace(0);
    jump(pace, 'next', 0);
    expect([skipEnds(pace, 5, undefined), skipEnds(pace, 5, 'note')]).toEqual([false, false]);
    expect([skipEnds(pace, 5, 'slow'), skipEnds(pace, 5, 'pause')]).toEqual([true, true]);
    stopSkip(pace);
    expect(pace).toMatchObject({ skip: false, speed: 0 });
    expect(ticksDue(pace, 100)).toBe(0);
  });

  it('a span runs past Slow and Note lines to its last tick, but stops early on Pause', () => {
    const pace = createPace(0);
    jump(pace, 'month', 100, 140);
    expect(pace.skip).toBe(true);
    expect(jumpDone(pace, 120)).toBe(0.5);
    expect(skipEnds(pace, 139, 'slow')).toBe(false);
    expect(skipEnds(pace, 120, 'pause')).toBe(true);
    expect(skipEnds(pace, 140, undefined)).toBe(true);
    stopSkip(pace);
    expect([pace.skip, pace.speed, pace.until, jumpDone(pace, 140)]).toEqual([
      false,
      0,
      undefined,
      undefined,
    ]);
    jump(pace, 'year', 0, 10);
    setSpeed(pace, 1, 0); // Stop, or any speed, ends a jump at once
    expect([pace.skip, pace.span]).toEqual([false, undefined]);
  });

  it('at a running speed, Pause stops the clock and Slow drops it to 1× and leaves it there', () => {
    const pace = createPace(0);
    setSpeed(pace, 6, 0);
    expect(react(pace, 'note')).toBe(false);
    expect(react(pace, undefined)).toBe(false);
    expect(pace.speed).toBe(6);
    expect(react(pace, 'slow')).toBe(true);
    expect(pace.speed).toBe(1);
    expect(react(pace, 'slow')).toBe(false); // already at 1×: it stays and runs on
    expect(ticksDue(pace, 1000)).toBe(Math.floor((MAX_CATCH_UP_MS * 10) / 1000));
    expect(react(pace, 'pause')).toBe(true);
    expect([pace.speed, ticksDue(pace, 2000)]).toEqual([0, 0]);
  });
});

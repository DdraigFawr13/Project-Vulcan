// The speeds a player sees: ticks per real second at each speed, pause, and the catch-up cap.
import { describe, expect, it } from 'vitest';
import { createPace, MAX_CATCH_UP_MS, setSpeed, ticksDue } from './pace.ts';

/** Ticks run over `seconds` of real time with a wake every `wake` ms. */
function run(speed: 0 | 1 | 2 | 3, seconds: number, wake = 7) {
  const pace = createPace(0);
  setSpeed(pace, speed, 0);
  let ticks = 0;
  for (let t = wake; t <= seconds * 1000; t += wake) ticks += ticksDue(pace, t);
  return ticks;
}

describe('pace', () => {
  it('runs 10, 30 and 100 game minutes a second, and none while paused', () => {
    expect(run(1, 7)).toBe(70);
    expect(run(2, 7)).toBe(210);
    expect(run(3, 7)).toBe(700);
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
});

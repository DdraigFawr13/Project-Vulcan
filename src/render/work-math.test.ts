// The drawn work motions (V-194): the stroke lifts, strikes and rests; strikes are seen once a
// stroke even when a frame jumps the phase past 1; a tool's grip is found from its pixels.
import { describe, expect, it } from 'vitest';
import { BEATS, crossed, gripOf, poseAt, swingAngle } from './work-math.ts';

describe('work motions', () => {
  it('a swing goes from rest to the top of the lift, strikes and comes back', () => {
    const a = BEATS.swing.angles!;
    expect(swingAngle(0, a)).toBe(a.rest);
    expect(swingAngle(0.55, a)).toBe(a.top);
    expect(swingAngle(0.7, a)).toBe(a.hit);
    expect(swingAngle(0.9999, a)).toBeCloseTo(a.rest, 1);
    // The hand rises as the tool goes up, and the body dips a pixel on the strike.
    expect(poseAt('swing', 0.55).tool!.y).toBeLessThan(poseAt('swing', 0).tool!.y);
    expect(poseAt('swing', 0.7).dy).toBe(1);
  });

  it('sees a strike pass once, across the wrap from one stroke to the next', () => {
    expect(crossed(0.6, 0.7, 0.66)).toBe(true);
    expect(crossed(0.7, 0.8, 0.66)).toBe(false);
    expect(crossed(0.95, 0.1, 0.05)).toBe(true);
    expect(crossed(0.95, 0.02, 0.05)).toBe(false);
  });

  it('holds a slanted handle at its lower end, its head up and to the right', () => {
    // A 1 px line from (2, 29) up to (29, 2), a 4 px head at its top.
    const on = (x: number, y: number) =>
      (x + y === 31 && x >= 2 && x <= 29) || (x >= 24 && y <= 6 && x - y >= 20);
    const g = gripOf(on, 32, 32)!;
    expect(g.grip).toEqual({ x: 2.5, y: 30 });
    expect(g.head).toBeLessThan(-30);
    expect(g.head).toBeGreaterThan(-60);
  });
});

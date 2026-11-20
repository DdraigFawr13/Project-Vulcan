// Smooth walking: a walker who steps a tile every two minutes is drawn moving at one even pace,
// never standing between steps, and the screen's clock runs evenly behind the world.
import { describe, expect, it } from 'vitest';
import { LAG, TrailClock, Trails } from './trail.ts';

describe('trails', () => {
  it('draws a steady walk at one even pace, with no stand between steps', () => {
    const trails = new Trails();
    trails.note(1, 0, 0, 0);
    for (let step = 1; step <= 4; step += 1) trails.note(1, 10 + 2 * step, step, 0);
    const xs = [12, 13, 14, 15, 16, 17, 18].map((t) => trails.at(1, t)!);
    expect(xs.map((d) => d.x)).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4]);
    expect(xs.slice(0, -1).every((d) => d.moving && d.dx === 1)).toBe(true);
    expect(trails.at(1, 18)!.moving).toBe(false);
  });

  it('sets off from a stand at a stride, not creeping over the time stood', () => {
    const trails = new Trails();
    trails.note(1, 0, 5, 5);
    trails.note(1, 100, 6, 5);
    expect(trails.at(1, 50)).toMatchObject({ x: 5, moving: false });
    expect(trails.at(1, 98.5)).toMatchObject({ x: 5.5, moving: true });
  });

  it('does not walk out a leap of many tiles', () => {
    const trails = new Trails();
    trails.note(1, 0, 0, 0);
    trails.note(1, 5, 60, 0);
    expect(trails.at(1, 4)).toMatchObject({ x: 60, moving: false });
  });
});

describe('the trail clock', () => {
  it('runs at the game speed, settles LAG minutes behind and catches up when paused', () => {
    const clock = new TrailClock();
    clock.at(0);
    clock.seen(100, 10, false);
    let now = 0;
    for (let ms = 16; ms <= 3000; ms += 16) {
      clock.seen(100 + Math.floor(ms / 100), 10, false);
      now = clock.at(ms);
    }
    expect(Math.abs(clock.latest - now - LAG)).toBeLessThan(1);
    clock.seen(clock.latest, 0, false);
    for (let ms = 3016; ms <= 4000; ms += 16) now = clock.at(ms);
    expect(now).toBe(clock.latest);
  });
});

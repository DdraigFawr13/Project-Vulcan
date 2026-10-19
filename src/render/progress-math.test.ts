// The progress bar's glide (P3.6, Morgan's ask for a smooth bar): between snapshots the fill runs
// on at the sim speed, holds when paused, never goes backwards, and starts over when the total
// changes.
import { describe, expect, it } from 'vitest';
import { TICKS_PER_SECOND } from '../worker/protocol.ts';
import { advance, reconcile, type Bar } from './progress-math.ts';

const FRAME = 1 / 60;
const work = (done: number, total = 60) => [{ x: 3, y: 4, z: 0, done, total }];

/** Plays `seconds` of frames at `speed`, a snapshot with the engine's minutes done on each frame. */
function play(
  speed: 0 | 1 | 2 | 3,
  seconds: number,
  from: ReturnType<typeof reconcile>,
  start = 10,
) {
  let bars = from;
  const shown: number[] = [];
  let minutes = start;
  let owed = 0;
  for (let t = 0; t < seconds; t += FRAME) {
    owed += FRAME * TICKS_PER_SECOND[speed];
    const whole = Math.floor(owed);
    owed -= whole;
    minutes += whole;
    bars = reconcile(bars, work(minutes));
    const bar = [...bars.values()][0]!;
    advance(bar, FRAME, TICKS_PER_SECOND[speed]);
    shown.push(bar.shown);
  }
  return { bars, shown, minutes };
}

describe('progress bar glide', () => {
  for (const speed of [1, 2, 3] as const) {
    it(`runs on smoothly and forwards only at speed ${speed}`, () => {
      const { shown, minutes } = play(speed, 2, reconcile(new Map(), work(10)));
      for (let i = 1; i < shown.length; i += 1) {
        expect(shown[i]!).toBeGreaterThanOrEqual(shown[i - 1]!);
        // No jump: a frame moves the fill by about a frame's minutes at this speed, never a tick's lump.
        expect(shown[i]! - shown[i - 1]!).toBeLessThanOrEqual(
          TICKS_PER_SECOND[speed] * FRAME + 0.35,
        );
      }
      expect(shown.at(-1)!).toBeLessThanOrEqual(
        minutes + Math.max(1, TICKS_PER_SECOND[speed] * 0.05),
      );
      expect(shown.at(-1)!).toBeGreaterThan(minutes - 3);
    });
  }

  it('holds still when paused, and does not hop forward on resuming', () => {
    const run = play(1, 1, reconcile(new Map(), work(10)));
    const bar = [...run.bars.values()][0]!;
    advance(bar, FRAME, 10);
    const before = bar.shown;
    for (let i = 0; i < 600; i += 1) advance(bar, FRAME, 0);
    expect(bar.shown).toBe(before);
    advance(bar, FRAME, 10);
    expect(bar.shown - before).toBeLessThan(0.3);
  });

  it('starts over when the total changes, and only then goes back', () => {
    const run = play(2, 1, reconcile(new Map(), work(10)));
    const bars = reconcile(run.bars, work(2, 90));
    const bar: Bar = [...bars.values()][0]!;
    expect(bar.shown).toBe(2);
    expect(bar.total).toBe(90);
  });
});

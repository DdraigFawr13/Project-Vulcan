import { describe, expect, it } from 'vitest';
import { createWorld, step } from '../../src/engine/index.ts';
import { content, digest, runDays } from './helpers/world.ts';

// The one determinism test (GAME-06): same seed, same world and log, whatever the batch size.
describe('determinism', () => {
  it('gives the same world and events for the same seed, at any speed', () => {
    const ticks = 3 * content.tuning.ticksPerDay;
    const whole = runDays('vulcan', 3);
    const batched = createWorld('vulcan', content);
    const events = [...batched.events];
    // Odd batch sizes stand in for the worker's frames at different speeds.
    for (let done = 0; done < ticks;) {
      const n = Math.min(37, ticks - done);
      events.push(...step(batched.world, content, n));
      done += n;
    }
    expect(digest(batched.world)).toBe(digest(whole.world));
    expect(events).toEqual(whole.events);
    expect(digest(runDays('other', 3).world)).not.toBe(digest(whole.world));
  });
});

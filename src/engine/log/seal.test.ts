// Sealing old days (V-177): a sealed line that a held memory, belief or tale cites keeps its
// words, and so do its causes, so "why?" walks on past the recent days; once nothing holds it,
// it drops to a stub and "why?" ends there again.
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY, type SimEvent, type WorldState } from '../core/index.ts';
import { sealDays } from './seal.ts';
import { whyOf } from './why.ts';

const line = (id: number, day: number, type: string, causes: number[] = []): SimEvent => ({
  ...{ id, tick: day * TICKS_PER_DAY + 60, type, actors: [1], subjects: [], causes },
  data: {},
});

/** A ledger with no world around it: the first line, the hungry day, the answer it led to, a
 * line only a tile cites, and today's theft citing the answer. */
function ledger(): WorldState {
  const log = [
    line(1, 0, 'world.begun'),
    line(2, 1, 'need.low', [1]),
    line(3, 2, 'law.answered', [2]),
    line(4, 2, 'build.done', [1]),
    line(5, 10, 'defy.took', [3]),
  ];
  const world = { seed: 's', tick: 10 * TICKS_PER_DAY, log, stubs: [], segments: [], sealed: [] };
  return { ...world, begunEvent: 1, nextEventId: 6 } as unknown as WorldState;
}

const walk = (world: WorldState) =>
  whyOf(world, 5).map((c) => `${c.event.id}${c.older ? ' older' : ''}`);

describe('sealing old days', () => {
  it('keeps the words of a held line and its causes, so "why?" walks past the week', () => {
    const world = ledger();
    sealDays(world, new Set([4]), 7, new Set([3]));
    expect(world.log.map((e) => e.id)).toEqual([5]);
    expect(world.stubs.map((s) => [s.id, 'causes' in s])).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, false],
    ]);
    expect(walk(world)).toEqual(['3', '2', '1']);
    // The kept answer's own "why?" walks too.
    expect(whyOf(world, 3).map((c) => c.event.id)).toEqual([2, 1]);

    // Nothing holds the answer any more: it drops to a stub, its causes go, the chain ends there.
    world.tick += TICKS_PER_DAY;
    sealDays(world, new Set([4]), 7, new Set());
    expect(world.stubs.map((s) => [s.id, 'causes' in s])).toEqual([
      [1, false],
      [3, false],
      [4, false],
    ]);
    expect(walk(world)).toEqual(['3 older']);
  });

  it('leaves an unheld line as a stub, so its "why?" ends at the older record', () => {
    const world = ledger();
    sealDays(world, new Set([4]), 7);
    expect(world.stubs.every((s) => !('causes' in s))).toBe(true);
    expect(walk(world)).toEqual(['3 older']);
  });
});

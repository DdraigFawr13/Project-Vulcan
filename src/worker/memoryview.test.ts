// Phase 6 Bundle 1 done-when (V-154): after a hungry winter a colonist's Memories tab lists the
// winter first, with its reason; their thought speaks of it once they are fed again.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, step } from '../engine/index.ts';
import { memoriesView, thoughtView } from './memoryview.ts';

const DAY = 1440;

describe('the Memories tab', () => {
  it('after a hungry winter lists the winter first, with its reason', () => {
    // Food that fills no one, from the first day of Deepwinter: a winter of hunger.
    const hungry = {
      ...content,
      life: {
        ...content.life,
        eat: Object.fromEntries(Object.keys(content.life.eat).map((k) => [k, 0])),
      },
    };
    const sim = createSim(hungry);
    const w = createWorld(sim, 'smoke/1');
    w.tick = 9 * content.calendar.daysPerMonth * DAY + 6 * 60;
    step(w, sim, 15 * DAY);
    const p = (w.entities['person'] ?? []).find((q) => q['status'] === 'alive')!;
    const [first] = memoriesView(w, p);
    expect(first).toMatchObject({ text: 'The hungry winter', band: 'Heavy' });
    expect(first!.note).toMatch(
      /^Hungry on 16 days, 1 Deepwinter to 16 Deepwinter\. −8 mood, \d+ days left; stays until 16 Thawmonth\.$/,
    );
    expect(first!.why).toBeGreaterThan(0);
    // Hungry still, the need speaks first; its why? is the hunger line.
    expect(thoughtView(w, p).why).toBe(
      (w.entities['need'] ?? []).find((n) => n['person'] === p.id && n['need'] === 'food')!['line'],
    );
  });
});

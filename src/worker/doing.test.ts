// P6.7: the strip and the sheet say when someone sits in the stocks or is leaving the valley.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld } from '../engine/index.ts';
import { doingOf, nowOf } from './doing.ts';

describe('defiance in what they are doing', () => {
  it('names the stocks, walking there and sitting, and leaving the valley', () => {
    const w = createWorld(createSim(content), 'anvil');
    const p = (w.entities['person'] ?? []).find((q) => q['status'] === 'alive')!;
    Object.assign(p, { doing: 'stocks', path: [1] });
    expect(doingOf(p)).toBe('Going to the stocks');
    expect(nowOf(w, p).text).toMatch(/^Going to the green to sit in the stocks/);
    p['path'] = [];
    expect(doingOf(p)).toBe('In the stocks');
    expect(nowOf(w, p).text).toMatch(/^Sitting in the stocks on the green/);
    p['doing'] = 'leave';
    expect([doingOf(p), nowOf(w, p).text]).toEqual([
      'Leaving the valley',
      'Walking out of the valley for good.',
    ]);
  });
});

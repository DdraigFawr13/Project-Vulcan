import { describe, expect, it } from 'vitest';
import { bodyStem, variantCounts } from './look.ts';

describe('a person’s drawing', () => {
  const counts = variantCounts([
    'person.dwarf.s.0',
    'person.dwarf.v1.s.0',
    'person.dwarf.v2.s.0',
    'person.dwarf.v2.e.1',
    'person.giant.s.0',
  ]);

  it('keeps one whole villager for life when the race has them, with no overlays', () => {
    expect(bodyStem(counts, 'dwarf', 7)).toEqual({ stem: 'person.dwarf.v2', overlays: false });
    expect(bodyStem(counts, 'dwarf', 8)).toEqual({ stem: 'person.dwarf.v1', overlays: false });
    expect(bodyStem(counts, 'dwarf', 7)).toEqual(bodyStem(counts, 'dwarf', 7));
  });

  it('falls back to the race body with tinted overlays when it has none', () => {
    expect(bodyStem(counts, 'giant', 3)).toEqual({ stem: 'person.giant', overlays: true });
  });
});

// Which recap opens as a run or a jump passes a turn, and the speed Carry on resumes at (V-191).
import { describe, expect, it } from 'vitest';
import type { RecapView } from '../worker/index.ts';
import { recapToShow, resumeAt } from './recaps.ts';

const recap = (id: number, kind: RecapView['kind']): RecapView => ({
  id,
  kind,
  kicker: '',
  title: `${kind} ${id}`,
  sections: [],
});
// A year jump passes four season recaps and, with winter's, the year's.
const year = [1, 2, 3, 4].map((id) => recap(id, 'season')).concat(recap(5, 'year'));

describe('recaps on screen', () => {
  it("shows a year jump's year recap only, which replaces winter's", () => {
    expect(recapToShow(year, { season: true, year: true })?.id).toBe(5);
    expect(recapToShow(year, { season: true, year: false })?.id).toBe(4);
    expect(recapToShow(year, { season: false, year: false })).toBeUndefined();
    expect(recapToShow(year.slice(0, 1), { season: false, year: true })).toBeUndefined();
  });

  it('carries on at the speed play ran at, and stays paused after a jump', () => {
    expect(resumeAt({ speed: 3, skipping: false })).toBe(3);
    expect(resumeAt({ speed: 3, skipping: true })).toBe(0); // a jump keeps the speed it left
    expect(resumeAt({ speed: 0, skipping: false })).toBe(0);
  });
});

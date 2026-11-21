// Which recap opens as a run or a jump passes a turn, and the speed Carry on resumes at (V-191).
import { describe, expect, it } from 'vitest';
import type { JumpEndView, LedgerLine, RecapView } from '../worker/index.ts';
import { recapNow, recapToShow, resumeAt, type Held } from './recaps.ts';

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

  // 6T fix A: the smoke seed's year jump from 1 Highsun stopped on 15 Mistmonth and opened the
  // summer recap over the line that stopped it.
  const on = { season: true, year: true };
  const died = { id: 9, text: 'Bran died by the ford. Cold.' } as LedgerLine;
  const stopped: JumpEndView = {
    span: 'year',
    to: '1 Thawmonth, Year 2',
    landed: false,
    line: died,
  };
  const landed: JumpEndView = { span: 'year', to: '1 Thawmonth, Year 2', landed: true };
  const paused = { speed: 0 as const, skipping: false };

  it('holds what a jump passes while it stops early, and opens the year recap once it lands', () => {
    const held: Held = { passed: [recap(1, 'season')], stopped: false };
    expect(recapNow(held, { ...paused, jumpEnd: stopped }, on)).toBeUndefined();
    expect(recapNow(held, paused, on)).toBeUndefined(); // the stop card is up
    expect(recapNow(held, { speed: 0, skipping: true }, on)).toBeUndefined(); // Jump on
    held.passed.push(...year.slice(1));
    expect(recapNow(held, { ...paused, jumpEnd: landed }, on)?.id).toBe(5);
    expect(held).toEqual({ passed: [], stopped: false });
  });

  it('sends what a jump passed to the Chronicle when the player stops it or plays on', () => {
    const cut: Held = { passed: [recap(1, 'season')], stopped: false };
    expect(recapNow(cut, { ...paused, jumpEnd: { ...landed, landed: false } }, on)).toBeUndefined();
    expect(cut.passed).toEqual([]);
    const played: Held = { passed: [recap(1, 'season')], stopped: false };
    recapNow(played, { ...paused, jumpEnd: stopped }, on);
    expect(recapNow(played, { speed: 3, skipping: false }, on)).toBeUndefined();
    expect(played).toEqual({ passed: [], stopped: false });
  });

  it('opens a turn passed at a running speed at once', () => {
    const held: Held = { passed: [recap(1, 'season')], stopped: false };
    expect(recapNow(held, { speed: 0, skipping: false }, on)?.id).toBe(1);
  });
});

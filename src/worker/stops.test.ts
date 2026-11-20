// What stops play and where jumps land (V-191): a notable line's kind and the player's setting
// decide what the clock does; a planted death ends a year jump early, paused.
import { describe, expect, it } from 'vitest';
import { rawContent, validateContent } from '../content/index.ts';
import type { SimEvent } from '../engine/index.ts';
import { createPace, jump, skipEnds, stopSkip } from './pace.ts';
import { actOf, landing, landingWords, stopSettings } from './stops.ts';

const line = (type: string): SimEvent => ({ type, data: {} }) as unknown as SimEvent;
const always = (): boolean => true;
const DAY = 1440;
const MONTH = 28 * DAY;

describe('stops', () => {
  it('a tick asks the strongest act of its notable lines, as the player set each kind', () => {
    const stops = stopSettings();
    expect(actOf([line('need.low')], always, stops)).toBe('note');
    expect(actOf([line('need.low'), line('family.born')], always, stops)).toBe('slow');
    expect(actOf([line('family.born'), line('health.died')], always, stops)).toBe('pause');
    expect(actOf([line('health.died')], () => false, stops)).toBeUndefined();
    const mine = stopSettings({ death: 'note', mood: 'pause', nonsense: 'pause' });
    expect(actOf([line('health.died')], always, mine)).toBe('note');
    expect(actOf([line('need.low')], always, mine)).toBe('pause');
    expect(Object.keys(mine)).not.toContain('nonsense');
  });

  it('a planted death ends a year jump early and leaves the game paused', () => {
    const pace = createPace(0);
    const from = 360;
    jump(pace, 'year', from, landing(from, 'year'));
    const stops = stopSettings();
    expect(skipEnds(pace, from + 1, actOf([line('family.born')], always, stops))).toBe(false);
    expect(skipEnds(pace, from + 2, actOf([line('health.died')], always, stops))).toBe(true);
    stopSkip(pace);
    expect([pace.skip, pace.speed]).toEqual([false, 0]);
  });

  it('a jump lands at 00:00 on the first day of the next month, season or year', () => {
    const tick = 2 * MONTH + 5 * DAY + 600; // Day 6 of Bloommonth, year 1, 10:00
    expect(landing(tick, 'month')).toBe(3 * MONTH);
    expect(landing(tick, 'season')).toBe(3 * MONTH);
    expect(landing(tick, 'year')).toBe(12 * MONTH);
    expect(landing(3 * MONTH, 'season')).toBe(6 * MONTH); // already on the first: the next one
    expect(landingWords(tick, 'month')).toBe('1 Highsun');
    expect(landingWords(tick, 'season')).toBe('1 Highsun, summer');
    expect(landingWords(tick, 'year')).toBe('1 Thawmonth, Year 2');
  });

  it('content validation refuses a notable event without a stop kind, or with an unknown one', () => {
    const events = (rawContent.events as { id: string; stop?: string }[]).map((e) =>
      e.id === 'health.died'
        ? { ...e, stop: undefined }
        : e.id === 'family.born'
          ? { ...e, stop: 'nap' }
          : e,
    );
    const errors = validateContent({ ...rawContent, events });
    expect(errors).toContain('events[health.died]: a notable event needs a stop kind');
    expect(errors).toContain('events[family.born].stop: "nap" is not in stops');
  });
});

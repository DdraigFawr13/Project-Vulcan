// P6.3, V-162: on a winter evening, people at leisure go and sit by a lit fire, unordered, and
// mend what they wear there. A year of winter (every season named winter, every month -12) on
// the fire tests' seed, so the campfire and hearths are built and lit by the sixth day (knapping axes took a day,
// V-195).
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import {
  byAFire,
  createSim,
  createWorld,
  daylightAt,
  step,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  winterEvening,
  withoutAccidents,
} from '../index.ts';
import { wornOf } from '../goods/index.ts';

const content = withoutAccidents(game);
const winter = {
  ...content,
  calendar: { ...content.calendar, seasons: content.calendar.seasons.map(() => 'winter') },
  seasons: { ...content.seasons, months: content.seasons.months.map(() => -12) },
};
const sim = createSim(winter);

describe('winter evenings by the hearth', () => {
  it('gathers the idle by a lit fire after dark and mends their clothes there', () => {
    const w = createWorld(sim, 'ledger');
    step(w, sim, 5 * TICKS_PER_DAY - (w.tick % TICKS_PER_DAY));
    step(w, sim, daylightAt(winter, w.tick).dusk);
    expect(winterEvening(w, winter)).toBe(true);
    const idle = () =>
      (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive' && p['doing'] === 'relax');
    // An hour to walk there.
    step(w, sim, TICKS_PER_HOUR);
    const relaxing = idle();
    expect(relaxing.length).toBeGreaterThan(0);
    const by = relaxing.filter((p) => byAFire(w, winter, p));
    expect(by.length * 2).toBeGreaterThanOrEqual(relaxing.length);
    // Those by the fire with a worn garment who stay the hour mend it (one may get up to tend
    // the fire instead: which one is the seed's accident).
    const worn = by
      .filter((q) => wornOf(w, q.id).length)
      .map((q) => ({ q, g: wornOf(w, q.id)[0]! }));
    for (const { g } of worn) g['wear'] = 100;
    step(w, sim, TICKS_PER_HOUR);
    const stayed = worn.filter(({ q }) => byAFire(w, winter, q) && q['doing'] === 'relax');
    expect(stayed.length).toBeGreaterThan(0);
    // It still wears an hour while worn, so mending must outrun that.
    for (const { g } of stayed) expect(g['wear']).toBe(100 + winter.tales.evening.mend - 1);
  });
});

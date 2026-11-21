// The worker's tick loop at a season's turn (6T fix A, P5): from the day before a season turns, at
// 6×, play pauses on the turn with the recap ready for the page; a year jump runs past that turn,
// stops early on a death with the line that stopped it, and Jump on lands on the new year with
// every recap it passed. A test calendar of four seven-day months, one a season, keeps it short.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  annalsSystem,
  calendarSystem,
  createSim,
  createWorld,
  mapSystem,
  step,
  TICKS_PER_DAY,
  type EngineContent,
  type System,
  type WorldState,
  weatherSystem,
} from '../engine/index.ts';
import { cutJump, runTicks, type Clock } from './clock.ts';
import { createPace, jump } from './pace.ts';
import { recapFeed } from './recaps.ts';
import { lineOf } from './lines.ts';
import { stopSettings } from './stops.ts';

const calendar = {
  daysPerWeek: 7,
  daysPerMonth: 7,
  monthsPerYear: 4,
  seasons: ['spring', 'summer', 'autumn', 'winter'],
  monthNames: ['Thaw', 'Sun', 'Leaf', 'Frost'],
};
const DAY = TICKS_PER_DAY;
const SUMMER = 7 * DAY;
const YEAR = 28 * DAY;
/** Bran dies at noon on day 10, in summer: a Pause line with the default settings. */
const DEATH = 10 * DAY + DAY / 2;
const planted: System = {
  id: 'test-planted',
  every: 'minute',
  emits: ['health.died'],
  run(ctx) {
    if (ctx.world.tick === DEATH)
      ctx.emit('health.died', { data: { name: 'Bran', where: 'by the ford', cause: 'Cold.' } });
  },
};
const sim = createSim(
  { ...content, calendar } as EngineContent,
  [mapSystem, calendarSystem, weatherSystem, planted, annalsSystem],
  2,
);
// The day before summer, made once; each test runs a structured clone of it.
const eve = createWorld(sim, 'clock-test');
step(eve, sim, SUMMER - DAY - eve.tick);

const clockOf = (): Clock => ({
  pace: createPace(0),
  stops: stopSettings(),
  recaps: { season: true, year: true },
});
/** Runs the loop as the worker's wakes would, until `done` or a day of wakes passes. */
function wakes(w: WorldState, clock: Clock, ticks: number, done: () => boolean): void {
  for (let i = 0; i < 2000 && !done(); i += 1)
    runTicks(
      w,
      sim,
      clock,
      ticks,
      () => true,
      () => {},
    );
}

describe('the clock at a season turn', () => {
  it('pauses on the turn at 6x, with the recap ready to open', () => {
    const w = structuredClone(eve);
    const feed = recapFeed();
    feed.next(w, (e) => lineOf(w, sim, e)); // the world's first recaps are not news
    const clock = clockOf();
    clock.pace.speed = 6;
    wakes(w, clock, 800, () => clock.pace.speed === 0);
    expect(clock.pace.speed).toBe(0);
    expect(w.tick - SUMMER).toBeGreaterThanOrEqual(0);
    expect(w.tick - SUMMER).toBeLessThan(DAY / 24); // within the hour the season turned
    expect(feed.next(w, (e) => lineOf(w, sim, e))?.map((r) => [r.kind, r.kicker])).toEqual([
      ['season', 'The chronicle · Spring, year 1'],
    ]);
  });

  it('a year jump stops early on a death, and Jump on lands on the new year', () => {
    const w = structuredClone(eve);
    const clock = clockOf();
    jump(clock.pace, 'year', w.tick, YEAR);
    wakes(w, clock, 0, () => !clock.pace.skip);
    expect(w.tick).toBe(DEATH);
    expect(clock.ended).toMatchObject({ span: 'year', landed: false });
    expect(clock.ended?.line?.type).toBe('health.died');
    expect(clock.pace.speed).toBe(0);
    delete clock.ended;
    jump(clock.pace, 'year', w.tick, YEAR); // Jump on: the same span, so the same landing
    wakes(w, clock, 0, () => !clock.pace.skip);
    expect(w.tick).toBe(YEAR);
    expect(clock.ended).toEqual({ span: 'year', from: DEATH, landed: true });
  });

  it('the player stopping a jump ends it where it is, not landed', () => {
    const clock = clockOf();
    jump(clock.pace, 'season', SUMMER, 2 * SUMMER);
    cutJump(clock, SUMMER + 5);
    expect(clock.ended).toEqual({ span: 'season', from: SUMMER, landed: false });
  });
});

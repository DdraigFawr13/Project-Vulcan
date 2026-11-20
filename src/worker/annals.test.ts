// The season and year recaps (Phase 6T slice 2, V-191): planted lines over one short year come back
// as recaps that join lines of a kind, cite every line they tell with its words kept past the seal,
// and survive a save unchanged. A test calendar of four seven-day months, one a season, keeps the
// year to 28 days; the four seeds' real recaps are `npm run annals`.
import { describe, expect, it } from 'vitest';
import { content, contentHash } from '../content/index.ts';
import {
  annalsOf,
  annalsSystem,
  calendarSystem,
  createSim,
  createWorld,
  mapSystem,
  recapOf,
  recordOf,
  step,
  tableOf,
  TICKS_PER_DAY,
  type EngineContent,
  type System,
  weatherSystem,
} from '../engine/index.ts';
import { checkSave, saveOf } from './save.ts';

const calendar = {
  daysPerWeek: 7,
  daysPerMonth: 7,
  monthsPerYear: 4,
  seasons: ['spring', 'summer', 'autumn', 'winter'],
  monthNames: ['Thaw', 'Sun', 'Leaf', 'Frost'],
};
const shortYear: EngineContent = { ...content, calendar };

// Lines a recap tells, on set days: two tools break and Bran dies in spring, the lakes freeze in
// autumn twice; summer and winter keep nothing.
const planted: System = {
  id: 'test-planted',
  every: 'day',
  emits: ['tool.broke', 'health.died', 'weather.frozenOver'],
  run(ctx) {
    const day = ctx.world.tick / TICKS_PER_DAY;
    const broke = (name: string) =>
      ctx.emit('tool.broke', { data: { name, what: 'stone axe', hours: 40 } });
    if (day === 2) {
      broke('Ann');
      broke('Bryn');
    }
    if (day === 3)
      ctx.emit('health.died', { data: { name: 'Bran', where: 'by the ford', cause: 'Cold.' } });
    if (day === 16 || day === 18) ctx.emit('weather.frozenOver', {});
  },
};
// A two-day recent window, so spring's lines are sealed days before its recap is written.
const sim = createSim(
  shortYear,
  [mapSystem, calendarSystem, weatherSystem, planted, annalsSystem],
  2,
);
const world = createWorld(sim, 'annals-test');
// To just past the first midnight of year 2, when winter's recap and the year's are written.
step(world, sim, 28 * TICKS_PER_DAY);
const recaps = [...annalsOf(world)].reverse();
const said = (n: number) => recapOf(world, recaps[n]!.id);

describe('annals', () => {
  it("writes each season's recap and the year's, joining lines of a kind", () => {
    expect(recaps.map((a) => [a['kind'], a['title']])).toEqual([
      ['season', 'Spring of year 1: Bran died'],
      ['season', 'Summer of year 1: a quiet season'],
      ['season', 'Autumn of year 1: the lakes froze'],
      ['season', 'Winter of year 1: a quiet season'],
      ['year', 'Year 1: Bran died'],
    ]);
    expect(said(0)).toEqual([
      { section: 'lost', text: 'Bran died by the ford. Cold.' },
      { section: 'troubles', text: "Two tools broke: Ann's stone axe and Bryn's stone axe." },
      { section: 'numbers', text: expect.stringContaining('nobody lived in the valley') },
    ]);
    // The same line twice is said once.
    expect(said(2)[0]).toEqual({ section: 'troubles', text: 'The lakes froze over.' });
    expect(said(4)).toEqual([
      { section: 'spring', text: expect.stringMatching(/^Spring: Bran died\. Bran died by/) },
      { section: 'summer', text: 'Summer: a quiet season.' },
      { section: 'autumn', text: 'Autumn: the lakes froze. The lakes froze over.' },
      { section: 'winter', text: 'Winter: a quiet season.' },
      {
        section: 'numbers',
        text: 'In the year nobody came to the valley, one died, no children were born and no houses went up.',
      },
    ]);
    // The year's kept lines go once its recap is written; the recaps hold their words.
    expect(tableOf(world, 'annalLine')).toEqual([]);
  });

  it('cites every line it tells, and keeps their words past the sealed week', () => {
    const texts = tableOf(world, 'annalText');
    expect(texts.length).toBeGreaterThan(10);
    for (const t of texts) {
      const lines = t['lines'] as number[];
      expect(lines.length, t['text'] as string).toBeGreaterThan(0);
      for (const id of lines) expect(recordOf(world, id)).toHaveProperty('data');
    }
    // Spring's lines left the recent window before its recap was written, yet are still whole.
    const broke = texts.find((t) => (t['text'] as string).startsWith('Two tools'))!;
    expect(world.log[0]!.id).toBeGreaterThan((broke['lines'] as number[])[1]!);
  });

  it('survives a save and load unchanged, and goes on as an unbroken run', () => {
    const loaded = checkSave(
      structuredClone(saveOf(world, contentHash)),
      contentHash,
      shortYear,
      sim.tables,
    );
    expect(loaded).toEqual(world);
    const unbroken = structuredClone(world);
    step(loaded, sim, 7 * TICKS_PER_DAY + 1);
    step(unbroken, sim, 7 * TICKS_PER_DAY + 1);
    expect(annalsOf(loaded)).toHaveLength(6);
    expect(tableOf(loaded, 'annalText')).toEqual(tableOf(unbroken, 'annalText'));
  });
});

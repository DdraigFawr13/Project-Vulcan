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
  type SimEvent,
  type Stub,
  type System,
  weatherSystem,
} from '../engine/index.ts';
import { lineOf } from './lines.ts';
import { recapFeed, recapPauses, recapView } from './recaps.ts';
import { checkSave, saveOf } from './save.ts';

const calendar = {
  daysPerWeek: 7,
  daysPerMonth: 7,
  monthsPerYear: 4,
  seasons: ['spring', 'summer', 'autumn', 'winter'],
  monthNames: ['Thaw', 'Sun', 'Leaf', 'Frost'],
};
const shortYear: EngineContent = { ...content, calendar };

// Lines a recap tells, on set days: two tools break, the food runs out and Bran dies in spring, the
// lakes freeze in autumn twice and a third tool breaks; summer and winter keep nothing.
const planted: System = {
  id: 'test-planted',
  every: 'day',
  emits: ['tool.broke', 'goods.foodGone', 'health.died', 'weather.frozenOver'],
  run(ctx) {
    const day = ctx.world.tick / TICKS_PER_DAY;
    const broke = (name: string) =>
      ctx.emit('tool.broke', { data: { name, what: 'stone axe', hours: 40 } });
    if (day === 2) {
      broke('Ann');
      broke('Bryn');
      ctx.emit('goods.foodGone', { data: { name: 'Bryn' } });
    }
    if (day === 17) broke('Cai');
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
      // Troubles go by danger to people: the food running out before broken tools.
      {
        section: 'troubles',
        text: "Bryn ate the last of the band's food. Two tools broke: Ann's stone axe and Bryn's stone axe.",
      },
      { section: 'numbers', text: expect.stringContaining('nobody lived in the valley') },
    ]);
    // The same line twice is said once.
    expect(said(2)[0]).toEqual({
      section: 'troubles',
      text: "The lakes froze over. Cai's stone axe broke after 40 hours of work.",
    });
    expect(said(4)).toEqual([
      { section: 'spring', text: expect.stringMatching(/^Spring: Bran died\. Bran died by/) },
      { section: 'summer', text: 'Summer: a quiet season.' },
      {
        section: 'autumn',
        text: expect.stringMatching(/^Autumn: the lakes froze\. The lakes froze over\./),
      },
      { section: 'winter', text: 'Winter: a quiet season.' },
      // A small trouble that came back in two seasons folds into one line of the year.
      {
        section: 'troubles',
        text: 'Season after season, small troubles came back: tools broke (three times).',
      },
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

// Slice 3: the recaps as the page gets them, and which of them pause play (V-191).
describe('recaps for the page', () => {
  const line = (e: SimEvent | Stub) => lineOf(world, sim, e);

  it('words a recap with its headings, each sentence with the whole lines it tells', () => {
    const spring = recapView(world, recaps[0]!, line);
    expect(spring).toMatchObject({ kind: 'season', title: 'Bran died' });
    expect(spring.kicker).toBe('The chronicle · Spring, year 1');
    expect(spring.sections.map((s) => s.head)).toEqual(['Who we lost', 'Troubles', 'In numbers']);
    const broke = spring.sections[1]!.sentences[1]!;
    expect(broke.lines.map((l) => l.text)).toEqual([
      "Ann's stone axe broke after 40 hours of work.",
      "Bryn's stone axe broke after 40 hours of work.",
    ]);
    // A year's season paragraphs open with their season's name, so they carry no heading.
    const year = recapView(world, recaps[4]!, line);
    expect(year.kicker).toBe('The chronicle · Year 1');
    expect(year.sections[0]).toMatchObject({ id: 'spring' });
    expect(year.sections[0]).not.toHaveProperty('head');
  });

  it('pauses play for a recap whose switch is on, the year turn for either', () => {
    const all = { season: true, year: true };
    expect(recapPauses(world, 0, all)).toBe(true);
    expect(recapPauses(world, 3, { season: false, year: true })).toBe(true);
    expect(recapPauses(world, 0, { season: false, year: false })).toBe(false);
    expect(recapPauses(world, 4, { season: true, year: false })).toBe(false);
    expect(recapPauses(world, 5, all)).toBe(false);
  });

  it('sends every recap after a reset, then only the new ones', () => {
    const feed = recapFeed();
    expect(feed.next(world, line)!.map((r) => r.id)).toEqual(recaps.map((r) => r.id));
    expect(feed.next(world, line)).toBeUndefined();
    feed.reset();
    expect(feed.next(world, line)).toHaveLength(5);
  });
});

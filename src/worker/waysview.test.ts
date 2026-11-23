// New ways on screen (6C Slice 6, V-221): a person's puzzle and hints, the ways they know and the
// colony's list read straight from the discovery tables; a find is a notable line of the "Finds
// and new ways" stop kind; a season with a find gets a "New ways" part citing it, and the year
// lists its finds.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  addEntity,
  annalsOf,
  annalsSystem,
  calendarSystem,
  createSim,
  createWorld,
  mapSystem,
  recapOf,
  step,
  tableOf,
  TICKS_PER_DAY,
  type EngineContent,
  type EntityRow,
  type SimEvent,
  type System,
  weatherSystem,
} from '../engine/index.ts';
import { stopOf, stopSettings } from './stops.ts';
import { colonyWays, personWays } from './waysview.ts';

describe('new ways on screen', () => {
  const sim = createSim(content);
  const w = createWorld(sim, 'anvil');
  const [a, b, c, d] = (w.entities['person'] ?? []).filter(
    (p) => p['status'] === 'alive',
  ) as EntityRow[];
  // A line that explains more than the world's beginning, so its why? opens a chain.
  const line = w.log.find((e) => e.causes.some((c) => c !== w.begunEvent))!.id;
  const puzzle = addEntity(w, 'puzzle', {
    ...{ person: a!.id, method: 'cleaner-smelt', line, since: 0, work: 0 },
    ...{ failed: -1, read: -1, last: 0, ended: 0, busy: 0 },
  });
  addEntity(w, 'hint', { puzzle, kind: 'work', line, short: 'long hours at the smelter' });
  addEntity(w, 'hint', { puzzle, kind: 'luck', line, short: 'a lucky slip' });
  const knows = (p: EntityRow, method: string, how: string, from = 0, at = line) =>
    addEntity(w, 'knows', { person: p.id, method, how, line: at, from });
  knows(b!, 'clamp', 'found');
  knows(a!, 'clamp', 'beside', b!.id);
  // Found on a line citing only the world's beginning: nothing more to explain, so no why?.
  knows(c!, 'lime-mortar', 'found', 0, w.begunEvent);
  knows(d!, 'steel', 'found');
  d!['status'] = 'dead';

  it("shows a person's puzzle with each hint's line, and the ways they know", () => {
    const ways = personWays(w, a!).ways!;
    expect(ways.puzzle).toEqual({
      text: 'Puzzling over a cleaner smelt: 2 of 4 hints.',
      why: line,
      hints: [
        { text: 'Hint 1: long hours at the smelter.', why: line },
        { text: 'Hint 2: a lucky slip.', why: line },
      ],
      left: expect.stringMatching(/^Two hints to go\. More work at the smelter/),
    });
    expect(ways.known).toEqual([
      {
        text: 'Knows a better charcoal clamp',
        note: `Learnt working beside ${b!['name'] as string}, Day 1 of Thawmonth, year 1. Their clamps give a quarter more charcoal.`,
        why: line,
      },
    ]);
    // Someone who puzzles over nothing and knows nothing gets no "New ways" at all.
    const e = (w.entities['person'] ?? []).find(
      (p) => p['status'] === 'alive' && ![a, b, c].includes(p),
    );
    if (e) expect(personWays(w, e)).toEqual({});
  });

  it("lists the colony's ways, warns of a lone knower, and never a way nobody living knows", () => {
    const view = colonyWays(w);
    const [bn, an, cn] = [b, a, c].map((p) => p!['name'] as string);
    expect(view.known.map((r) => r.why)).toEqual([line, undefined]);
    expect(view.known.map((r) => [r.text, r.note])).toEqual([
      [
        'A better charcoal clamp',
        `${bn} found it; ${an} learnt it. Their clamps give a quarter more charcoal.`,
      ],
      [
        'Lime mortar',
        `Only ${cn} knows it: lost if ${cn} dies or leaves before teaching it. Stone walls they build lose a third less heat.`,
      ],
    ]);
    expect(view.puzzled).toEqual({
      text: 'Being puzzled over',
      note: `A cleaner smelt (${an}, 2 of 4 hints).`,
      why: line,
    });
    // Every way has its effect in words.
    for (const m of content.methods.methods)
      expect(content.methods.screen.effects[m.id]).toBeTruthy();
  });

  it('a find is a notable line of the "Finds and new ways" kind, Slow by default', () => {
    const found = { type: 'discover.found', data: {} } as unknown as SimEvent;
    expect(sim.notable(found)).toBe(true);
    expect(stopOf([found], sim.notable, stopSettings())?.act).toBe('slow');
    expect(content.events.find((e) => e.id === 'discover.found')?.stop).toBe('ways');
    expect(content.stops.find((s) => s.id === 'ways')?.name).toBe('Finds and new ways');
  });
});

describe('new ways in the recaps', () => {
  const calendar = {
    daysPerWeek: 7,
    daysPerMonth: 7,
    monthsPerYear: 4,
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    monthNames: ['Thaw', 'Sun', 'Leaf', 'Frost'],
  };
  const shortYear: EngineContent = { ...content, calendar };
  const planted: System = {
    id: 'test-found',
    every: 'day',
    emits: ['discover.found'],
    run(ctx) {
      if (ctx.world.tick / TICKS_PER_DAY === 2)
        ctx.emit('discover.found', {
          data: { name: 'Ann', method: 'steel', days: 30, hints: 'a dream' },
        });
    },
  };
  const sim = createSim(
    shortYear,
    [mapSystem, calendarSystem, weatherSystem, planted, annalsSystem],
    2,
  );
  const world = createWorld(sim, 'ways-recap');
  step(world, sim, 28 * TICKS_PER_DAY);
  const recaps = [...annalsOf(world)].reverse();

  it('a season with a find gets a "New ways" part citing the line; the year lists it', () => {
    const found = tableOf(world, 'annalText').filter((t) => t['section'] === 'ways');
    expect(found.map((t) => t['text'])).toEqual([
      'Ann found steel after 30 days of puzzling, from a dream.',
      'New ways found this year: steel, by Ann.',
    ]);
    const [season, year] = found;
    expect(season!['annal']).toBe(recaps[0]!.id);
    expect(year!['annal']).toBe(recaps.at(-1)!.id);
    for (const t of found) expect((t['lines'] as number[]).length).toBe(1);
    expect(recapOf(world, recaps[0]!.id).map((p) => p.section)).toContain('ways');
    // A quiet season has no "New ways" part.
    expect(recapOf(world, recaps[1]!.id).map((p) => p.section)).not.toContain('ways');
  });
});

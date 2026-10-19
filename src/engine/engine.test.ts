// The engine's one determinism test (RULES.md VR-21), plus the ledger and lever-queue rules a
// player would notice: a refused event type, and a lever that arrives late.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index';
import {
  allLines,
  applyDue,
  calendarSystem,
  chunkTiles,
  createSim,
  createWorld,
  hashString,
  mapSystem,
  setTile,
  renderEvent,
  replay,
  START_TICK,
  step,
  submitCommand,
  ticksPerMonth,
  toNdjson,
  whyOf,
  type EngineContent,
  type System,
} from './index.ts';

// Test-only fixtures: a system that rolls its dice every hour and a lever with no game meaning.
const fixtureContent: EngineContent = {
  calendar: content.calendar,
  terrain: content.terrain,
  biomes: content.biomes,
  features: content.features,
  weather: content.weather,
  seasons: content.seasons,
  schools: content.schools,
  region: content.region,
  cultures: content.cultures,
  races: content.races,
  names: content.names,
  band: content.band,
  traits: content.traits,
  abilities: content.abilities,
  life: content.life,
  memories: content.memories,
  work: content.work,
  jobs: content.jobs,
  buildings: content.buildings,
  tools: content.tools,
  items: content.items,
  events: [
    ...content.events,
    { id: 'test.roll', template: 'The dice showed {value}.' },
    { id: 'test.marked', template: 'Marked {place}.' },
  ],
};
const dice: System = {
  id: 'test-dice',
  every: 'hour',
  stream: 'weather',
  emits: ['test.roll', 'test.marked'],
  run: (ctx) => void ctx.emit('test.roll', { data: { value: ctx.rng().between(1, 6) } }),
  commands: {
    'test.mark': (ctx, command, cause) =>
      void ctx.emit('test.marked', { causes: [cause], data: { place: command.data['place']! } }),
  },
};
const sim = createSim(fixtureContent, [mapSystem, calendarSystem, dice]);
const month = ticksPerMonth(content.calendar);

/** A game month from `seed`, with three levers sent at different points of the run. */
function runMonth(seed: string, on = sim) {
  const sim = on;
  const world = createWorld(sim, seed);
  submitCommand(world, { tick: 16380, kind: 'test.mark', data: { place: 'north field' } });
  step(world, sim, 20000);
  submitCommand(world, { tick: 100, kind: 'test.mark', data: { place: 'old ford' } });
  submitCommand(world, { tick: world.tick + 500, kind: 'test.unknown' });
  step(world, sim, month - 20000);
  return world;
}

describe('engine', () => {
  it('gives identical ledgers for the same seed and levers after a game month', () => {
    const a = runMonth('hollow-oak');
    const b = runMonth('hollow-oak');
    // The whole ledger: the sealed days and the recent ones (P2.0).
    expect(a.segments.length).toBeGreaterThan(20);
    expect(toNdjson(allLines(a))).toBe(toNdjson(allLines(b)));
    expect(a.rng).toEqual(b.rng);
    expect(a.map).toEqual(b.map);
    // Seed plus command log alone rebuild the whole world, not only its ledger.
    expect(replay(sim, 'hollow-oak', a.commandLog, a.tick)).toEqual(a);
    // Another seed changes the dice, not just the seed printed in the first line.
    const rolls = (log: typeof a.log) =>
      log.filter((e) => e.type === 'test.roll').map((e) => e.data['value']);
    expect(rolls(allLines(runMonth('stone-weir')))).not.toEqual(rolls(allLines(a)));
    // How many days the world keeps in full changes no outcome, only where old lines are held.
    const wide = runMonth('hollow-oak', createSim(sim.content, sim.systems, 400));
    expect(wide.segments).toEqual([]);
    expect(toNdjson(wide.log)).toBe(toNdjson(allLines(a)));
    expect(wide.rng).toEqual(a.rng);
    // Skip ahead (P2.7) stops on the tick that writes a listed line, mid-batch.
    const skipping = createWorld(sim, 'hollow-oak');
    const stopped = step(skipping, sim, 3 * month, new Set(['calendar.season']));
    const season = stopped.find((e) => e.type === 'calendar.season')!;
    expect(season.tick).toBe(skipping.tick);
    expect(skipping.tick).toBeLessThan(START_TICK + 3 * month);
  });

  it('continues a restored world exactly as an unbroken run', () => {
    const unbroken = runMonth('hollow-oak');
    const world = createWorld(sim, 'hollow-oak');
    submitCommand(world, { tick: 16380, kind: 'test.mark', data: { place: 'north field' } });
    step(world, sim, 20000);
    // A structured clone, as a save is: JSON would turn the map's typed layers into objects.
    const restored = structuredClone(world);
    submitCommand(restored, { tick: 100, kind: 'test.mark', data: { place: 'old ford' } });
    submitCommand(restored, { tick: restored.tick + 500, kind: 'test.unknown' });
    step(restored, sim, month - 20000);
    expect(toNdjson(allLines(restored))).toBe(toNdjson(allLines(unbroken)));
    expect(hashString(toNdjson(allLines(restored)))).toBe(hashString(toNdjson(allLines(unbroken))));
  });

  it('writes the calendar lines with short "why?" chains', () => {
    // The map and calendar alone: the weather's lines come in their own test.
    const sim = createSim(content, [mapSystem, calendarSystem]);
    const world = createWorld(sim, 'hollow-oak');
    step(world, sim, 3 * month);
    const log = allLines(world);
    const text = (id: number) => renderEvent(log[id - 1]!, sim.templates);
    expect(text(1)).toBe('A new world began from seed "hollow-oak".');
    expect(text(2)).toMatch(
      /^The valley took shape: 150 by 150 tiles, mostly [a-z ]+, with a [a-z]+ climate \(-?[0-9.]+ °C on the valley floor, [0-9]+ mm of rain a year\)\.$/,
    );
    expect(log[1]).toMatchObject({ type: 'map.formed', causes: [1] });
    // Where the band stops the cart, and why (the green, V-083).
    expect(text(3)).toMatch(
      /^The band stopped the cart on [a-z ,]+ ground .+\. Here would be the green\.$/,
    );
    expect(log[2]).toMatchObject({ type: 'map.green', causes: [2] });
    expect(text(4)).toMatch(
      /^Its waters gathered: a river leaving by the (north|south|east|west), [0-9]+ lakes and [0-9]+ springs\.$/,
    );
    expect(log[3]).toMatchObject({ type: 'map.watered', causes: [2] });
    // The aura spots' line is part of the world as it began, so it cites only that.
    expect(text(5)).toMatch(/^Old power gathers in the valley at .+\.$/);
    expect(log[4]).toMatchObject({ type: 'map.aura', causes: [1] });
    // The world's first month and season get their lines when it begins.
    expect(text(6)).toBe('Thawmonth began.');
    expect(log[5]).toMatchObject({ type: 'calendar.month', causes: [1] });
    expect(text(7)).toBe('Spring came to the valley.');
    expect(log[6]).toMatchObject({ type: 'calendar.season', causes: [6] });
    expect(text(8)).toBe('Day 2 of Thawmonth began.');
    expect(log[7]).toMatchObject({ type: 'calendar.day', causes: [6] });
    expect(log[34]).toMatchObject({ id: 35, type: 'calendar.month', causes: [1] });
    expect(log[35]).toMatchObject({ type: 'calendar.day', causes: [35] });
    expect(text(91)).toBe('Highsun began.');
    expect(log[91]).toMatchObject({ type: 'calendar.season', causes: [91] });
    expect(text(92)).toBe('Summer came to the valley.');
    // The map is cut into 10 by 10 chunks with narrower edge chunks; each carries its features.
    expect(world.map.chunkVersions).toHaveLength(100);
    const edge = chunkTiles(world.map, 9, 9);
    expect(edge).toMatchObject({ x: 144, y: 144, w: 6, h: 6 });
    expect(edge.tiles).toEqual(
      Uint8Array.from(
        [0, 1, 2, 3, 4, 5].flatMap((r) =>
          world.map.tiles.slice((144 + r) * 150 + 144, (144 + r) * 150 + 150),
        ),
      ),
    );
    expect(edge.features).toHaveLength(36);
    expect(edge.snow).toHaveLength(36);
    // Changing a tile marks only its chunk for resending.
    const ctx = { world, content } as unknown as Parameters<typeof setTile>[0];
    expect(() => setTile(ctx, 150 - 1, 17, 1, 9999)).toThrow('without a ledger line');
    const waters = log.find((e) => e.type === 'map.watered')!.id;
    setTile(ctx, 150 - 1, 17, 1, waters);
    expect(world.map.chunkVersions[1 * 10 + 9]).toBe(2);
    // Every tile cites the line that laid it out until something changes it (water the
    // waters' line, the rest the valley's); "why?" walks back.
    const formed = log.find((e) => e.type === 'map.formed')!;
    const watered = log.find((e) => e.type === 'map.watered')!;
    expect(world.map.tileCauses[17 * 150 + 149]).toBe(waters);
    expect(world.map.tileCauses.filter((c) => c === watered.id).length).toBeGreaterThan(0);
    // Every water tile cites the waters; each other tile one of the two generator lines.
    expect(world.map.tileCauses.every((c, i) => !world.map.water[i] || c === watered.id)).toBe(
      true,
    );
    expect(world.map.tileCauses.every((c) => c === formed.id || c === watered.id)).toBe(true);
    expect(whyOf({ log, stubs: [] }, log[86]!.id).map((w) => [w.event.type, w.depth])).toEqual([
      ['calendar.month', 1],
      ['world.begun', 2],
    ]);
    expect(world.map.chunkVersions.filter((v) => v === 2)).toHaveLength(1);
  });

  it('applies a late lever on the next tick and logs an unknown one as refused', () => {
    const world = runMonth('hollow-oak');
    const late = world.commandLog[1]!;
    expect(late).toMatchObject({ asked: 100, tick: 20361 });
    const lines = allLines(world).filter(
      (e) => e.type.startsWith('command.') || e.type === 'test.marked',
    );
    expect(lines.map((e) => [e.type, e.tick])).toEqual([
      ['command.applied', 16380],
      ['test.marked', 16380],
      ['command.applied', 20361],
      ['test.marked', 20361],
      ['command.refused', 20860],
    ]);
    expect(lines[1]!.causes).toEqual([lines[0]!.id]);
    // An inherited property name is not a handler, and a tick must be a whole minute.
    submitCommand(world, { tick: world.tick + 1, kind: 'constructor' });
    expect(step(world, sim)[0]).toMatchObject({
      type: 'command.refused',
      data: { kind: 'constructor' },
    });
    expect(() => submitCommand(world, { tick: Number.NaN, kind: 'test.mark' })).toThrow(
      'whole minutes',
    );
  });

  it('applies a lever at once while paused, as its tick would have', () => {
    const run = (paused: boolean) => {
      const world = createWorld(sim, 'hollow-oak');
      step(world, sim, 3000);
      submitCommand(world, { tick: world.tick + 1, kind: 'test.mark', data: { place: 'ford' } });
      const now = paused ? applyDue(world, sim) : [];
      step(world, sim, 600);
      return { world, now };
    };
    const { world, now } = run(true);
    expect(now.map((e) => [e.type, e.tick])).toEqual([
      ['command.applied', START_TICK + 3001],
      ['test.marked', START_TICK + 3001],
    ]);
    expect(world).toEqual(run(false).world);
  });

  it('refuses an event type with no template, or a template slot left empty', () => {
    const world = createWorld(sim, 'hollow-oak');
    const emit =
      (type: string, data = {}) =>
      () =>
        step(
          world,
          createSim(fixtureContent, [
            { id: 'x', every: 'minute', run: (c) => void c.emit(type, { data }) },
          ]),
        );
    expect(emit('test.nothing')).toThrow('Event type "test.nothing" has no template');
    expect(emit('calendar.month')).toThrow('template needs "month"');
    const cited = (cause: number) => () =>
      step(
        world,
        createSim(fixtureContent, [
          {
            id: 'z',
            every: 'minute',
            run: (c) => void c.emit('world.begun', { causes: [cause], data: { seed: 's' } }),
          },
        ]),
      );
    expect(cited(world.nextEventId)).toThrow('is not an earlier ledger line');
    expect(cited(0)).toThrow('is not an earlier ledger line');
    expect(() =>
      createSim(fixtureContent, [{ id: 'y', every: 'day', emits: ['test.nothing'] }]),
    ).toThrow('No template in content events for: test.nothing.');
  });
});

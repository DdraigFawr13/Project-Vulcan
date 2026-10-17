// The engine's one determinism test (RULES.md VR-21), plus the ledger and lever-queue rules a
// player would notice: a refused event type, and a lever that arrives late.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index';
import {
  calendarSystem,
  chunkTiles,
  createSim,
  createWorld,
  hashString,
  mapSystem,
  setTile,
  renderEvent,
  replay,
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
function runMonth(seed: string) {
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
    expect(toNdjson(a.log)).toBe(toNdjson(b.log));
    expect(a.rng).toEqual(b.rng);
    expect(a.map).toEqual(b.map);
    // Seed plus command log alone rebuild the whole world, not only its ledger.
    expect(replay(sim, 'hollow-oak', a.commandLog, a.tick)).toEqual(a);
    // Another seed changes the dice, not just the seed printed in the first line.
    const rolls = (log: typeof a.log) =>
      log.filter((e) => e.type === 'test.roll').map((e) => e.data['value']);
    expect(rolls(runMonth('stone-weir').log)).not.toEqual(rolls(a.log));
  });

  it('continues a world restored from JSON exactly as an unbroken run', () => {
    const unbroken = runMonth('hollow-oak');
    const world = createWorld(sim, 'hollow-oak');
    submitCommand(world, { tick: 16380, kind: 'test.mark', data: { place: 'north field' } });
    step(world, sim, 20000);
    const restored = JSON.parse(JSON.stringify(world)) as typeof world;
    submitCommand(restored, { tick: 100, kind: 'test.mark', data: { place: 'old ford' } });
    submitCommand(restored, { tick: restored.tick + 500, kind: 'test.unknown' });
    step(restored, sim, month - 20000);
    expect(toNdjson(restored.log)).toBe(toNdjson(unbroken.log));
    expect(hashString(toNdjson(restored.log))).toBe(hashString(toNdjson(unbroken.log)));
  });

  it('writes the calendar lines with short "why?" chains', () => {
    const world = createWorld(createSim(content), 'hollow-oak');
    step(world, createSim(content), 3 * month);
    const text = (id: number) => renderEvent(world.log[id - 1]!, createSim(content).templates);
    expect(text(1)).toBe('A new world began from seed "hollow-oak".');
    expect(text(2)).toMatch(
      /^The valley took shape: 150 by 150 tiles, mostly [a-z ]+, with a [a-z]+ climate \(-?[0-9.]+ °C on the valley floor, [0-9]+ mm of rain a year\)\.$/,
    );
    expect(world.log[1]).toMatchObject({ type: 'map.formed', causes: [1] });
    // The world's first month and season get their lines when it begins.
    expect(text(3)).toBe('Thawmonth began.');
    expect(world.log[2]).toMatchObject({ type: 'calendar.month', causes: [1] });
    expect(text(4)).toBe('Spring came to the valley.');
    expect(world.log[3]).toMatchObject({ type: 'calendar.season', causes: [3] });
    expect(text(5)).toBe('Day 2 of Thawmonth began.');
    expect(world.log[4]).toMatchObject({ type: 'calendar.day', causes: [3] });
    expect(world.log[31]).toMatchObject({ id: 32, type: 'calendar.month', causes: [1] });
    expect(world.log[32]).toMatchObject({ type: 'calendar.day', causes: [32] });
    expect(text(88)).toBe('Highsun began.');
    expect(world.log[88]).toMatchObject({ type: 'calendar.season', causes: [88] });
    expect(text(89)).toBe('Summer came to the valley.');
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
    // Changing a tile marks only its chunk for resending.
    const ctx = { world, content } as unknown as Parameters<typeof setTile>[0];
    expect(() => setTile(ctx, 150 - 1, 17, 1, 9999)).toThrow('without a ledger line');
    setTile(ctx, 150 - 1, 17, 1, 3);
    expect(world.map.chunkVersions[1 * 10 + 9]).toBe(2);
    // Every tile cites the line that laid it out until something changes it; "why?" walks back.
    const formed = world.log.find((e) => e.type === 'map.formed')!;
    expect(world.map.tileCauses[17 * 150 + 149]).toBe(3);
    expect(world.map.tileCauses.filter((c) => c !== formed.id)).toHaveLength(1);
    expect(whyOf(world.log, world.log[86]!.id).map((w) => [w.event.type, w.depth])).toEqual([
      ['calendar.month', 1],
      ['world.begun', 2],
    ]);
    expect(world.map.chunkVersions.filter((v) => v === 2)).toHaveLength(1);
  });

  it('applies a late lever on the next tick and logs an unknown one as refused', () => {
    const world = runMonth('hollow-oak');
    const late = world.commandLog[1]!;
    expect(late).toMatchObject({ asked: 100, tick: 20361 });
    const lines = world.log.filter(
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

// The engine's one determinism test (RULES.md VR-21), plus the ledger and lever-queue rules a
// player would notice: a refused event type, and a lever that arrives late.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index';
import {
  calendarSystem,
  createSim,
  createWorld,
  hashString,
  renderEvent,
  replay,
  step,
  submitCommand,
  ticksPerMonth,
  toNdjson,
  type EngineContent,
  type System,
} from './index';

// Test-only fixtures: a system that rolls its dice every hour and a lever with no game meaning.
const fixtureContent: EngineContent = {
  calendar: content.calendar,
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
  run: (ctx) => void ctx.emit('test.roll', { data: { value: ctx.rng().between(1, 6) } }),
  commands: {
    'test.mark': (ctx, command, cause) =>
      void ctx.emit('test.marked', { causes: [cause], data: { place: command.data['place']! } }),
  },
};
const sim = createSim(fixtureContent, [calendarSystem, dice]);
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
    // Rebuilding from the seed and the command log alone gives the same ledger (the save check).
    expect(toNdjson(replay(sim, 'hollow-oak', a.commandLog, a.tick).log)).toBe(toNdjson(a.log));
    expect(hashString(toNdjson(runMonth('stone-weir').log))).not.toBe(hashString(toNdjson(a.log)));
  });

  it('writes the calendar lines with short "why?" chains', () => {
    const world = createWorld(createSim(content), 'hollow-oak');
    step(world, createSim(content), 3 * month);
    const text = (id: number) => renderEvent(world.log[id - 1]!, createSim(content).templates);
    expect(text(1)).toBe('A new world began from seed "hollow-oak".');
    expect(text(2)).toBe('Day 2 of Thawmonth began.');
    expect(world.log[28]).toMatchObject({ id: 29, type: 'calendar.month', causes: [1] });
    expect(world.log[29]).toMatchObject({ type: 'calendar.day', causes: [29] });
    expect(text(85)).toBe('Highsun began.');
    expect(world.log[85]).toMatchObject({ type: 'calendar.season', causes: [85] });
    expect(text(86)).toBe('Summer came to the valley.');
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
  });
});

// 6C Slice 7, part 1 (V-236): a wandering master comes by the road and asks at the green for a bed
// and food for a season, citing their coming; taken up, they stay as one of the colony; at the
// season's end the master's line leaves each puzzler on a way of their trade one hint, and the band
// talks them over; one let stay keeps the way they brought. Unanswered, they walk on.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  emit,
  step,
  submitCommand,
  TICKS_PER_HOUR,
  withoutAccidents,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { comes } from './masters.ts';
import { asksSystem } from './system.ts';

const content = withoutAccidents(game);
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const living = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const askOf = (w: World) => (w.entities['ask'] ?? []).find((a) => a['source'] === 'wanderer')!;

/** smoke/1 (a valley with neighbours) with a master on the road and walked to the green. */
function arrived() {
  const sim = createSim(content);
  const w = createWorld(sim, 'smoke/1');
  const ctx = contextFor(w, sim, asksSystem);
  const master = comes(ctx, ctx.rng())!;
  // Walking in from the edge to the green, then asking.
  for (let k = 0; k < 40 && !lines(w, 'master.asked').length; k += 1) step(w, sim, 60);
  return { sim, w, master };
}

describe('a wandering master', () => {
  it('asks at the green citing their coming, stays the season and leaves a hint', () => {
    const { sim, w, master } = arrived();
    const [came] = lines(w, 'master.came');
    const [asked] = lines(w, 'master.asked');
    expect(came!.actors).toEqual([master.id]);
    expect(asked!.causes).toContain(came!.id);
    expect(master['status']).toBe('stranger');
    const level = w.entities['skill']!.filter((s) => s['person'] === master.id);
    expect(Math.max(...level.map((s) => s['level'] as number))).toBeGreaterThanOrEqual(12);
    const ask = askOf(w);
    expect(ask['line']).toBe(asked!.id);
    expect(ask['cite']).toBe(came!.id);
    // Someone puzzling over the master's way.
    const [puzzler] = living(w);
    const way = master['way'] as string;
    const begun = emit(w, sim.templates, 'discover.puzzle', {
      causes: [w.begunEvent],
      actors: [puzzler!.id],
      data: { name: 'x', method: way, hours: 40, where: 'forge' },
    });
    addEntity(w, 'puzzle', {
      ...{ person: puzzler!.id, method: way, line: begun, since: w.tick, work: 0 },
      ...{ failed: -1, read: -1, last: w.tick, ended: 0, busy: 0 },
    });
    submitCommand(w, { tick: w.tick + 1, kind: 'takeAsk', data: { ask: ask.id, level: 1 } });
    step(w, sim, 3);
    const [stays] = lines(w, 'guest.stays');
    expect(stays!.actors).toEqual([master.id]);
    expect(master['status']).toBe('alive');
    // Taken in, the ask is the hall's for the season: no lever answers it again (6C review).
    submitCommand(w, { tick: w.tick + 1, kind: 'passAsk', data: { ask: ask.id } });
    submitCommand(w, { tick: w.tick + 1, kind: 'takeAsk', data: { ask: ask.id, level: 3 } });
    step(w, sim, 2);
    expect(lines(w, 'ask.letPass')).toEqual([]);
    expect(lines(w, 'command.refused').map((e) => e.data['kind'])).toEqual(['passAsk', 'takeAsk']);
    expect([ask['state'], ask['level']]).toEqual(['taken', 1]);
    // Nobody spoke against a master, so nobody is sour at sharing the hall.
    const sour = (w.entities['memory'] ?? []).filter(
      (m) => m['memory'] === content.asks.guests.against,
    );
    expect(sour).toEqual([]);
    // The season ends: the master's line, a hint from it, then the band's word.
    ask['due'] = w.tick + 1;
    step(w, sim, TICKS_PER_HOUR + 2);
    const [taught] = lines(w, 'master.taught');
    expect(taught!.causes).toContain(asked!.id);
    const hint = lines(w, 'discover.hint').find((e) => e.causes.includes(taught!.id));
    expect(hint?.actors[0]).toBe(puzzler!.id);
    expect(hint?.data['kind']).toBe('master');
    const word = [...lines(w, 'people.strangerStays'), ...lines(w, 'people.strangerTurnedAway')];
    expect(word.some((e) => e.id > taught!.id && e.actors.includes(master.id))).toBe(true);
  });

  it('let stay, keeps the way they brought; unanswered, walks on', () => {
    const { sim, w, master } = arrived();
    const ask = askOf(w);
    ask['due'] = w.tick + 1;
    step(w, sim, 3);
    expect(lines(w, 'ask.unanswered').at(-1)!.causes).toContain(ask['line']);
    expect(master['waits']).toBe(-1);
    // Had the band let them stay, they would keep their way.
    master['status'] = 'alive';
    const said = emit(w, sim.templates, 'people.strangerStays', {
      causes: [ask['line'] as number],
      actors: [master.id],
      data: { names: 'x', spoke: '', why: '', verb: 'stays', where: '' },
    });
    step(w, sim, TICKS_PER_HOUR);
    const [brought] = lines(w, 'discover.brought');
    expect(brought!.causes).toEqual([said]);
    const knows = (w.entities['knows'] ?? []).filter((k) => k['person'] === master.id);
    expect(knows.map((k) => [k['method'], k['how']])).toEqual([[master['way'], 'master']]);
  });

  it('dead during the stay, leaves no line and no hint', () => {
    const { sim, w, master } = arrived();
    const ask = askOf(w);
    submitCommand(w, { tick: w.tick + 1, kind: 'takeAsk', data: { ask: ask.id, level: 1 } });
    step(w, sim, 3);
    expect(master['status']).toBe('alive');
    master['status'] = 'dead';
    ask['due'] = w.tick + 1;
    step(w, sim, 3);
    expect(lines(w, 'master.taught')).toEqual([]);
    expect(ask['state']).toBe('done');
  });
});

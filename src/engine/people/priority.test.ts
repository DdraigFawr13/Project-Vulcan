// P2.5 done-when: raising a priority changes who takes up the work within an hour, with nobody
// ordered; someone not able declines once, saying why; skills grow by use; the colony's day is a
// lever with a line, and a day that makes no sense is refused.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, step, submitCommand, whyOf } from '../index.ts';

const sim = createSim(content);
const HOUR = 60;
const people = (w: ReturnType<typeof createWorld>) => w.entities['person'] ?? [];
const tookUp = (w: ReturnType<typeof createWorld>) =>
  new Set(w.log.filter((e) => e.type === 'work.tookUp').map((e) => e.actors[0]));
const set = (w: ReturnType<typeof createWorld>, kind: string, data: Record<string, unknown>) =>
  submitCommand(w, { tick: w.tick + 1, kind, data: data as never });

describe('work priorities', () => {
  it('changes who takes up felling within an hour when a priority is raised', () => {
    // A world where someone able to fell has not taken it up in the first hour.
    const strongIdle = (w: ReturnType<typeof createWorld>) =>
      people(w).find((p) => !tookUp(w).has(p.id) && (p['strength'] as number) >= 8);
    const seed = ['ledger', 'wren', 'ledger/1', 'tallow'].find((s) => {
      const w = createWorld(sim, s);
      step(w, sim, HOUR);
      return strongIdle(w);
    })!;
    const before = createWorld(sim, seed);
    step(before, sim, HOUR);
    const fellers = tookUp(before);
    const raised = strongIdle(before)!;
    expect(raised).toBeDefined();

    const after = createWorld(sim, seed);
    set(after, 'setPriority', { person: raised.id, job: 'fell', level: 1 });
    step(after, sim, HOUR);
    expect(tookUp(after).has(raised.id)).toBe(true);
    expect(tookUp(after)).not.toEqual(fellers);
    // Their taking it up traces back to the priority the player set.
    const line = after.log.find((e) => e.type === 'work.tookUp' && e.actors[0] === raised.id)!;
    expect(whyOf(after, line.id).map((c) => c.event.type)).toContain('work.prioritySet');
  });

  it('declines work someone is not able for, once, citing the change', () => {
    const world = ['anvil', 'tallow', 'ledger', 'smoke']
      .map((seed) => createWorld(sim, seed))
      .find((w) => people(w).some((p) => (p['strength'] as number) < 8))!;
    const weak = people(world).find((p) => (p['strength'] as number) < 8)!;
    set(world, 'setPriority', { person: weak.id, job: 'fell', level: 1 });
    step(world, sim, 2 * HOUR);
    const declined = world.log.filter((e) => e.type === 'work.declined');
    expect(declined.map((e) => e.actors[0])).toEqual([weak.id]);
    expect(whyOf(world, declined[0]!.id)[0]?.event.type).toBe('work.prioritySet');
    expect(tookUp(world).has(weak.id)).toBe(false);
  });

  it('raises skills by use, never past potential', () => {
    const world = createWorld(sim, 'ledger');
    set(world, 'setStock', { good: 'logs', level: 'plenty' });
    step(world, sim, 6 * 24 * HOUR);
    const rose = world.log.filter((e) => e.type === 'skill.rose');
    expect(rose.length).toBeGreaterThan(0);
    expect(whyOf(world, rose[0]!.id)[0]?.event.type).toBe('work.tookUp');
    for (const s of world.entities['skill'] ?? [])
      expect(s['level'] as number).toBeLessThanOrEqual(s['potential'] as number);
  });
});

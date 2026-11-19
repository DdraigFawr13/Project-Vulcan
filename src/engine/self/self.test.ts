// P6.4 done-when (V-156): two colonists answer one law differently, each with a reason line that
// names their role. Also: a heavy memory gives a new role with a line citing it, and an ambition
// is practised in free time and, once reached, is a line and a memory.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  rolesOf,
  step,
  submitCommand,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  type EntityRow,
} from '../index.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** Leaves `p` with only `traits`. */
function traitsOf(w: World, p: EntityRow, traits: string[]): void {
  w.entities['trait'] = (w.entities['trait'] ?? []).filter((t) => t['person'] !== p.id);
  for (const trait of traits) addEntity(w, 'trait', { person: p.id, trait });
}

/** Runs on to the next hour the self system works out roles. */
function toRoleHour(w: World): void {
  const at = content.self.hour * TICKS_PER_HOUR + 1;
  const wait = (at - (w.tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  step(w, sim, wait || TICKS_PER_DAY);
}

describe('the self', () => {
  it('has two colonists answer the long days differently, each naming their role', () => {
    const w = createWorld(sim, 'anvil');
    const [provider, wronged] = alive(w) as [EntityRow, EntityRow];
    traitsOf(w, provider, ['steady', 'hardy']);
    traitsOf(w, wronged, ['melancholic']);
    // A hungry winter that stays with them: a heavy memory (weight 3 or more).
    addEntity(w, 'memory', {
      ...{ person: wronged.id, memory: 'went-hungry', until: w.tick + TICKS_PER_DAY },
      ...{ line: w.begunEvent, about: 0, weight: 4, since: w.tick, first: 0, last: 0 },
      ...{ days: 14, mask: 0, fresh: 0 },
    });
    toRoleHour(w);
    expect(rolesOf(w, provider.id).map((r) => r['role'])).toContain('provider');
    expect(rolesOf(w, wronged.id).map((r) => r['role'])).toContain('wronged');
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setLaw',
      data: { law: 'work-hours', setting: 'long' },
    });
    step(w, sim, 2);
    const answer = (p: EntityRow) =>
      lines(w, 'law.answered').find((e) => e.actors[0] === p.id)!.data['reasons'];
    expect(answer(provider)).toMatch(/sees themselves as the provider/);
    expect(answer(wronged)).toMatch(/sees themselves as the wronged one/);
    const row = (p: EntityRow) => (w.entities['answer'] ?? []).find((a) => a['person'] === p.id)!;
    expect(row(provider)['pro']).toMatch(/the provider/);
    expect(row(wronged)['con']).toMatch(/the wronged one/);
  });

  it('takes a new role after a heavy memory, with a line citing it', () => {
    const w = createWorld(sim, 'anvil');
    const p = alive(w)[0]!;
    traitsOf(w, p, ['devout']);
    toRoleHour(w);
    expect(rolesOf(w, p.id).map((r) => r['role'])).toEqual(['faithful']);
    const cause = lines(w, 'people.arrived')[0]!.id;
    addEntity(w, 'memory', {
      ...{ person: p.id, memory: 'fought-off', until: w.tick + TICKS_PER_DAY, line: cause },
      ...{ about: 0, weight: 3, since: w.tick, first: 0, last: 0, days: 1, mask: 0, fresh: 0 },
    });
    toRoleHour(w);
    expect(
      rolesOf(w, p.id)
        .map((r) => r['role'])
        .sort(),
    ).toEqual(['faithful', 'guard']);
    const line = lines(w, 'self.role')
      .filter((e) => e.actors[0] === p.id)
      .at(-1)!;
    expect(line.causes).toEqual([cause]);
    expect(line.data['roles']).toMatch(/the guard/);
  });

  it('practises an ambition in free time and marks it done with a line and a memory', () => {
    const w = createWorld(sim, 'anvil');
    const p = alive(w)[0]!;
    const skill = (w.entities['skill'] ?? []).find(
      (s) => s['person'] === p.id && s['skill'] === 'crafting',
    )!;
    Object.assign(skill, { level: 1, potential: 10, xp: 0 });
    const set = lines(w, 'people.arrived')[0]!.id;
    addEntity(w, 'ambition', {
      ...{ person: p.id, ambition: 'trade', skill: 'crafting', line: set },
      ...{ since: w.tick, done: 0 },
    });
    // Free time all day: nothing to do but relax.
    step(w, sim, 3 * TICKS_PER_DAY);
    // Practised, and not yet reached: no line until it is.
    expect([skill['level'], (skill['xp'] as number) > 0]).toEqual([1, true]);
    expect(lines(w, 'self.fulfilled')).toEqual([]);
    const trade = content.self.ambitions.find((a) => a.id === 'trade')!;
    Object.assign(skill, { level: trade.to });
    toRoleHour(w);
    const done = lines(w, 'self.fulfilled').find((e) => e.actors[0] === p.id)!;
    expect(done.data['text']).toBe('to learn crafting');
    expect(
      (w.entities['memory'] ?? []).some(
        (m) => m['person'] === p.id && m['memory'] === 'fulfilled' && m['line'] === done.id,
      ),
    ).toBe(true);
  });
});

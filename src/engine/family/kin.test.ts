// P6.1 part 2 (V-161, Morgan's calls): a wed woman and man have a child, who is born to their
// home citing the line she was found with child; an orphan is taken in by a wed couple who cannot
// have their own, citing the parents' deaths; the old die of old age. No lever is involved.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  householdOf,
  step,
  TICKS_PER_DAY,
  type EntityRow,
} from '../index.ts';

// A child found at once, carried two days, and old age certain: the rules read these numbers.
const fam = {
  ...content.family,
  birth: { ...content.family.birth, perMille: 1000, carryDays: 2, leanDays: 0 },
  old: { ...content.family.old, per: 100_000 },
  left: { ...content.family.left, percent: 100 },
};
const sim = createSim({ ...content, family: fam });
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Weds `p` and `q` as the wedding does, citing a line of the world's. */
function wed(w: World, p: EntityRow, q: EntityRow): void {
  Object.assign(p, { partner: q.id, orientation: 'straight' });
  Object.assign(q, { partner: p.id, orientation: 'straight' });
  addEntity(w, 'bond', {
    ...{ a: Math.min(p.id, q.id), b: Math.max(p.id, q.id), close: 80, state: 'wed' },
    ...{ since: w.tick, line: p['arrived'] as number, due: 0, expect: 0, last: 0 },
  });
}

describe('families: children', () => {
  it('a wed couple have a child, born to their home and citing her line', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 60);
    const mother = alive(w).find((x) => x['sex'] === 'f')!;
    const father = alive(w).find((x) => x['sex'] === 'm')!;
    wed(w, mother, father);
    step(w, sim, 4 * TICKS_PER_DAY);
    const expecting = lines(w, 'family.expecting').find((e) => e.actors.includes(mother.id))!;
    const born = lines(w, 'family.born').find((e) => e.causes.includes(expecting.id))!;
    expect(born).toBeDefined();
    const child = alive(w).find((x) => x['bornLine'] === born.id)!;
    expect([child['mother'], child['father'], child['household']]).toEqual([
      mother.id,
      father.id,
      mother.id,
    ]);
    expect(householdOf(w, mother.id)).toContain(child.id);
  });

  it('the old die of old age; their orphan is taken in by a couple who cannot have their own', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 60);
    const [mother, father] = ['f', 'm'].map((s) => alive(w).find((x) => x['sex'] === s)!);
    wed(w, mother!, father!);
    step(w, sim, 4 * TICKS_PER_DAY);
    const child = alive(w).find((x) => x['mother'] === mother!.id)!;
    // Two women of the band wed; then both parents grow old past old age's start and die of it.
    const [a, b] = alive(w).filter((x) => x['sex'] === 'f' && x.id !== mother!.id && x !== child);
    wed(w, a!, b!);
    for (const x of [mother!, father!]) x['born'] = (x['born'] as number) - 70;
    step(w, sim, TICKS_PER_DAY);
    const deaths = lines(w, 'health.died').filter(
      (e) => e.data['cause'] === 'Old age took her.' || e.data['cause'] === 'Old age took him.',
    );
    expect(deaths.map((e) => e.actors[0]).sort()).toEqual([mother!.id, father!.id].sort());
    const taken = lines(w, 'family.takenIn').find((e) => e.actors.includes(child.id))!;
    expect(taken.causes.sort()).toEqual(deaths.map((e) => e.id).sort());
    expect(taken.actors).toEqual(expect.arrayContaining([a!.id, b!.id]));
    expect(child['household']).toBe(a!.id);
  });

  it('a stranger who came hungry leaves a child, and a wed couple with none take them in', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, 60);
    const [a, b, s] = alive(w);
    wed(w, a!, b!);
    // One of the band stands in for a stranger waiting at the green after coming hungry.
    Object.assign(s!, {
      status: 'stranger',
      stranger: s!['arrived'],
      reason: 'hunger',
      partner: 0,
    });
    Object.assign(s!, { waits: w.tick + 10 * TICKS_PER_DAY });
    step(w, sim, TICKS_PER_DAY);
    const left = lines(w, 'family.left').find((e) => e.actors.includes(s!.id))!;
    expect(left.causes).toContain(s!['arrived']);
    const child = (w.entities['person'] ?? []).find((p) => p['left'] === left.id)!;
    const line = lines(w, 'family.takenIn').find((e) => e.actors.includes(child.id))!;
    expect(line.causes).toEqual([left.id]);
    expect([a!.id, b!.id]).toContain(child['household']);
  });
});

// P6.1 (V-161): two unwed adults at leisure together grow closer by how well their traits sit
// together; close enough, they court, and after `court.days` they wed: partners, the wedding
// memory, a feast on the green citing the wedding, and a home settled. No lever is involved.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  bondOf,
  createSim,
  createWorld,
  likeOf,
  step,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  type EntityRow,
} from '../index.ts';
import { hourTogether } from './close.ts';

// Two days of courting rather than a month keeps the run short; the rule reads `court.days`.
const fam = { ...content.family, court: { ...content.family.court, days: 2 } };
const sim = createSim({ ...content, family: fam });
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** A woman and a man of the band, and the world. */
function couple(seed: string): { w: World; p: EntityRow; q: EntityRow } {
  const w = createWorld(sim, seed);
  step(w, sim, 60);
  const p = alive(w).find((x) => x['sex'] === 'f')!;
  const q = alive(w).find((x) => x['sex'] === 'm')!;
  for (const x of [p, q]) x['orientation'] = 'straight';
  return { w, p, q };
}

/** Runs on to just after the family's morning. */
function toMorning(w: World): void {
  const at = fam.hour * TICKS_PER_HOUR + 1;
  const wait = (at - (w.tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY;
  step(w, sim, wait || TICKS_PER_DAY);
}

describe('families: courtship and weddings', () => {
  it('an hour at leisure side by side brings two closer by how well they sit together', () => {
    const { w, p, q } = couple('smoke');
    for (const x of [p, q]) Object.assign(x, { doing: 'relax', z: 0 });
    Object.assign(q, { x: p['x'], y: (p['y'] as number) + fam.near });
    hourTogether(w, sim.content);
    const like = likeOf(w, sim.content, p.id, q.id);
    expect(bondOf(w, p.id, q.id)?.['close'] ?? 0).toBe(like);
    // One step further apart and the hour does not count.
    Object.assign(q, { y: (p['y'] as number) + fam.near + 1 });
    hourTogether(w, sim.content);
    expect(bondOf(w, p.id, q.id)?.['close'] ?? 0).toBe(like);
  });

  it('everyone is drawn to someone or no one, and only two drawn to each other grow close', () => {
    const { w, p, q } = couple('smoke');
    const kinds = fam.orientations.map((o) => o.id);
    for (const x of alive(w)) expect(kinds).toContain(x['orientation']);
    for (const x of [p, q]) Object.assign(x, { doing: 'relax', z: 0, x: 10, y: 10 });
    // He is drawn to men: nothing grows between them.
    q['orientation'] = 'gay';
    hourTogether(w, sim.content);
    expect(bondOf(w, p.id, q.id)).toBeUndefined();
    // Drawn to both, he and she grow closer.
    q['orientation'] = 'bisexual';
    hourTogether(w, sim.content);
    const like = likeOf(w, sim.content, p.id, q.id);
    expect(like).toBeGreaterThan(0);
    expect(bondOf(w, p.id, q.id)?.['close']).toBe(like);
  });

  it('two grown close court, wed after the courting days and feast on the green', () => {
    const { w, p, q } = couple('smoke');
    addEntity(w, 'bond', {
      ...{ a: Math.min(p.id, q.id), b: Math.max(p.id, q.id), close: fam.court.from + 5 },
      ...{ state: '', since: 0, line: 0 },
    });
    toMorning(w);
    const courting = lines(w, 'family.courting').find((e) => e.actors.includes(p.id))!;
    expect(courting.actors).toEqual(expect.arrayContaining([p.id, q.id]));
    step(w, sim, fam.court.days * TICKS_PER_DAY);
    const wed = lines(w, 'family.wed').find((e) => e.actors.includes(p.id))!;
    expect(wed.causes).toContain(courting.id);
    expect([p['partner'], q['partner']]).toEqual([q.id, p.id]);
    const married = (w.entities['memory'] ?? []).filter(
      (m) => m['memory'] === fam.memories.wed && m['line'] === wed.id,
    );
    expect(married.map((m) => m['person']).sort()).toEqual([p.id, q.id].sort());
    step(w, sim, TICKS_PER_DAY);
    const feast = lines(w, 'family.feast').find((e) => e.causes.includes(wed.id));
    const none = lines(w, 'family.noFeast').find((e) => e.causes.includes(wed.id));
    expect(feast ?? none).toBeDefined();
    if (feast) expect(feast.data['where']).toBe('round the fire on the green');
  });
});

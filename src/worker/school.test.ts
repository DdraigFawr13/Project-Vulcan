// The schoolroom on the page (6B Bundle 6, V-189 q7): the Build sheet's Schoolroom row says why it
// waits, then who teaches and how many books stand on the shelf; the inspector says who is
// teaching, at lessons, writing a book or reading one. All words of the engine's state (GAME-02).
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  addEntity,
  buildSystem,
  createSim,
  createWorld,
  finishPlan,
  plansOf,
  schoolHouse,
  standingSchool,
  step,
  TICKS_PER_HOUR,
  withoutAccidents,
} from '../engine/index.ts';
import { contextFor } from '../engine/sim/system.ts';
import { doingOf, nowOf } from './doing.ts';
import { schoolRow } from './school.ts';

describe('the schoolroom on the page', () => {
  it('waits for the harvest home, then names its teacher, its books and the work at it', () => {
    const sim = createSim(withoutAccidents(content));
    const w = createWorld(sim, 'anvil');
    step(w, sim, TICKS_PER_HOUR);
    expect(schoolRow(w)).toMatchObject({ want: { level: 3, word: 'third' } });
    expect(schoolRow(w).need).toBe('waits for the first harvest home');
    addEntity(w, 'feast', {
      ...{ line: w.begunEvent, year: 1, state: 'eaten', start: 0, there: [], eaten: w.begunEvent },
      ...{ couple: [], on: 0, holy: 0, lean: 0 },
    });
    addEntity(w, 'want', { kind: 'tavern', level: 4, line: 0 });
    addEntity(w, 'want', { kind: 'school', level: 1, line: 0 });
    for (let h = 0; h < 3 && !schoolHouse(w); h += 1) step(w, sim, TICKS_PER_HOUR);
    const h = schoolHouse(w)!;
    expect(schoolRow(w).plan!.words).toMatch(/^A cottage .+ of the green: planned\.$/);
    expect(schoolRow(w).plan).toMatchObject({ id: h.id, back: true, sent: false });
    const ctx = contextFor(w, sim, buildSystem);
    for (const p of plansOf(w).filter((r) => r['house'] === h.id))
      finishPlan(ctx, p, h['line'] as number);
    step(w, sim, 2 * TICKS_PER_HOUR);
    const teacher = (w.entities['person'] ?? []).find(
      (p) => p.id === standingSchool(w)!['teacher'],
    )!;
    expect(schoolRow(w).need).toBe(
      `the schoolroom stands; ${teacher['name'] as string} teaches; no books on the shelf`,
    );
    // At their teaching, and a reader at a book: the strip and the sentence say so.
    Object.assign(teacher, { doing: 'work', job: 'teach', path: [] });
    expect(doingOf(teacher)).toBe('Teaching');
    expect(nowOf(w, teacher).text).toBe(content.work.doing['teach']);
    const book = addEntity(w, 'book', {
      ...{ master: teacher.id, skill: 'crafting', level: 10, scribe: teacher.id },
      ...{ state: 'kept', minutes: 480, begun: w.begunEvent, line: w.begunEvent, lost: 0 },
    });
    Object.assign(teacher, { doing: 'relax', job: 'read', target: book });
    expect(doingOf(teacher)).toBe('Reading');
    expect(nowOf(w, teacher)).toEqual({
      text: `Reading the book of crafting, ${teacher['name'] as string}'s method at the schoolroom.`,
      why: w.begunEvent,
    });
    expect(schoolRow(w).need).toContain('1 book on the shelf');
  });
});

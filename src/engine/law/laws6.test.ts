// P6.5, V-157: the Rations, Punishment and Sickness laws. Setting a law is the player's only say,
// and every answer to it is a ledger line citing the setting. Under short rations a keeper stops
// eating at the day's share; a refuser eats a full plate, and whoever sees it remembers it.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  memoriesOf,
  step,
  submitCommand,
  TICKS_PER_DAY,
} from '../index.ts';

const sim = createSim(content);
type World = ReturnType<typeof createWorld>;
const alive = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const answersTo = (w: World, law: string) =>
  (w.entities['answer'] ?? []).filter((a) => a['law'] === law);

function setLaw(w: World, law: string, setting: string): void {
  submitCommand(w, { tick: w.tick + 1, kind: 'setLaw', data: { law, setting } });
  step(w, sim, 2);
}

describe('the 6A laws', () => {
  it('answers every new setting with a line per person, citing the setting', () => {
    const w = createWorld(sim, 'anvil');
    step(w, sim, 60);
    for (const id of ['rations', 'punishment', 'sickness']) {
      const def = content.laws.laws.find((l) => l.id === id)!;
      for (const s of def.settings.filter((x) => x.id !== def.start)) {
        setLaw(w, id, s.id);
        const set = lines(w, 'law.set').at(-1)!;
        expect(set.data['setting']).toBe(s.name);
        const rows = answersTo(w, id);
        expect(rows.map((a) => a['person']).sort()).toEqual(
          alive(w)
            .map((p) => p.id)
            .sort(),
        );
        for (const a of rows) {
          const line = lines(w, 'law.answered').find((e) => e.id === a['line'])!;
          expect(line.causes).toContain(set.id);
          expect(line.data['days']).toBe(s.days);
        }
      }
      // The custom asks nothing: back at the start, nobody answers.
      setLaw(w, id, def.start);
      expect(answersTo(w, id)).toEqual([]);
    }
  });

  it('holds a keeper to the share, and a refuser eating past it is seen', () => {
    const w = createWorld(sim, 'smoke');
    step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) + 30);
    setLaw(w, 'rations', 'hunger');
    const [keeper, refuser] = alive(w);
    const rows = answersTo(w, 'rations');
    const rowOf = (id: number) => rows.find((a) => a['person'] === id)!;
    // Their answers are fixed for the test: a changed answer is held `settle` days.
    Object.assign(rowOf(keeper!.id), { answer: 'obeys', at: w.tick });
    Object.assign(rowOf(refuser!.id), { answer: 'refuses', at: w.tick });
    step(w, sim, 3 * TICKS_PER_DAY);
    // Half a full day's food at most: the keeper's share never runs more than a meal behind.
    expect(rowOf(keeper!.id)['left'] as number).toBeGreaterThan(-6000);
    expect(memoriesOf(w, keeper!.id).map((m) => m['memory'])).toContain('short-meals-hard');
    const full = lines(w, 'law.keptCustom').filter((e) => e.actors?.includes(refuser!.id));
    expect(full.length).toBeGreaterThan(0);
    const answered = lines(w, 'law.answered').find((e) => e.id === full[0]!.causes[0]);
    expect(answered?.actors).toEqual([refuser!.id]);
    // A full plate is a line at most once a week, and whoever saw it remembers it.
    expect(full.length).toBe(1);
    const seen = lines(w, 'law.saw').find((e) => e.causes.includes(full[0]!.id))!;
    expect(seen.actors!.length).toBeGreaterThan(0);
    for (const q of seen.actors!)
      expect(memoriesOf(w, q).some((m) => m['memory'] === 'saw-refused-rations')).toBe(true);
  });
});

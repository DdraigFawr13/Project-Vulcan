// P6.5, V-157: the Rations, Punishment and Sickness laws (and 6B's Hearths). Setting a law is the player's only say,
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
    for (const id of ['rations', 'punishment', 'sickness', 'hearths']) {
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

  /** Short rations with one keeper and one refuser fixed, three days on. */
  function rations(seed: string) {
    const w = createWorld(sim, seed);
    step(w, sim, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) + 30);
    setLaw(w, 'rations', 'hunger');
    const [keeper, refuser] = alive(w);
    const rows = answersTo(w, 'rations');
    const rowOf = (id: number) => rows.find((a) => a['person'] === id)!;
    // Their answers are fixed for the test: a changed answer is held `settle` days.
    Object.assign(rowOf(keeper!.id), { answer: 'obeys', at: w.tick });
    Object.assign(rowOf(refuser!.id), { answer: 'refuses', at: w.tick });
    step(w, sim, 3 * TICKS_PER_DAY);
    const full = lines(w, 'law.keptCustom').filter((e) => e.actors?.includes(refuser!.id));
    return {
      w,
      keeper: keeper!,
      refuser: refuser!,
      left: rowOf(keeper!.id)['left'] as number,
      full,
    };
  }

  it('holds a keeper to the share, and a refuser eating past it is seen', () => {
    const { w, keeper, refuser, left, full } = rations('smoke');
    // Half a full day's food at most: the keeper's share never runs more than a meal behind.
    expect(left).toBeGreaterThan(-6000);
    expect(memoriesOf(w, keeper.id).map((m) => m['memory'])).toContain('short-meals-hard');
    expect(full.length).toBeGreaterThan(0);
    const answered = lines(w, 'law.answered').find((e) => e.id === full[0]!.causes[0]);
    expect(answered?.actors).toEqual([refuser.id]);
    // A full plate is a line at most once a week.
    expect(full.length).toBe(1);
    // Whoever saw it remembers it: the first test seed where someone was by to see it.
    let seen: { x: World; saw: ReturnType<typeof lines>[number] } | undefined;
    for (const seed of ['smoke', 'anvil', 'tallow', 'ledger']) {
      const r = seed === 'smoke' ? { w, full } : rations(seed);
      const saw = lines(r.w, 'law.saw').find((e) => e.causes.includes(r.full[0]?.id ?? -1));
      if (saw) {
        seen = { x: r.w, saw };
        break;
      }
    }
    expect(seen).toBeDefined();
    expect(seen!.saw.actors!.length).toBeGreaterThan(0);
    for (const q of seen!.saw.actors!)
      expect(memoriesOf(seen!.x, q).some((m) => m['memory'] === 'saw-refused-rations')).toBe(true);
  });

  it('carries the share over a change of setting, and a newcomer answers the law', () => {
    const w = createWorld(sim, 'tallow');
    step(w, sim, 60);
    const [late, other] = alive(w);
    // `late` stands for someone who joins after the law is set.
    late!['status'] = 'stranger';
    setLaw(w, 'rations', 'hunger');
    const set = lines(w, 'law.set').at(-1)!;
    expect(answersTo(w, 'rations').some((a) => a['person'] === late!.id)).toBe(false);
    const rowOf = (id: number) => answersTo(w, 'rations').find((a) => a['person'] === id)!;
    rowOf(other!.id)['left'] = -100;
    // Moving the law to another share fills no plates.
    setLaw(w, 'rations', 'short');
    expect(rowOf(other!.id)['left']).toBe(-100);
    late!['status'] = 'alive';
    step(w, sim, 60);
    const line = lines(w, 'law.answered').find((e) => e.id === rowOf(late!.id)['line'])!;
    expect(line.causes).toContain(lines(w, 'law.set').at(-1)!.id);
    expect(set.id).not.toBe(lines(w, 'law.set').at(-1)!.id);
  });
});

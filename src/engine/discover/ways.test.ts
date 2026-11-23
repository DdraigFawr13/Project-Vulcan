// 6C Slice 5 part 2 (V-218): a work hint that goes wrong writes its mishap line; New Ways answers
// are law events, and a keeper of Old ways only begins no puzzle; a way passes to someone working
// beside its knower; a knower's death with nobody else knowing writes the loss line.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import {
  addEntity,
  allLines,
  createSim,
  createWorld,
  die,
  discoverSystem,
  healthSystem,
  step,
  submitCommand,
  TICKS_PER_HOUR,
  type EngineContent,
  type EntityRow,
} from '../index.ts';
import { contextFor } from '../sim/system.ts';
import { lossHour } from './spread.ts';
import { knows } from './tables.ts';
import { waysOf } from './ways.ts';

type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);
const living = (w: World) => (w.entities['person'] ?? []).filter((p) => p['status'] === 'alive');

/** Content whose custom New Ways setting makes every work hint go wrong. */
function everyHintWrong(): EngineContent {
  const laws = content.laws.laws.map((l) =>
    l.id !== 'new-ways'
      ? l
      : {
          ...l,
          settings: l.settings.map((s) =>
            s.id === 'allowed' ? { ...s, ways: { ...s.ways!, mishap: 1 } } : s,
          ),
        },
  );
  return { ...content, laws: { ...content.laws, laws } };
}

/** anvil's band, the first two people smiths at smithing 7, at the forge every hour. */
function forge(c: EngineContent = content) {
  const sim = createSim(c);
  const w = createWorld(sim, 'anvil');
  const smiths = living(w).slice(0, 2) as [EntityRow, EntityRow];
  for (const p of smiths) {
    const row = w.entities['skill']!.find((s) => s['person'] === p.id && s['skill'] === 'smithing');
    if (row) row['level'] = 7;
    else addEntity(w, 'skill', { person: p.id, skill: 'smithing', level: 7, potential: 10 });
  }
  const ctx = contextFor(w, sim, discoverSystem);
  const hours = (n: number, who: EntityRow[] = smiths.slice(0, 1)) => {
    for (let h = 0; h < n; h += 1) {
      w.tick += TICKS_PER_HOUR;
      for (const p of who) Object.assign(p, { doing: 'work', job: 'smith' });
      discoverSystem.run!(ctx);
    }
  };
  return { sim, w, smiths, ctx, hours };
}

describe('mishaps, New Ways, spreading and loss', () => {
  it('a work hint that goes wrong writes a mishap line citing it', () => {
    const { w, smiths, hours } = forge(everyHintWrong());
    hours(3 * 24 + content.methods.work);
    const [hint] = lines(w, 'discover.hint').filter((e) => e.data['kind'] === 'work');
    const [mishap] = lines(w, 'discover.mishap');
    expect(mishap?.actors).toEqual([smiths[0].id]);
    expect(mishap?.causes).toEqual([hint!.id]);
    expect(lines(w, 'health.died')).toEqual([]);
  });

  it('answers New Ways as law events; a keeper of Old ways only begins no puzzle', () => {
    const { sim, w, hours } = forge();
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setLaw',
      data: { law: 'new-ways', setting: 'old' },
    });
    step(w, sim, 2);
    const set = lines(w, 'law.set').at(-1)!;
    const answered = lines(w, 'law.answered').filter((e) => e.causes.includes(set.id));
    expect(answered.map((e) => e.actors[0]).sort()).toEqual(
      living(w)
        .map((p) => p.id)
        .sort(),
    );
    const keeps = (w.entities['answer'] ?? []).find(
      (a) => a['law'] === 'new-ways' && a['answer'] !== 'refuses',
    );
    const smith = living(w).find((p) => p.id === keeps?.['person'])!;
    hours(3 * 24, [smith]);
    expect(lines(w, 'discover.puzzle').filter((e) => e.actors[0] === smith.id)).toEqual([]);
    // Someone who refuses Old ways only keeps the custom, Allowed.
    keeps!['answer'] = 'refuses';
    expect(waysOf(w, sim.content, smith.id).start).toBe(true);
  });

  it('shares a work hint with a workmate puzzling over the same way, in one line', () => {
    const { w, smiths, hours } = forge();
    hours(3 * 24, smiths);
    const begun = lines(w, 'discover.puzzle').filter((e) => e.data['method'] === 'steel');
    expect(begun.map((e) => e.actors[0]).sort()).toEqual(smiths.map((p) => p.id).sort());
    hours(content.methods.work, smiths);
    const [hint] = lines(w, 'discover.hint').filter((e) => e.data['kind'] === 'work');
    expect(hint?.actors).toEqual([smiths[0].id, smiths[1].id]);
    const rows = (w.entities['hint'] ?? []).filter((h) => h['line'] === hint!.id);
    expect(rows.length).toBe(2);
  });

  it('teaches a way to someone working beside its knower', () => {
    const { w, smiths, hours } = forge();
    const [knower, learner] = smiths;
    addEntity(w, 'knows', { person: knower.id, method: 'steel', how: 'found', line: 1, from: 0 });
    hours(content.methods.spread.beside, smiths);
    const [learned] = lines(w, 'discover.learned');
    expect(learned?.actors).toEqual([learner.id, knower.id]);
    expect(knows(w, learner.id, 'steel')).toBe(true);
  });

  it('writes the loss line when the last knower dies, citing the death', () => {
    const { sim, w, smiths, ctx } = forge();
    const [knower] = smiths;
    addEntity(w, 'knows', { person: knower.id, method: 'steel', how: 'found', line: 1, from: 0 });
    lossHour(ctx);
    expect(lines(w, 'discover.lost')).toEqual([]);
    die(contextFor(w, sim, healthSystem), knower, 'old age', []);
    lossHour(ctx);
    const [lost] = lines(w, 'discover.lost');
    const [death] = lines(w, 'health.died');
    expect(lost?.actors).toEqual([knower.id]);
    expect(lost?.causes).toEqual([death!.id]);
  });

  it('a kept book by the knower keeps the way from being lost', () => {
    const { sim, w, smiths, ctx } = forge();
    const [knower] = smiths;
    addEntity(w, 'knows', { person: knower.id, method: 'steel', how: 'found', line: 1, from: 0 });
    addEntity(w, 'book', {
      ...{ master: knower.id, skill: 'smithing', level: 7, scribe: knower.id, state: 'kept' },
      ...{ minutes: 0, begun: 1, line: 1, lost: 0 },
    });
    lossHour(ctx);
    die(contextFor(w, sim, healthSystem), knower, 'old age', []);
    lossHour(ctx);
    expect(lines(w, 'discover.lost')).toEqual([]);
  });
});

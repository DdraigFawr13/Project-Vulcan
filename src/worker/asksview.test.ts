// 6C Slice 4 (V-237): the Asks sheet in words. An unanswered ask counts towards the red count; a
// taken one shows its priority word and what is made so far; the lord's card gives favour moves
// from content, doubled for a temper that doubles them; a guest's ask is yes or no with its
// deadline; a settled ask's line is among the closed.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { addEntity, createSim, createWorld, emit, type SimEvent } from '../engine/index.ts';
import { asksView } from './asksview.ts';
import type { LedgerLine } from './protocol.ts';

const line = (e: unknown) => ({ id: (e as SimEvent).id }) as LedgerLine;

function world() {
  const sim = createSim(content);
  const w = createWorld(sim, 'ledger');
  const begun = w.begunEvent;
  const ask = (more: Record<string, unknown>) =>
    addEntity(w, 'ask', {
      ...{ source: 'lord', asker: 'Warlord Ogrgul', what: 'a fine blade for his hall' },
      ...{ tool: 'blade', good: '', quality: 'fine', count: 1, got: 0, held: '', cite: begun },
      ...{ line: begun, due: 0, state: 'open', level: 0, answer: 0, going: [], settled: 0 },
      ...{ made: 0, of: '', pieces: [], tried: 0 },
      ...more,
    });
  return { sim, w, ask };
}

describe('the Asks sheet', () => {
  it('counts the unanswered, words a taken ask and the lord’s favour moves', () => {
    const { w, ask } = world();
    const open = ask({});
    const taken = ask({ state: 'taken', level: 2 });
    const view = asksView(w, line);
    expect(view.waiting).toBe(1);
    expect(view.open.map((c) => c.id)).toEqual([open]);
    const card = view.taken[0]!;
    expect(card.id).toBe(taken);
    expect(card.levelWord).toBe(content.work.priority.words[1]);
    expect(card.says).toMatch(/^A fine blade for his hall, by his next visit/);
    expect(card.progress).toMatch(/^Not made yet: 0 of 1\./);
    const c = content.lord.favour.causes;
    expect(card.costs).toContain(`Let pass: −${Math.abs(c['askPassed']!.by)}.`);
    // A cruel lord doubles what passing costs.
    addEntity(w, 'lord', { temper: content.asks.lord.double[0]!, steps: [] });
    expect(asksView(w, line).taken[0]!.costs).toContain(
      `Let pass: −${Math.abs(c['askPassed']!.by * 2)}.`,
    );
  });

  it('gives a guest a yes or no with its deadline, and lists a settled ask’s line', () => {
    const { sim, w, ask } = world();
    ask({ source: 'guest', asker: 'Varguz', what: 'a bed in the hall for a season' });
    const done = emit(w, sim.templates, 'ask.passed', {
      causes: [w.begunEvent],
      data: { what: 'a fine blade', asker: 'Warlord Ogrgul' },
    });
    w.entities['ask']![0]!['good'] = 'guest';
    w.entities['ask']![0]!['due'] = w.tick + 60;
    ask({ state: 'passed', settled: done });
    const view = asksView(w, line);
    const guest = view.open[0]!;
    expect(guest.yesNo).toBe(true);
    expect(guest.says).toBe('A bed in the hall for a season.');
    expect(guest.answerBy).toMatch(/^Answer by \d\d:\d\d today, or they go on their way\.$/);
    expect(view.passed).toEqual([]);
    expect(view.closed.map((l) => l.id)).toEqual([done]);
  });
});

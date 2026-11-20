// 6B Bundle 4 (P6.8, V-187): a shrine's tile rows name its faith, its keeper and who prayed this
// week; the Memories tab shows a person's faith and what it holds sacred; the Feasts law lists the
// harvest home and each day asked for, with whether the law keeps it.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  addEntity,
  createSim,
  createWorld,
  creedsOf,
  faithOf,
  holydaysOf,
  shrineOf,
  step,
  TICKS_PER_HOUR,
  type SimEvent,
  type Stub,
} from '../engine/index.ts';
import { faithSelf, feastDaysView } from './faithview.ts';
import { tilePiece } from './furniture.ts';

const sim = createSim(content);
const lineOf = (e: SimEvent | Stub) =>
  ({ id: e.id, tick: e.tick, type: e.type, text: e.type }) as never;

describe('faith on the page', () => {
  it('shows the shrine, the faith line and the feast days', () => {
    const w = createWorld(sim, 'anvil');
    step(w, sim, TICKS_PER_HOUR);
    // The first harvest home is the reason to gather (the engine test runs to a real one).
    addEntity(w, 'feast', {
      ...{ line: w.begunEvent, year: 1, state: 'eaten', start: 0, there: [], eaten: w.begunEvent },
      ...{ couple: [], on: 0, holy: 0, lean: 0 },
    });
    const creed = creedsOf(w)[0]!;
    for (let h = 0; h < 25 && !creed['priest']; h += 1) step(w, sim, TICKS_PER_HOUR);
    const shrine = shrineOf(w, creed)!;
    Object.assign(shrine, { state: 'built', made: creed['line'], work: 0 });
    const priest = (w.entities['person'] ?? []).find((p) => p.id === creed['priest'])!;
    faithOf(w, priest.id)!['prayed'] = w.tick;

    const piece = tilePiece(w, shrine['x'] as number, shrine['y'] as number, lineOf)!.piece;
    expect(piece.name).toBe('spring-stone');
    expect(piece.shrine).toMatchObject({
      faith: expect.stringMatching(/^The Wells, held by \d+$/),
      keeper: `${priest['name'] as string}, Wellkeeper`,
      prayed: `prayed here: ${priest['name'] as string}`,
    });
    expect(piece.shrine!.named!.id).toBe(creed['named']);

    const faith = faithSelf(w, priest)!;
    expect(faith.text).toMatch(/^The Wells · (lukewarm|faithful|devout) · Wellkeeper$/);
    expect(faith.note).toBe('Holds kin and learning sacred; abhors war.');
    expect(faith.why).toBe(creed['named']);

    const days = feastDaysView(w);
    expect(days[0]).toEqual({
      text: 'Harvest home, when the last field is in',
      note: 'Kept every year.',
      why: w.begunEvent,
    });
    const cart = holydaysOf(w).find((d) => d['kind'] === 'arrival')!;
    expect(days[1]).toEqual({
      text: expect.stringMatching(/^Cart Day, \d+ \w+$/),
      note: 'The day the cart stopped in the valley. Not yet kept.',
      why: cart['line'],
    });
  });
});

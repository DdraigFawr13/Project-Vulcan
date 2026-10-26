// V-135: with a lit hearth, fat in the store, the Candles plate short and Candlemaking first on
// the Work sheet, someone takes up candlemaking (no order) and tallow candles appear, the line
// citing the taking up; a fire that burns gathers ash in its pit; soap cuts a wound's festering.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, itemsOf, step, submitCommand } from '../index.ts';
import { people } from './spots.ts';
import { firesOf } from '../fire/index.ts';
import { layItem, stockOf, storeOf } from '../goods/index.ts';

// Every month at -12 degrees: the campfire is built and lit early and stays lit.
const winter = {
  ...content,
  seasons: { ...content.seasons, months: content.seasons.months.map(() => -12) },
};
const sim = createSim(winter);
const DAY = 1440;
const count = (w: ReturnType<typeof createWorld>, kind: string): number =>
  itemsOf(w)
    .filter((i) => i['kind'] === kind)
    .reduce((n, i) => n + (i['count'] as number), 0);

describe('the chandler', () => {
  it('dips candles from fat at a lit fire once the Work sheet puts it first, citing the taking up', () => {
    const w = createWorld(sim, 'ledger');
    // The lever is the Work sheet's row (indirect): nobody is told to make a candle.
    for (const p of people(w))
      submitCommand(w, {
        tick: w.tick + 1,
        kind: 'setPriority',
        data: { person: p.id, job: 'chandle', level: 1 },
      });
    const at = storeOf(w).find(
      (s) => !itemsOf(w).some((i) => i['x'] === s['x'] && i['y'] === s['y']),
    )!;
    layItem(w, {
      kind: 'fat',
      count: 4,
      x: at['x'] as number,
      y: at['y'] as number,
      z: 0,
      made: 1,
    });
    stockOf(w, 'candles')!['level'] = 'plenty';
    const before = count(w, 'candle');
    step(w, sim, 12 * DAY);
    expect(w.commandLog.every((c) => c.kind === 'setPriority')).toBe(true);
    const took = allLines(w).filter((e) => e.type === 'lamp.tookUp');
    const dipped = allLines(w).filter((e) => e.type === 'lamp.dipped');
    expect(took.length).toBeGreaterThan(0);
    expect(dipped.length).toBeGreaterThan(0);
    expect(String(took[0]!.data['why'])).toMatch(/^candles are short: \d+ of 30$/);
    expect(dipped[0]!.data).toMatchObject({ count: 12, what: 'tallow candles', from: '1 fat' });
    // Read through the causes (the run is long enough for the start of the ledger to be sealed).
    expect(took.map((e) => e.id)).toContain(dipped[0]!.causes[0]);
    expect(count(w, 'candle')).toBeGreaterThan(before);
  });

  it('boils soap from fat and ash when the store holds none', () => {
    const w = createWorld(sim, 'ledger');
    const free = () =>
      storeOf(w).find((s) => !itemsOf(w).some((i) => i['x'] === s['x'] && i['y'] === s['y']))!;
    for (const [kind, n] of [
      ['fat', 2],
      ['ash', 6],
    ] as const) {
      const at = free();
      layItem(w, { kind, count: n, x: at['x'] as number, y: at['y'] as number, z: 0, made: 1 });
    }
    step(w, sim, 6 * DAY);
    const took = allLines(w).filter((e) => e.type === 'lamp.tookUp');
    expect(took.map((e) => e.data['why'])).toContain('the healer has no soap');
    const soap = allLines(w).find((e) => e.type === 'lamp.dipped' && e.data['what'] === 'soap');
    expect(soap?.data).toMatchObject({ count: 2, from: '1 fat and 3 wood ash' });
    expect(count(w, 'soap')).toBeGreaterThanOrEqual(2);
  });

  it("gathers ash in a burning hearth's pit, up to `ash.keep`, for the soap", () => {
    const w = createWorld(sim, 'ledger');
    step(w, sim, 8 * DAY);
    const { every, keep } = content.lamp.ash;
    const fires = firesOf(w);
    expect(fires.some((f) => (f['ash'] as number) >= every)).toBe(true);
    expect(fires.every((f) => (f['ash'] as number) <= keep * every)).toBe(true);
    // None of it lies about for haulers.
    expect(count(w, content.lamp.ash.item)).toBe(0);
  });
});

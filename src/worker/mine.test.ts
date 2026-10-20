// Shafts as the page shows them (Bundle 2): the faint plan on the map, the plan's tile page with
// Send back allowed once, the signal for the Mining row, the ore aside on the ingot plates and the
// mine lines on a miner's "doing now". Nothing here names a tile or a person to command (V-041).
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import {
  createSim,
  createWorld,
  shaftsOf,
  step,
  submitCommand,
  type SimEvent,
  type Stub,
} from '../engine/index.ts';
import { goodsOf, stockView } from './goods.ts';
import { miningShown } from './mine.ts';
import { walkersOf } from './people.ts';
import { tileView } from './views.ts';

const sim = createSim(content);
const DAY = 1440;
const lineOf = (e: SimEvent | Stub) =>
  ({ id: e.id, tick: e.tick, type: e.type, text: e.type }) as never;

describe('shaft views', () => {
  it('shows no Mining row and no plate ore until a plate is raised', () => {
    const w = createWorld(sim, 'smoke');
    expect(miningShown(w)).toBe(false);
    expect(goodsOf(w).shafts).toEqual([]);
    const notes = Object.fromEntries(stockView(w).map((s) => [s.good, s.note]));
    expect(notes['iron-ingot']).toContain('0 iron ore in the store.');
    expect(notes['copper-ingot']).toContain('0 copper ore in the store.');
    expect(notes['tin-ingot']).toContain('0 tin ore in the store.');
    expect(notes['stone']).toBe('Rock dug out of tunnels comes up as stone.');
  });

  it('gives a planned shaft its page, a faint plan and one Send back', () => {
    const w = createWorld(sim, 'smoke');
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'iron-ingot', level: 'some' },
    });
    step(w, sim, DAY);
    const row = shaftsOf(w)[0]!;
    expect(miningShown(w)).toBe(true);
    const [x, y] = [row['x'] as number, row['y'] as number];
    expect(goodsOf(w).shafts).toEqual([{ x, y, z: 0, state: 'planned' }]);
    const page = tileView(w, x, y, 0, lineOf)!.shaft!;
    expect(page.what).toBe(`a shaft with a ladder, down to level ${row['to'] as number}`);
    expect(page.why).toContain('Iron is wanted');
    expect(page.work).toMatch(
      /^about 4 hours a level, \d+ in all, by whoever takes up Mining; 2 logs for the ladder$/,
    );
    expect(page.back).toBe(true);
    expect(page.placed?.type).toBe('mine.shaftPlanned');
    // Send back works once: the replacement is planned elsewhere and cannot be sent back.
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBackShaft', data: { shaft: page.id } });
    step(w, sim, 2);
    expect(tileView(w, x, y, 0, lineOf)!.shaft).toBeUndefined();
    const next = goodsOf(w).shafts;
    expect(next).toHaveLength(1);
    expect(next[0]).not.toMatchObject({ x, y });
    expect(tileView(w, next[0]!.x, next[0]!.y, 0, lineOf)!.shaft!.back).toBe(false);
  });

  it('offers no Send back once a miner has taken up sinking', () => {
    const w = createWorld(sim, 'smoke');
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'iron-ingot', level: 'some' },
    });
    for (let n = 0; n < 12 * 48; n += 1) {
      step(w, sim, 30);
      const miner = (w.entities['person'] ?? []).find((p) => p['task'] === 'sink');
      if (!miner) continue;
      const row = shaftsOf(w).find((s) => s.id === miner['plan'])!;
      const page = tileView(w, row['x'] as number, row['y'] as number, 0, lineOf)!.shaft!;
      expect(page.here).toBeDefined();
      expect(page.back).toBe(false);
      return;
    }
    throw new Error('no miner took up sinking');
  });

  it('says what the miners are doing in words, never a raw key', () => {
    const w = createWorld(sim, 'smoke');
    submitCommand(w, {
      tick: w.tick + 1,
      kind: 'setStock',
      data: { good: 'iron-ingot', level: 'some' },
    });
    const doing = new Set<string>();
    for (let n = 0; n < 12 * 24; n += 1) {
      step(w, sim, 60);
      for (const p of walkersOf(w)) doing.add(p.now.text);
    }
    const mining = [...doing].filter((t) => /shaft|vein|ore/i.test(t));
    expect(mining.length).toBeGreaterThan(0);
    for (const t of mining) expect(t).not.toMatch(/[{}]|^(sink|tunnel|mine|clay)$/);
  });
});

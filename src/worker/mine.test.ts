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
  type WorldState,
} from '../engine/index.ts';
import { goodsOf, stockView } from './goods.ts';
import { miningShown } from './mine.ts';
import { walkersOf } from './people.ts';
import { tileView } from './views.ts';

const sim = createSim(content);
// One smoke world is made per file; a test that changes it takes a clone (~5 ms, a world is
// ~0.3 s). The last three tests start alike (iron raised at once, then days of stepping), so they
// share one run in half-hour steps and read it where each used to read its own.
let base: WorldState | undefined;
const fresh = () => structuredClone((base ??= createWorld(sim, 'smoke')));
const run = (() => {
  let w: WorldState | undefined;
  let steps = 0;
  const doing = new Set<string>();
  let dayAfter: WorldState | undefined;
  let sinking: WorldState | undefined;
  /** Steps the run on to half-hour `n` (a day is 48), or until `stop()`, keeping what each test reads. */
  const advance = (n: number, stop: () => boolean = () => false) => {
    if (!w) {
      w = fresh();
      submitCommand(w, {
        tick: w.tick + 1,
        kind: 'setStock',
        data: { good: 'iron-ingot', level: 'some' },
      });
    }
    while (steps < n && !stop()) {
      step(w, sim, 30);
      steps += 1;
      if (steps === 48) dayAfter = structuredClone(w);
      if (!sinking && (w.entities['person'] ?? []).some((p) => p['task'] === 'sink'))
        sinking = structuredClone(w);
      if (steps % 2 === 0) for (const p of walkersOf(w)) doing.add(p.now.text);
    }
  };
  return {
    day: () => (advance(48), dayAfter!),
    sink: () => (advance(12 * 48, () => !!sinking), sinking),
    words: () => (advance(12 * 24 * 2), doing),
  };
})();
const lineOf = (e: SimEvent | Stub) =>
  ({ id: e.id, tick: e.tick, type: e.type, text: e.type }) as never;

describe('shaft views', () => {
  it('shows no Mining row and no plate ore until a plate is raised', () => {
    const w = fresh();
    expect(miningShown(w)).toBe(false);
    expect(goodsOf(w).shafts).toEqual([]);
    const notes = Object.fromEntries(stockView(w).map((s) => [s.good, s.note]));
    expect(notes['iron-ingot']).toContain('0 iron ore in the store.');
    expect(notes['copper-ingot']).toContain('0 copper ore in the store.');
    expect(notes['tin-ingot']).toContain('0 tin ore in the store.');
    expect(notes['stone']).toBe('Rock dug out of tunnels comes up as stone.');
  });

  it('gives a planned shaft its page, a faint plan and one Send back', () => {
    const w = run.day();
    const row = shaftsOf(w)[0]!;
    expect(miningShown(w)).toBe(true);
    const [x, y] = [row['x'] as number, row['y'] as number];
    // On the 250-tile valley (V-202) no ore lies near, so copper and tin may want shafts too.
    const before = goodsOf(w).shafts;
    expect(before).toContainEqual({ x, y, z: 0, state: 'planned' });
    const page = tileView(w, x, y, 0, lineOf)!.shaft!;
    expect(page.what).toBe(`a shaft with a ladder, down to level ${row['to'] as number}`);
    expect(page.why).toMatch(/^(Iron|Copper|Tin) is wanted/);
    expect(page.work).toMatch(
      /^about 4 hours a level, \d+ in all, by whoever takes up Mining; 2 logs for the ladder$/,
    );
    expect(page.back).toBe(true);
    expect(page.placed?.type).toBe('mine.shaftPlanned');
    // Send back works once: the replacement is planned elsewhere and cannot be sent back.
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBackShaft', data: { shaft: page.id } });
    step(w, sim, 2);
    expect(tileView(w, x, y, 0, lineOf)!.shaft).toBeUndefined();
    const next = goodsOf(w).shafts.filter((s) => !before.some((b) => b.x === s.x && b.y === s.y));
    expect(next).toHaveLength(1);
    expect(goodsOf(w).shafts).toHaveLength(before.length);
    expect(tileView(w, next[0]!.x, next[0]!.y, 0, lineOf)!.shaft!.back).toBe(false);
  });

  it('offers no Send back once a miner has taken up sinking', () => {
    const w = run.sink();
    if (w) {
      const miner = (w.entities['person'] ?? []).find((p) => p['task'] === 'sink')!;
      const row = shaftsOf(w).find((s) => s.id === miner['plan'])!;
      const page = tileView(w, row['x'] as number, row['y'] as number, 0, lineOf)!.shaft!;
      expect(page.here).toBeDefined();
      expect(page.back).toBe(false);
      return;
    }
    throw new Error('no miner took up sinking');
  });

  it('says what the miners are doing in words, never a raw key', () => {
    const doing = run.words();
    const mining = [...doing].filter((t) => /shaft|vein|ore/i.test(t));
    expect(mining.length).toBeGreaterThan(0);
    for (const t of mining) expect(t).not.toMatch(/[{}]|^(sink|tunnel|mine|clay)$/);
  });
});

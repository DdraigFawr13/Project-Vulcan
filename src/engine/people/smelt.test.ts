// Bundle 3 metal, Slice 1: with only the Bronze plate raised and ore in the store, nobody is
// ordered, yet the colony plans a smelter outside the town ring (with a reason), burns charcoal,
// smelts copper and tin and mixes bronze, every line tracing to the want; a smelter with no
// charcoal to be had says so once; ingots keep a trail back to the ore.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { greenOf, ringOf } from '../build/index.ts';
import { allLines, createSim, createWorld, step, submitCommand, whyOf } from '../index.ts';
import { haveOf, itemsOf, layItem, storeOf, trailOf } from '../goods/index.ts';

const sim = createSim(content);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** A world with the Bronze plate raised and `ore` laid on empty store tiles. */
function withOre(ore: [string, number][], on = sim): World {
  const w = createWorld(on, 'ledger');
  const free = storeOf(w).filter(
    (s) => !itemsOf(w).some((i) => i['x'] === s['x'] && i['y'] === s['y']),
  );
  ore.forEach(([kind, count], k) =>
    layItem(w, {
      kind,
      count,
      x: free[k]!['x'] as number,
      y: free[k]!['y'] as number,
      z: 0,
      made: 1,
    }),
  );
  submitCommand(w, {
    tick: 1,
    kind: 'setStock',
    data: { good: 'bronze-ingot', level: 'some' },
  });
  return w;
}

describe('metal', () => {
  it('smelts bronze unordered: smelter outside the ring, charcoal, ingots, trail', () => {
    const w = withOre([
      ['copper-ore', 6],
      ['tin-ore', 2],
    ]);
    // Each smelting line traces to the Bronze plate; checked daily, before older days are sealed.
    let traced = 0;
    for (let d = 0; d < 20 && haveOf(w, content, 'bronze-ingot') < 4; d += 1) {
      for (const e of step(w, sim, DAY)) {
        if (e.type === 'metal.charcoalMade')
          expect(whyOf(w, e.id).map((c) => c.event.type)).toContain('metal.clampLit');
        if (e.type !== 'metal.smelted' && e.type !== 'metal.mixed') continue;
        const chain = whyOf(w, e.id).map((c) => c.event.type);
        expect(chain).toContain('work.tookUpSmelting');
        expect(chain.some((t) => t === 'goods.stockRaised' || t === 'goods.stockSet')).toBe(true);
        traced += 1;
      }
    }
    expect(traced).toBeGreaterThan(0);
    // The Bronze plate was the only order given.
    expect(w.commandLog.map((c) => c.kind)).toEqual(['setStock']);
    expect(lines(w, 'command.refused')).toEqual([]);
    // The smelter is planned from need, outside the town ring, with a reason.
    const planned = lines(w, 'metal.smelterPlanned');
    expect(planned).toHaveLength(1);
    expect(String(planned[0]!.data['why'])).toMatch(/bronze ingots are wanted and copper ore/);
    const smelter = (w.entities['station'] ?? []).find((s) => s['kind'] === 'smelter')!;
    const green = greenOf(w);
    const far = Math.max(
      Math.abs((smelter['x'] as number) - green.x),
      Math.abs((smelter['y'] as number) - green.y),
    );
    expect(far).toBeGreaterThan(ringOf(w, content));
    expect(smelter['state']).toBe('built');
    // Charcoal burned, copper and tin smelted, bronze mixed: each traces to the Bronze plate.
    expect(lines(w, 'metal.charcoalMade').length).toBeGreaterThan(0);
    const smelted = lines(w, 'metal.smelted').map((e) => e.data['what']);
    expect(smelted).toEqual(expect.arrayContaining(['copper ingots', 'tin ingots']));
    const mixed = lines(w, 'metal.mixed');
    // At least one mix; miners may dig more ore for the rest of the plate meanwhile.
    expect(mixed.length).toBeGreaterThan(0);
    // The bronze remembers its ore, its smelting and its mixing, as an ingot or, once the smith
    // fetched it from where it lay and made a tool of it, on that tool.
    const bronze = itemsOf(w).find(
      (i) =>
        i['trail'] && (i['kind'] === 'bronze-ingot' || String(i['kind']).startsWith('bronze-')),
    )!;
    const steps = trailOf(bronze);
    expect(
      steps
        .filter((s) => s.s === 'mined')
        .map((s) => s.k)
        .sort(),
    ).toEqual(['copper-ore', 'tin-ore']);
    expect(steps.map((s) => s.s)).toEqual(expect.arrayContaining(['smelted', 'mixed']));
    expect(steps.length).toBeLessThanOrEqual(content.metal.trail.most);
  });

  it('says once that the smelter waits when no charcoal can be had', () => {
    // A clamp that wants more logs than the colony will ever hold: charcoal is never made.
    const none = createSim({
      ...content,
      metal: { ...content.metal, clamp: { ...content.metal.clamp, logs: 9999 } },
    });
    const w = withOre([['copper-ore', 6]], none);
    step(w, none, 8 * DAY);
    expect(lines(w, 'metal.charcoalMade')).toEqual([]);
    // One alert for each input the colony is short of: the charcoal, and the tin ore bronze needs.
    const waiting = lines(w, 'metal.waiting').map((e) => e.data['good']);
    expect(waiting.sort()).toEqual(['charcoal', expect.stringMatching(/tin ore/i)]);
    expect(haveOf(w, content, 'copper-ingot')).toBe(0);
  });
});

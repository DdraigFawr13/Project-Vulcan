// Bundle 5 slice 3: hides in the store and a short Clothes plate lead the colony to plan tan pits
// at the edge (with a reason), builders build them, a hide is cured to fur, and a hide laid in
// comes out as leather after its days; every line cites its causes. The lever sends the plan back
// once. The pits' days are one, so the run is short.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { allLines, createSim, createWorld, step, submitCommand, whyOf } from '../index.ts';
import { itemsOf, layItem, storeOf } from '../goods/index.ts';
import { greenOf, ringOf } from './index.ts';

const tan = content.clothes.tan;
const quick = {
  ...content,
  flock: { ...content.flock, tame: { ...content.flock.tame, species: [] } },
  clothes: { ...content.clothes, tan: { ...tan, leather: { ...tan.leather, days: 1 } } },
};
const sim = createSim(quick);
const DAY = 1440;
type World = ReturnType<typeof createWorld>;
const lines = (w: World, type: string) => allLines(w).filter((e) => e.type === type);

/** A world with `count` hides laid on empty store tiles. */
function withHides(count: number): World {
  const w = createWorld(sim, 'ledger');
  const free = storeOf(w).filter(
    (s) => !itemsOf(w).some((i) => i['x'] === s['x'] && i['y'] === s['y']),
  )[0]!;
  layItem(w, {
    kind: 'hide',
    count,
    x: free['x'] as number,
    y: free['y'] as number,
    z: 0,
    made: 1,
  });
  return w;
}

describe('tan pits', () => {
  it('plans pits from need, builds them, cures and tans, each line citing its causes', () => {
    const w = withHides(6);
    for (let d = 0; d < 30 && !lines(w, 'tan.tanned').length; d += 1) step(w, sim, DAY);
    const planned = lines(w, 'pits.planned');
    expect(planned).toHaveLength(1);
    expect(String(planned[0]!.data['count'])).toBe('6');
    const pits = (w.entities['station'] ?? []).find((s) => s['kind'] === 'pits')!;
    expect(pits['state']).toBe('built');
    const green = greenOf(w);
    const far = Math.max(
      Math.abs((pits['x'] as number) - green.x),
      Math.abs((pits['y'] as number) - green.y),
    );
    expect(far).toBeGreaterThan(ringOf(w, content));
    expect(lines(w, 'pits.built')).toHaveLength(1);
    expect(lines(w, 'tan.cured').length).toBeGreaterThan(0);
    expect(lines(w, 'tan.laidIn').length).toBeGreaterThan(0);
    const tanned = lines(w, 'tan.tanned');
    expect(tanned.length).toBeGreaterThan(0);
    const chain = whyOf(w, tanned[0]!.id).map((c) => c.event.type);
    expect(chain).toEqual(expect.arrayContaining(['tan.laidIn', 'work.tookUpTanning']));
    const took = whyOf(w, lines(w, 'tan.cured')[0]!.id).map((c) => c.event.type);
    expect(took).toContain('work.tookUpTanning');
    expect(itemsOf(w).some((i) => i['kind'] === 'leather')).toBe(true);
    expect(lines(w, 'command.refused')).toEqual([]);
  });

  it('sends the plan back once; a replacement cannot be sent back', () => {
    const w = withHides(6);
    for (let d = 0; d < 5 && !lines(w, 'pits.planned').length; d += 1) step(w, sim, DAY / 4);
    const first = (w.entities['station'] ?? []).find((s) => s['kind'] === 'pits')!;
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { pits: first.id } });
    step(w, sim, 2);
    expect(lines(w, 'pits.sentBack')).toHaveLength(1);
    const rows = (w.entities['station'] ?? []).filter((s) => s['kind'] === 'pits');
    expect(rows.map((r) => r['state'])).toEqual(['sent', 'plan']);
    const next = rows[1]!;
    expect([next['x'], next['y']]).not.toEqual([first['x'], first['y']]);
    submitCommand(w, { tick: w.tick + 1, kind: 'sendBack', data: { pits: next.id } });
    step(w, sim, 2);
    expect(lines(w, 'command.refused')).toHaveLength(1);
  });
});

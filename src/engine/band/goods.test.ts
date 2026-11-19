// 5B proposal 2, newcomers bring goods from home (V-162): a household that stays lays what its
// trade brings at the green, with a line naming it and their home; one fleeing a need brings
// `need` percent of it; a trade with no entry brings nothing and says nothing.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { greenOf } from '../build/index.ts';
import {
  allLines,
  createSim,
  createWorld,
  emit,
  streamFor,
  templatesOf,
  type SystemContext,
  type WorldState,
} from '../index.ts';
import { bringGoods } from './verdict.ts';

const sim = createSim(content);
const ctxOf = (w: WorldState): SystemContext => ({
  world: w,
  content,
  state: w.systems['strangers']!,
  rng: () => streamFor(w, 'strangers'),
  emit: (type, fields) => emit(w, templatesOf(content.events), type, fields),
  hooks: {},
});
const g = content.strangers.goods;
const at = (w: WorldState, kind: string) => {
  const s = greenOf(w);
  return (w.entities['item'] ?? [])
    .filter((i) => i['kind'] === kind && i['x'] === s.x && i['y'] === s.y)
    .reduce((n, i) => n + (i['count'] as number), 0);
};
const needKind = content.strangers.kinds.find((k) => k.need)!.id;
const quietKind = content.strangers.kinds.find((k) => !k.need)!.id;

describe('newcomers bring goods from home', () => {
  for (const [trade, fled] of [
    ['farming', false],
    ['crafting', true],
  ] as const)
    it(`a ${trade} household${fled ? ' fleeing a need' : ''} lays its goods at the green`, () => {
      const w = createWorld(sim, 'ledger');
      const lead = {
        ...w.entities['person']![0]!,
        trade,
        home: 'Granstead',
        reason: fled ? needKind : quietKind,
      };
      const { item, count } = g.trades[trade]!;
      const before = at(w, item);
      bringGoods(ctxOf(w), [lead], allLines(w)[0]!.id);
      const want = fled ? Math.max(1, Math.floor((count * g.need) / 100)) : count;
      expect(at(w, item) - before).toBe(want);
      const said = allLines(w).filter((e) => e.type === 'people.broughtGoods');
      expect(said).toHaveLength(1);
      expect(said[0]!.data['count']).toBe(want);
      expect(said[0]!.data['home']).toBe('Granstead');
      expect(String(said[0]!.data['little']).length > 0).toBe(fled);
    });

  it('a trade with no entry brings nothing', () => {
    const w = createWorld(sim, 'ledger');
    const lead = { ...w.entities['person']![0]!, trade: 'no-such-trade', reason: quietKind };
    bringGoods(ctxOf(w), [lead], allLines(w)[0]!.id);
    expect(allLines(w).filter((e) => e.type === 'people.broughtGoods')).toHaveLength(0);
  });
});

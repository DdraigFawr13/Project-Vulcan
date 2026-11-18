// Phase 5B Bundle 2 (V-130), people: seed is eaten only with Food at 0 (and only beyond what the
// fields need to sow, Phase 6 Bundle 0), and on the Work sheet a
// tie in level puts farming ahead of hunting, fishing and foraging.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { itemsOf, layItem } from '../goods/index.ts';
import { addEntity } from '../entity/index.ts';
import { needOf } from '../needs/index.ts';
import { allLines, createSim, createWorld, step } from '../index.ts';
import { jobsInOrder } from './priority.ts';

const sim = createSim(content);

/** A world where the only food lying about is seed under the first person's feet, and their Food is `food`. */
function hungry(food: number) {
  const w = createWorld(sim, 'ledger');
  const p = (w.entities['person'] ?? [])[0]!;
  const edible = (k: string) => content.life.eat[k] !== undefined && k !== 'seed';
  for (const i of [...itemsOf(w)]) if (edible(i['kind'] as string)) i['count'] = 0;
  w.entities['item'] = itemsOf(w).filter((i) => (i['count'] as number) > 0);
  layItem(w, {
    kind: 'seed',
    count: 20,
    x: p['x'] as number,
    y: p['y'] as number,
    z: p['z'] as number,
    made: w.begunEvent,
  });
  needOf(w, p.id, 'food')!['value'] = food;
  return w;
}

describe('seed kept', () => {
  it('is not eaten by someone hungry with Food above 0', () => {
    const w = hungry(1000);
    step(w, sim, 20);
    expect(allLines(w).filter((e) => e.type === 'goods.ateSeed')).toHaveLength(0);
  });

  it('is kept back at Food 0 while the fields need it all to sow (Phase 6 Bundle 0)', () => {
    const w = hungry(0);
    const seed = itemsOf(w)
      .filter((i) => i['kind'] === 'seed')
      .reduce((n, i) => n + (i['count'] as number), 0);
    const tiles = Array.from({ length: seed }, (_, k) => k);
    addEntity(w, 'field', { state: 'fallow', tiles, done: [], crop: '' });
    step(w, sim, 20);
    expect(allLines(w).filter((e) => e.type === 'goods.ateSeed')).toHaveLength(0);
  });

  it('is eaten at Food 0', () => {
    const w = hungry(0);
    step(w, sim, 20);
    expect(allLines(w).filter((e) => e.type === 'goods.ateSeed').length).toBeGreaterThan(0);
  });
});

describe('work order', () => {
  it('sorts farm before hunt, fish and forage on a tie', () => {
    const w = createWorld(sim, 'ledger');
    const order = jobsInOrder(w, content, (w.entities['person'] ?? [])[0]!);
    for (const later of ['hunt', 'fish', 'forage'])
      expect(order.indexOf('farm')).toBeLessThan(order.indexOf(later));
  });
});

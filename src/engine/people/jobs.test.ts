// P2.4: with no order to anyone, the band fells what the colony's stock level asks for and the
// logs end up in the store; the lever is a ledger line that every felling line traces back to.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { haveOf, itemsOf, storeOf } from '../goods/index.ts';
import { createSim, createWorld, step, submitCommand, whyOf } from '../index.ts';

const sim = createSim(content);
const inStoreCount = (world: ReturnType<typeof createWorld>): number =>
  itemsOf(world)
    .filter((i) => i['kind'] === 'logs' && !i['holder'])
    .filter((i) => storeOf(world).some((s) => s['x'] === i['x'] && s['y'] === i['y']))
    .reduce((n, i) => n + (i['count'] as number), 0);

describe('work', () => {
  for (const seed of ['ledger', 'anvil', 'tallow', 'smoke/2']) {
    it(`fells what the colony wants and stores it, unordered, on ${seed}`, () => {
      const world = createWorld(sim, seed);
      expect(storeOf(world)).toHaveLength(content.work.store.width * content.work.store.height);
      // The camp and the store are on dry ground, never in the river (seen on smoke/2).
      const wet = (r: { [k: string]: unknown }) =>
        content.terrain.kinds[
          world.map.tiles[(r['y'] as number) * world.map.width + (r['x'] as number)]!
        ]!.water;
      expect([...itemsOf(world), ...storeOf(world)].filter(wet)).toEqual([]);
      step(world, sim, 3 * 1440);
      expect(world.commandLog).toHaveLength(0);
      const want = content.work.stock[0]!.levels.find(
        (l) => l.id === content.work.stock[0]!.start,
      )!;
      expect(haveOf(world, content, 'logs')).toBeGreaterThanOrEqual(want.count);
      expect(inStoreCount(world)).toBe(haveOf(world, content, 'logs'));
      // Felling lines lead back through taking it up to the colony's stock level.
      const felled = world.log.find((e) => e.type === 'work.felled')!;
      const chain = whyOf(world, felled.id).map((c) => c.event.type);
      expect(chain.slice(0, 3)).toEqual(['work.tookUp', 'goods.stockSet', 'goods.unloaded']);
    });
  }

  it('fells more when the lever asks for plenty, and refuses an unknown level', () => {
    const world = createWorld(sim, 'ledger');
    step(world, sim, 2 * 1440);
    const before = haveOf(world, content, 'logs');
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'setStock',
      data: { good: 'logs', level: 'plenty' },
    });
    submitCommand(world, {
      tick: world.tick + 2,
      kind: 'setStock',
      data: { good: 'logs', level: 'heaps' },
    });
    step(world, sim, 3 * 1440);
    const set = world.log.filter((e) => e.type === 'goods.stockSet');
    expect(set.at(-1)!.data['word']).toBe('plenty of');
    expect(world.log.some((e) => e.type === 'command.refused')).toBe(true);
    expect(haveOf(world, content, 'logs')).toBeGreaterThan(before + 50);
  });
});

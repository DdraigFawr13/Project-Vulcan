// P2.4: with no order to anyone, the band fells what the colony's stock level asks for and the
// logs end up in the store; the lever is a ledger line that every felling line traces back to.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { haveOf, itemsOf, storeOf } from '../goods/index.ts';
import {
  createSim,
  createWorld,
  furnitureOf,
  planPart,
  plansOf,
  step,
  submitCommand,
  whyOf,
} from '../index.ts';

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
      // Carpenters (P3.4) take wood for the bench and beds; felling makes it up.
      const wood = furnitureOf(world).reduce(
        (n, f) =>
          n +
          (f['state'] === 'built'
            ? content.buildings.furniture.kinds.find((k) => k.id === f['kind'])!.cost
            : (f['have'] as number)),
        0,
      );
      // Logs builders have brought to a plan not yet built are taken too (a room is walled in its
      // house's wood, V-097).
      const brought = plansOf(world)
        .filter((p) => p['state'] === 'plan' && planPart(content, p).material === 'logs')
        .reduce((n, p) => n + (p['have'] as number), 0);
      // A tree being felled counts, as it does when felling is taken up (jobs.ts `shortOf`): a
      // day can end with the level met only once that tree is down.
      const coming = (world.entities['person'] ?? [])
        .filter((p) => p['job'] === 'fell' && (p['target'] as number) >= 0)
        .reduce((n, p) => {
          const f = world.map.features[p['target'] as number]!;
          return n + (f ? (content.features[f - 1]!.amount ?? 0) : 0);
        }, 0);
      expect(haveOf(world, content, 'logs') + wood + brought + coming).toBeGreaterThanOrEqual(
        want.count,
      );
      // What is stored, with what carpenters took, meets the level: a felled log left lying
      // where it fell does not count (the phase review found this check had become one that
      // could not fail).
      expect(inStoreCount(world) + wood + brought + coming).toBeGreaterThanOrEqual(want.count);
      // And no more than the level, give or take the loads on their way in: the logs of a cleared
      // house site stay where they fell, so they cannot fill the store (anvil had 450 by day 3).
      const people = world.entities['person']?.length ?? 0;
      expect(inStoreCount(world)).toBeLessThanOrEqual(
        Math.max(want.count, content.life.stacks['logs'] ?? 0) + people * content.work.haul.load,
      );
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

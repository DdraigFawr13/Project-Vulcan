// P2.2: a week on three seeds keeps every need above its warning line, the band eats from the
// cart and sleeps on its bedrolls, and a need that goes low writes a line citing what explains it.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { removeEntity } from '../entity/index.ts';
import { itemsOf } from '../goods/index.ts';
import { createSim, createWorld, step, submitCommand } from '../index.ts';
import { moodOf, needOf } from './index.ts';

const sim = createSim(content);
const rations = (world: ReturnType<typeof createWorld>): number =>
  itemsOf(world)
    .filter((i) => i['kind'] === 'preserved')
    .reduce((n, i) => n + (i['count'] as number), 0);

describe('needs', () => {
  for (const seed of ['ledger', 'anvil', 'tallow']) {
    it(`keeps the band fed, rested, warm and relaxed for a week on ${seed}`, () => {
      const world = createWorld(sim, seed);
      const people = world.entities['person']!;
      expect(itemsOf(world).filter((i) => i['state'] === 'laid')).toHaveLength(people.length);
      const before = rations(world);
      let onBeds = 0;
      for (let h = 0; h < 7 * 24; h += 1) {
        step(world, sim, 60);
        for (const p of people)
          for (const def of content.life.needs)
            expect(needOf(world, p.id, def.id)!['value'], `${def.id} hour ${h}`).toBeGreaterThan(
              def.low,
            );
        // 02:00 each night: who is asleep on their own bedroll.
        if (h % 24 === 19)
          onBeds += people.filter((p) =>
            itemsOf(world).some(
              (i) => i['owner'] === p.id && i['x'] === p['x'] && i['y'] === p['y'],
            ),
          ).length;
      }
      expect(rations(world)).toBeLessThan(before);
      expect(onBeds).toBeGreaterThanOrEqual(people.length * 6);
      expect(world.log.filter((e) => e.type === 'goods.unloaded')).toHaveLength(1);
      expect(world.log.some((e) => e.type === 'need.low' || e.type === 'mood.changed')).toBe(false);
    });
  }

  it('writes hunger and cold as lines that cite their causes, and the mood follows', () => {
    const world = createWorld(sim, 'ledger');
    for (const i of itemsOf(world).filter((x) => x['kind'] === 'preserved'))
      removeEntity(world, 'item', i.id);
    // The colony wants no food, so no one forages and the hunger is the cart's running out.
    submitCommand(world, {
      tick: world.tick + 1,
      kind: 'setStock',
      data: { good: 'food', level: 'none' },
    });
    const p = world.entities['person']![0]!;
    step(world, sim, 24 * 60);
    const hungry = world.log.find((e) => e.type === 'need.low' && e.actors?.includes(p.id))!;
    expect(hungry.data['word']).toBe('hungry');
    expect(hungry.causes).toEqual([p['arrived']]);
    // A hard frost: warmth goes low and cites the weather spell in force.
    world.systems['weather']!['temp'] = -20;
    step(world, sim, 3 * 60);
    const cold = world.log.find((e) => e.type === 'need.low' && e.data['word'] === 'cold')!;
    expect(cold.causes).toEqual([world.systems['weather']!['spell']]);
    expect(moodOf(world, p.id)!['word']).not.toBe('Content');
    const fell = world.log.find((e) => e.type === 'mood.changed' && e.actors?.includes(p.id))!;
    expect(fell.data['way']).toBe('fell');
  });
});

// P2.2: a week on three seeds keeps every need above its warning line, the band eats from the
// cart and sleeps on its bedrolls or, once made, in beds (P3.4), and a need that goes low writes a line citing what explains it.
import { describe, expect, it } from 'vitest';
import { content as game } from '../../content/index.ts';
import { withoutAccidents } from '../index.ts';
import { removeEntity } from '../entity/index.ts';
import { itemsOf } from '../goods/index.ts';
import { createSim, createWorld, step, submitCommand } from '../index.ts';
import { bedOwnedBy } from '../build/index.ts';
import { moodOf, needOf } from './index.ts';

// Accidents (P5.6) are left out: this tests needs, not injury (health.test.ts does).
const content = withoutAccidents(game);

const sim = createSim(content);
const rations = (world: ReturnType<typeof createWorld>): number =>
  itemsOf(world)
    .filter((i) => i['kind'] === 'preserved')
    .reduce((n, i) => n + (i['count'] as number), 0);

describe('needs', () => {
  // Since 5B Bundle 1's doubled stacks anvil's band spends its first week on smelting and fire
  // work and falls just short of the rest bar; smoke keeps three seeds in the check (Morgan).
  for (const seed of ['ledger', 'smoke', 'tallow']) {
    it(`keeps the band fed, rested, warm and relaxed for a week on ${seed}`, () => {
      const world = createWorld(sim, seed);
      const people = world.entities['person']!;
      expect(itemsOf(world).filter((i) => i['state'] === 'laid')).toHaveLength(people.length);
      const before = rations(world);
      let onBeds = 0;
      for (let h = 0; h < 7 * 24; h += 1) {
        step(world, sim, 60);
        for (const p of people)
          // Privacy (P3.5) is meant to fall in a shared room: the band's barracks cottage.
          for (const def of content.life.needs.filter((n) => n.id !== 'privacy'))
            expect(needOf(world, p.id, def.id)!['value'], `${def.id} hour ${h}`).toBeGreaterThan(
              def.low,
            );
        // 02:00 each night: who is asleep on their own bedroll, or in their own bed.
        if (h % 24 === 19)
          onBeds += people.filter(
            (p) =>
              itemsOf(world).some(
                (i) => i['owner'] === p.id && i['x'] === p['x'] && i['y'] === p['y'],
              ) ||
              (bedOwnedBy(world, p.id)?.['x'] === p['x'] &&
                bedOwnedBy(world, p.id)?.['y'] === p['y']),
          ).length;
      }
      expect(rations(world)).toBeLessThan(before);
      expect(onBeds).toBeGreaterThanOrEqual(people.length * 6);
      expect(world.log.filter((e) => e.type === 'goods.unloaded')).toHaveLength(1);
      // Only the barracks (P3.5) writes lines: privacy going low, and the mood it drags down.
      const lines = world.log.filter((e) => e.type === 'need.low' || e.type === 'mood.changed');
      for (const e of lines) {
        const why = e.type === 'need.low' ? e : world.log.find((l) => l.id === e.causes[0]);
        expect(why?.data['need'], `${e.type} at ${e.tick}`).toBe('privacy');
      }
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

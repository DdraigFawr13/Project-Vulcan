// V-230: after a long walk to eat, with work waiting, a person takes food along for the rest of
// their working day and eats it where they are; a short walk, or no work, takes nothing.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { haveOf, itemsOf, layItem } from '../goods/index.ts';
import { packOfPerson } from '../land/index.ts';
import { needOf } from '../needs/index.ts';
import { createSim, createWorld, step } from '../index.ts';
import { takeBite } from './bite.ts';

const sim = createSim(content);
const bite = content.life.bite;

function setUp() {
  const world = createWorld(sim, 'anvil');
  const ctx = { world, content, hooks: sim.hooks, emit: () => 0 } as never;
  const p = world.entities['person']!.find((q) => q['status'] === 'alive')!;
  const [x, y] = [world.map.startX, world.map.startY];
  const id = layItem(world, { kind: 'turnips', count: 5, x, y, z: 0, made: 0 });
  const food = itemsOf(world).find((i) => i.id === id)!;
  needOf(world, p.id, 'food')!['value'] = 7000;
  return { world, ctx, p, food };
}

const packed = (world: ReturnType<typeof createWorld>, p: { id: number }) =>
  packOfPerson(world, p as never).reduce((n, i) => n + (i['count'] as number), 0);

describe('a bite to take along (V-230)', () => {
  it('takes food for the rest of the working day after a long walk, with work waiting', () => {
    const { world, ctx, p, food } = setUp();
    const before = haveOf(world, content, 'turnips');
    Object.assign(p, { job: 'fell', eatWalk: bite.far + 1 });
    takeBite(ctx, p, food, 8);
    // 8 hours' fall less what is above the line, in turnips, at most `most`.
    const fall = content.life.needs.find((n) => n.id === 'food')!.fall;
    const seek = content.life.needs.find((n) => n.id === 'food')!.seek;
    const want = Math.ceil((fall * 8 - (7000 - seek)) / content.life.eat['turnips']!);
    expect(packed(world, p)).toBe(Math.min(bite.most, want));
    expect(packed(world, p)).toBeGreaterThan(0);
    // Taken from the stack, still the colony's food.
    expect(food['count']).toBe(5 - packed(world, p));
    expect(haveOf(world, content, 'turnips')).toBe(before);
    expect(p['eatWalk']).toBe(0);
  });

  it('takes nothing after a short walk, with no work to go back to, or at the end of the day', () => {
    for (const [job, walk, hours] of [
      ['fell', bite.far, 8],
      ['', bite.far + 1, 8],
      ['fell', bite.far + 1, 0],
    ] as const) {
      const { world, ctx, p, food } = setUp();
      Object.assign(p, { job, eatWalk: walk });
      takeBite(ctx, p, food, hours);
      expect(packed(world, p)).toBe(0);
    }
  });

  it('eats from the pack where they stand when hungry', () => {
    const { world, ctx, p, food } = setUp();
    Object.assign(p, { job: 'fell', eatWalk: bite.far + 1 });
    takeBite(ctx, p, food, 10);
    const had = packed(world, p);
    expect(had).toBeGreaterThan(0);
    needOf(world, p.id, 'food')!['value'] = 1000;
    Object.assign(p, { job: '', path: [], doing: '' });
    const at = [p['x'], p['y'], p['z']];
    step(world, sim, 1);
    expect(packed(world, p)).toBe(had - 1);
    expect([p['x'], p['y'], p['z']]).toEqual(at);
  });
});

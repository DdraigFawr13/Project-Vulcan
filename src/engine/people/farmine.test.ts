// V-231: a miner setting off on a way over `mine.pack` steps goes with a pack; a short way takes
// none; a packed miner whose pack holds no food goes to eat as anyone does.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { packOfPerson } from '../land/index.ts';
import { setOut } from '../land/minefar.ts';
import { needOf } from '../needs/index.ts';
import { createSim, createWorld } from '../index.ts';
import { afield } from './afield.ts';
import { takeBite } from './bite.ts';
import { itemsOf } from '../goods/index.ts';

const sim = createSim(content);
const pack = content.work.mine.pack;

function setUp() {
  const world = createWorld(sim, 'anvil');
  const ctx = { world, content, state: {}, hooks: sim.hooks, emit: () => 0 } as never;
  const p = world.entities['person']!.find((q) => q['status'] === 'alive')!;
  Object.assign(p, { job: 'mine', task: 'mine', doing: 'work' });
  return { world, ctx, p };
}

const food = (world: ReturnType<typeof createWorld>, p: { id: number }) =>
  packOfPerson(world, p as never).filter((i) => content.life.eat[i['kind'] as string]).length;

describe('far mining (V-231)', () => {
  it('packs for a way over mine.pack steps, and not for one of mine.pack', () => {
    const far = setUp();
    far.p['path'] = Array.from({ length: pack + 1 }, () => 0);
    setOut(far.ctx, far.p);
    expect(far.p['packed']).toBe(1);
    expect(food(far.world, far.p)).toBeGreaterThan(0);
    const near = setUp();
    near.p['path'] = Array.from({ length: pack }, () => 0);
    setOut(near.ctx, near.p);
    expect(near.p['packed'] ?? 0).toBe(0);
    expect(food(near.world, near.p)).toBe(0);
  });

  it('a packed miner with no food left goes to eat; with food, eats from the pack', () => {
    const { world, ctx, p } = setUp();
    p['path'] = Array.from({ length: pack + 1 }, () => 0);
    setOut(ctx, p);
    p['path'] = [];
    needOf(world, p.id, 'food')!['value'] = 1000;
    expect(afield(ctx, p, false)).toBe(true);
    expect(needOf(world, p.id, 'food')!['value']).toBeGreaterThan(1000);
    for (const i of packOfPerson(world, p))
      if (content.life.eat[i['kind'] as string]) i['state'] = '';
    needOf(world, p.id, 'food')!['value'] = 1000;
    expect(afield(ctx, p, false)).toBe(false);
    // Fed at the store after the long walk back, they fill the pack again for the days out.
    const stack = itemsOf(world).find((i) => (content.life.eat[i['kind'] as string] ?? 0) > 0)!;
    p['eatWalk'] = content.life.bite.far + 1;
    takeBite(ctx, p, stack, 0);
    expect(food(world, p)).toBeGreaterThan(0);
  });
});

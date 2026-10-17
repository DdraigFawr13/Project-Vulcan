import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, step, submitCommand } from '../index.ts';
import { MAP_SEEDS } from './seeds.ts';
import { makeLevel } from './underground.ts';

// P1.3 done-when: copper and tin lie within the start radius on level 2 on every seed, and a
// level nobody has reached is not made at all (save size: src/worker/save.test.ts).
describe('levels below', () => {
  const sim = createSim(content);
  const radius = content.terrain.generator.start.radius;
  const veinOf = (id: string) => content.features.findIndex((f) => f.id === id) + 1;

  it.each(MAP_SEEDS)('seed %s has copper and tin near the start on level 2', (seed) => {
    const { map } = createWorld(sim, seed);
    const { features } = makeLevel(seed, content, map, 2);
    for (const ore of ['copper', 'tin']) {
      let near = Infinity;
      features.forEach((f, i) => {
        if (f !== veinOf(ore)) return;
        const x = i % map.width;
        const y = (i - x) / map.width;
        near = Math.min(near, Math.max(Math.abs(x - map.startX), Math.abs(y - map.startY)));
      });
      expect(near, ore).toBeLessThanOrEqual(radius);
    }
  });

  it('makes a level only when stairs or a shaft reach it, the same in any order', () => {
    const world = createWorld(sim, 'ledger');
    expect(world.map.levels).toEqual([null, null, null, null]);
    const { startX: x, startY: y } = world.map;
    const order = (kind: string, data: Record<string, number>) =>
      submitCommand(world, { tick: world.tick + 1, kind, data });
    order('sinkShaft', { x: x + 1, y, z: 0, to: 2 });
    step(world, sim, 1);
    expect(world.map.levels.map((l) => l !== null)).toEqual([true, true, false, false]);
    order('cutStairs', { x, y, z: 0 });
    order('cutStairs', { x, y, z: 4 }); // nothing lies below the deepest level
    step(world, sim, 1);
    const kinds = content.terrain.kinds;
    expect(kinds[world.map.tiles[y * world.map.width + x]!]!.id).toBe('stairs-down');
    expect(kinds[world.map.levels[0]!.tiles[y * world.map.width + x]!]!.id).toBe('stairs-up');
    const lines = world.log.slice(-6).map((e) => e.type);
    expect(lines).toEqual(
      expect.arrayContaining(['map.stairsCut', 'map.digRefused', 'command.applied']),
    );
    // Level 2 made second, straight from the seed, holds what the shaft found first.
    const fresh = makeLevel('ledger', content, world.map, 2);
    const reached = world.map.levels[1]!;
    const dug = (y * world.map.width + x + 1) as number;
    expect([...fresh.features].filter((_, i) => i !== dug)).toEqual(
      [...reached.features].filter((_, i) => i !== dug),
    );
  });

  it('lays out a level the same whether mountain tiles above it were dug first or not', () => {
    const kinds = content.terrain.kinds;
    const early = createWorld(sim, 'harrow');
    const late = createWorld(sim, 'harrow');
    const W = early.map.width;
    const stone = (i: number) => kinds[early.map.tiles[i]!]!.stone === true;
    // Rock tiles at a mountain's foot, where the rock below spreads out from.
    const foot = early.map.tiles
      .map((_, i) => i)
      .filter((i) => stone(i) && i % W > 0 && !stone(i - 1))
      .filter((_, k) => k % 7 === 0)
      .slice(0, 30);
    // One world sinks shafts at the foot to level 1 and then reaches level 2 at the start; the
    // other reaches level 2 first.
    for (const i of foot)
      submitCommand(early, {
        tick: 1,
        kind: 'sinkShaft',
        data: { x: i % W, y: Math.floor(i / W), z: 0, to: 1 },
      });
    const start = { x: early.map.startX, y: early.map.startY, z: 0, to: 2 };
    submitCommand(early, { tick: 2, kind: 'sinkShaft', data: start });
    step(early, sim, 3);
    submitCommand(late, { tick: 1, kind: 'sinkShaft', data: start });
    step(late, sim, 2);
    expect(early.log.filter((e) => e.type === 'map.shaftSunk')).toHaveLength(foot.length + 1);
    const off = new Set([...foot, start.y * W + start.x]);
    const keep = (_: number, i: number) => !off.has(i);
    const [a, b] = [early.map.levels[1]!, late.map.levels[1]!];
    expect([...a.tiles].filter(keep)).toEqual([...b.tiles].filter(keep));
    expect([...a.features].filter(keep)).toEqual([...b.features].filter(keep));
  });
});

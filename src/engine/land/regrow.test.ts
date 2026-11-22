// 6W Slice 3 (V-202): a tree felled for wood grows back after `regrow.years` when a living tree
// stands within `regrow.near` tiles; a lone tree's clearing stays clear. One line for the day.
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, TICKS_PER_DAY } from '../index.ts';
import { peopleSystem } from '../people/index.ts';
import { contextFor } from '../sim/system.ts';
import { noteFelled, regrowWoods } from './regrow.ts';

describe('felled woods grow back', () => {
  it('regrows beside standing trees after the years, never in a lone clearing', () => {
    const sim = createSim(content);
    const world = createWorld(sim, 'anvil');
    const { map } = world;
    const { near, years } = content.terrain.generator.regrow;
    const isTree = (i: number) =>
      map.features[i]! > 0 && content.features[map.features[i]! - 1]!.kind === 'tree';
    const treesAround = (i: number) => {
      const [x, y] = [i % map.width, Math.floor(i / map.width)];
      let n = 0;
      for (let dy = -near; dy <= near; dy += 1)
        for (let dx = -near; dx <= near; dx += 1) {
          const j = (y + dy) * map.width + x + dx;
          if (j !== i && x + dx >= 0 && x + dx < map.width && isTree(j)) n += 1;
        }
      return n;
    };
    const buildable = (i: number) => content.terrain.kinds[map.tiles[i]!]!.buildable === true;
    const trees = [...map.features.keys()].filter((i) => isTree(i) && buildable(i));
    const wooded = trees.find((i) => treesAround(i) >= 3)!;
    const lone = trees.find((i) => treesAround(i) === 0)!;
    expect(wooded).toBeDefined();
    expect(lone).toBeDefined();
    const ctx = contextFor(world, sim, peopleSystem);
    const kinds = [wooded, lone].map((i) => map.features[i]!);
    for (const [k, i] of [wooded, lone].entries()) {
      noteFelled(ctx, i, kinds[k]!);
      map.features[i] = 0;
    }
    const perYear = content.calendar.daysPerMonth * content.calendar.monthsPerYear;
    // A day before it is due, nothing; on the day, the wooded tile only, with one line.
    world.tick = (years * perYear - 1) * TICKS_PER_DAY;
    regrowWoods(ctx);
    expect(map.features[wooded]).toBe(0);
    world.tick += TICKS_PER_DAY;
    regrowWoods(ctx);
    expect(map.features[wooded]).toBe(kinds[0]);
    expect(map.features[lone]).toBe(0);
    expect(map.regrow).toEqual([]);
    const line = world.log.at(-1)!;
    expect(line.type).toBe('land.regrown');
    expect(line.data['count']).toBe(1);
    expect(map.tileCauses[wooded]).toBe(line.id);
  });
});

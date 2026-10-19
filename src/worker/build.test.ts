// The Build view and a house tile's rows are the engine's answers in words: the need, the green,
// the houses with whether each can be sent back, and the room of a built tile.
import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createSim, createWorld, housesOf, step } from '../engine/index.ts';
import { buildView, tileHouse } from './build.ts';

const sim = createSim(content);
const DAY = 1440;

describe('build view', () => {
  it('shows the need, a plan that can go back, then the built house and its room', () => {
    const world = createWorld(sim, 'ledger/1');
    expect(buildView(world).need).toBe('5 people sleep under the open sky');
    step(world, sim, DAY / 4);
    const planned = buildView(world);
    const house = planned.houses.find((h) => !h.of)!;
    expect(house.name).toBe('cottage');
    expect(house.why).not.toBe('');
    expect(house.mats.length).toBeGreaterThan(0);
    const row = housesOf(world)[0]!;
    const tile = tileHouse(world, row['x'] as number, row['y'] as number, () => ({}) as never);
    expect(tile.house?.roof).toBe('thatch, laid with the walls');
    expect(tile.room).toBeUndefined();

    step(world, sim, 9 * DAY);
    const built = buildView(world).houses.find((h) => !h.of)!;
    expect(built.state).toBe('built');
    expect(built.back).toBe(false);
    expect(buildView(world).need).toBe('none now');
    const inside = tileHouse(world, built.x + 1, built.y + 1, () => ({}) as never);
    expect(inside.house?.roof).toBe('thatch (not drawn)');
    expect(inside.room?.name).toBe('the cottage');
    expect(inside.room?.impressiveness).toMatch(/ of \d+$/);
  });
});

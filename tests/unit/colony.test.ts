import { describe, expect, it } from 'vitest';
import {
  createWorld,
  rankJobs,
  step,
  type SimEvent,
  type WorldState,
} from '../../src/engine/index.ts';
import { content } from './helpers/world.ts';

/** A fresh colony at midday, everyone content, so one need can be set up per test. */
function midday(): WorldState {
  const { world } = createWorld('colony', content);
  world.tick = 12 * content.tuning.ticksPerHour;
  for (const c of world.colonists) c.needs = { food: 900, rest: 900, company: 900 };
  return world;
}

function runUntil(world: WorldState, type: string, limit = 400): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < limit && !events.some((event) => event.type === type); i += 1) {
    events.push(...step(world, content));
  }
  return events;
}

describe('colony behaviour', () => {
  it('a hungry colonist eats from the store and the meal cites the hunger', () => {
    const world = midday();
    const aled = world.colonists[0]!;
    aled.needs.food = content.tuning.lowAt.food + 1;
    const events = runUntil(world, 'ate');
    const hunger = events.find((e) => e.type === 'need.low' && e.actors[0] === aled.id);
    const meal = events.find((e) => e.type === 'ate');
    expect(meal?.actors).toEqual([aled.id]);
    expect(meal?.causes).toEqual([hunger!.id]);
  });

  it('with the store empty, a hungry colonist eats straight from a bush', () => {
    const world = midday();
    world.colony.stock.food = 0;
    world.colonists[0]!.needs.food = content.tuning.lowAt.food - 1;
    const events = runUntil(world, 'ate.at.source');
    const hunger = events.find((e) => e.type === 'need.low' && e.actors[0] === 0);
    const empty = events.find((e) => e.type === 'stock.low' && e.data.resource === 'food');
    const meal = events.find((e) => e.type === 'ate.at.source');
    // The meal cites both the hunger and the empty store.
    expect(meal?.causes).toEqual([hunger!.id, empty!.id]);
  });

  it('a cold hearth is relit, citing the event that it went out', () => {
    const world = midday();
    world.colony.hearthFuel = 1;
    const events = runUntil(world, 'hearth.relit');
    const out = events.find((e) => e.type === 'hearth.out');
    const relit = events.find((e) => e.type === 'hearth.relit');
    expect(relit?.causes).toEqual([out!.id]);
    expect(world.colony.hearthFuel).toBeGreaterThan(0);
  });

  it('demand follows stock: a full store sends nobody out, and liked jobs rank first on ties', () => {
    const world = midday();
    const c = world.colonists[0]!;
    world.colony.stock = { food: 999, wood: 999 };
    expect(rankJobs(world, content, c)).toEqual([]);
    world.colony.stock = { food: 0, wood: 0 };
    expect(rankJobs(world, content, c)[0]!.id).toBe(c.likes === 'chop' ? 'chop' : 'forage');
  });
});

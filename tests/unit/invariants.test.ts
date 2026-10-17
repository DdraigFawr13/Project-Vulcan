import { describe, expect, it } from 'vitest';
import { createWorld, step, Terrain } from '../../src/engine/index.ts';
import { content } from './helpers/world.ts';

describe('invariants over five days', () => {
  it('keeps needs, positions, stock, claims and causes valid every tick', () => {
    const { world, events } = createWorld('invariants', content);
    const { map } = world;
    const max = content.tuning.needMax;
    const seen = new Set(events.map((event) => event.id));
    for (let tick = 0; tick < 5 * content.tuning.ticksPerDay; tick += 1) {
      for (const event of step(world, content)) {
        expect(content.events[event.type], event.type).toBeDefined();
        for (const cause of event.causes)
          expect(seen.has(cause), `#${event.id} cites #${cause}`).toBe(true);
        seen.add(event.id);
      }
      expect(world.colony.stock.food).toBeGreaterThanOrEqual(0);
      expect(world.colony.stock.wood).toBeGreaterThanOrEqual(0);
      expect(world.colony.hearthFuel).toBeGreaterThanOrEqual(0);
      for (const c of world.colonists) {
        for (const value of Object.values(c.needs)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(max);
        }
        expect(map.terrain[c.y * map.width + c.x]).toBe(Terrain.Grass);
        if (c.claim >= 0) expect(map.reservedBy[c.claim]).toBe(c.id + 1);
      }
      for (let i = 0; i < map.reservedBy.length; i += 1) {
        const holder = map.reservedBy[i]!;
        if (holder) expect(world.colonists[holder - 1]!.claim).toBe(i);
      }
    }
    expect(world.tick).toBe(5 * content.tuning.ticksPerDay);
  });
});

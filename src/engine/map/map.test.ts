import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld, step, TICKS_PER_DAY, WATER } from '../index.ts';
import { strandedWater, waterNearStart } from './checks.ts';
import { reachableAround } from './features.ts';
import { MAP_SEEDS } from './seeds.ts';

// P1.1 done-when: every seed's start has buildable land, wood and stone within reach, on
// ground joined to the start (no range walls it off). P1.2: drinkable water near the start, and
// no river or stream ends inland (each reaches the map's edge or a lake). P1.4: a year of weather
// freezes still water on every seed and never a spring (Morgan, 2026-10-17); aura spots keep
// clear of the edge and of each other, each of its own school. One world per seed serves all.
describe('surface map', () => {
  const sim = createSim(content);
  const need = content.terrain.generator.start;
  // One world per seed: the first test reads it as made, the second runs its year.
  const worlds = new Map<string, ReturnType<typeof createWorld>>();
  const worldOf = (seed: string) =>
    worlds.get(seed) ?? worlds.set(seed, createWorld(sim, seed)).get(seed)!;
  it.each(MAP_SEEDS)('seed %s starts with land, wood, stone and water nearby', (seed) => {
    const { map } = worldOf(seed);
    const near = reachableAround(
      content,
      map.tiles,
      map.features,
      map.width,
      map.height,
      need.radius,
    )(map.startX, map.startY);
    expect(near.buildable).toBeGreaterThanOrEqual(need.buildable);
    expect(near.wood).toBeGreaterThanOrEqual(need.wood);
    expect(near.stone).toBeGreaterThanOrEqual(need.stone);
    expect(waterNearStart(content, map, need.radius)).toBeGreaterThan(0);
    expect(strandedWater(map)).toBe(0);
    const aura = content.terrain.generator.aura;
    const surface = map.auraSpots;
    expect(surface.length).toBeGreaterThanOrEqual(1);
    expect(surface.length).toBeLessThanOrEqual(aura.count[1]!);
    expect(new Set(surface.map((s) => s.school)).size).toBe(surface.length);
    for (const s of surface) {
      expect(Math.min(s.x, s.y, map.width - 1 - s.x, map.height - 1 - s.y)).toBeGreaterThanOrEqual(
        aura.margin,
      );
    }
  });
  it.each(MAP_SEEDS)('seed %s freezes still water in a year, never a spring', (seed) => {
    const world = worldOf(seed);
    let mostFrozen = 0;
    for (let day = 0; day < 336; day += 1) {
      step(world, sim, TICKS_PER_DAY);
      mostFrozen = Math.max(mostFrozen, world.systems['weather']!['frozen']!);
    }
    expect(mostFrozen).toBeGreaterThan(0);
    // Only lake tiles ever count frost, so a spring's count stays 0 all year.
    const spring = WATER.indexOf('spring');
    expect(world.map.ice.some((c, i) => c > 0 && world.map.water[i] === spring)).toBe(false);
  });
});

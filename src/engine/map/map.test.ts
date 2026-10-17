import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createSim, createWorld } from '../index.ts';
import { strandedWater, waterNearStart } from './checks.ts';
import { reachableAround } from './features.ts';
import { MAP_SEEDS } from './seeds.ts';

// P1.1 done-when: every seed's start has buildable land, wood and stone within reach, on
// ground joined to the start (no range walls it off). P1.2: drinkable water near the start, and
// no river or stream ends inland (each reaches the map's edge or a lake).
describe('surface map', () => {
  const sim = createSim(content);
  const need = content.terrain.generator.start;
  it.each(MAP_SEEDS)('seed %s starts with land, wood, stone and water nearby', (seed) => {
    const { map } = createWorld(sim, seed);
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
  });
});
